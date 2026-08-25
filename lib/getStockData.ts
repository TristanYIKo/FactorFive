/**
 * Stock data aggregation.
 *
 * Extracted from the API route so the ticker page can call it DIRECTLY as a
 * server component instead of going out over HTTP to the app's own endpoint.
 *
 * The old page was `'use client'` with a fetch in useEffect, which meant the
 * browser had to: download the HTML shell, download and boot the JS bundle,
 * then issue an API request, which then did the upstream work. Three serial
 * legs before a single number appeared, and `loading.tsx` never rendered
 * because the route was not suspending on server data at all.
 *
 * Rendering on the server removes two of those legs entirely.
 */

import type {
  ApiError,
  FinnhubNewsArticle,
  NewsAPIArticle,
  SentimentAnalysis,
  StockData,
} from '@/types/stock';
import { calculateIntelligentStockScore } from '@/lib/scoring';
import { analyzeNewsSentiment } from '@/lib/sentiment';
import { finnhub, fetchPeerMetrics } from '@/lib/finnhub';
import { upstreamJsonOptional } from '@/lib/upstream';
import { buildMarketContext } from '@/lib/marketContext';

/** Ticker symbols are letters, digits, dot, dash. Reject anything else. */
export const SYMBOL_PATTERN = /^[A-Z0-9.\-]{1,12}$/;

export type StockResult =
  | { ok: true; data: StockData }
  | { ok: false; status: number; error: ApiError };

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

/**
 * Keep the most recent `limit` articles and drop fields no view renders.
 * Finnhub returns every headline in the window - 243 for AAPL over 14 days,
 * which was 135KB of the old 393KB response.
 */
function trimNews(articles: FinnhubNewsArticle[], limit: number): FinnhubNewsArticle[] {
  return [...articles]
    .sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0))
    .slice(0, limit)
    .map((a) => ({
      id: a.id,
      datetime: a.datetime,
      headline: a.headline,
      source: a.source,
      url: a.url,
      summary: a.summary?.slice(0, 400) ?? '',
      image: a.image,
      category: a.category,
      related: a.related,
    }));
}

/**
 * NewsAPI lookup by company name. Optional: a failure degrades the page rather
 * than breaking it, but the caller is told whether it worked.
 */
async function fetchCompanyNews(
  companyName: string
): Promise<{ articles: NewsAPIArticle[]; ok: boolean }> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return { articles: [], ok: false };

  const params = new URLSearchParams({
    q: companyName,
    language: 'en',
    sortBy: 'publishedAt',
    pageSize: '20',
    apiKey,
  });

  const res = await upstreamJsonOptional<{ articles?: NewsAPIArticle[]; status?: string }>(
    `https://newsapi.org/v2/everything?${params.toString()}`,
    {
      provider: 'news',
      // NewsAPI's free tier allows only 100 requests per day, so cache hard.
      revalidate: 60 * 30,
      key: `newsapi:everything:${companyName}`,
      retries: 1,
    },
    {}
  );

  if (!res.ok || res.data.status === 'error') return { articles: [], ok: false };
  return { articles: res.data.articles ?? [], ok: true };
}

/**
 * Fetch, score and assemble everything for one symbol.
 *
 * Two hops: seven symbol-only calls in parallel, then the work that depended
 * on them (peer cohort needs the market cap, news needs the company name,
 * market context needs the metric payload).
 */
export async function getStockData(rawSymbol: string): Promise<StockResult> {
  const symbol = rawSymbol?.trim().toUpperCase();

  if (!symbol) {
    return {
      ok: false,
      status: 400,
      error: { error: 'Missing required parameter', details: 'symbol is required' },
    };
  }

  if (!SYMBOL_PATTERN.test(symbol)) {
    return {
      ok: false,
      status: 400,
      error: {
        error: 'Invalid symbol',
        details: 'Symbol must be 1-12 characters (A-Z, 0-9, . or -)',
      },
    };
  }

  if (!process.env.FINNHUB_KEY) {
    return {
      ok: false,
      status: 500,
      error: { error: 'Server configuration error', details: 'FINNHUB_KEY not configured' },
    };
  }

  const startedAt = Date.now();

  try {
    // ---- Hop 1: everything that only needs the symbol ---------------------
    const [quote, profile, news, metric, recommendations, priceTarget, peerList, earnings] =
      await Promise.all([
        finnhub.quote(symbol),
        finnhub.profile(symbol),
        finnhub.news(symbol, isoDaysAgo(14), isoDaysAgo(0)),
        finnhub.metric(symbol),
        finnhub.recommendations(symbol),
        finnhub.priceTarget(symbol),
        finnhub.peers(symbol),
        finnhub.earningsHistory(symbol),
      ]);

    if (!profile?.name) {
      return {
        ok: false,
        status: 404,
        error: { error: 'Invalid symbol', details: `No data found for symbol: ${symbol}` },
      };
    }

    // ---- Hop 2: work that depended on hop 1 -------------------------------
    const subjectMarketCap =
      metric.data?.metric?.marketCapitalization ?? profile.marketCapitalization;

    const [peerResult, companyNews, marketContext] = await Promise.all([
      fetchPeerMetrics(symbol, peerList, subjectMarketCap),
      fetchCompanyNews(profile.name),
      buildMarketContext(quote, metric.data),
    ]);

    const { articles: newsAPIArticles, ok: newsApiOk } = companyNews;

    const sentiment: SentimentAnalysis | undefined =
      newsAPIArticles.length > 0 ? analyzeNewsSentiment(newsAPIArticles) : undefined;

    const scored = calculateIntelligentStockScore(
      symbol,
      quote,
      metric.data,
      recommendations.data,
      priceTarget.data,
      peerResult,
      profile.finnhubIndustry || 'Unknown'
    );

    // Drop financials.series - 233KB of historical arrays no view reads.
    const trimmedFinancials = metric.data?.metric ? { metric: metric.data.metric } : metric.data;

    return {
      ok: true,
      data: {
        symbol,
        profile,
        quote,
        news: trimNews(news.data, 24),
        newsAPIArticles: newsAPIArticles.length > 0 ? newsAPIArticles : undefined,
        sentiment,
        earnings: null,
        financials: trimmedFinancials,
        recommendations: recommendations.data,
        priceTarget: priceTarget.data,
        earningsHistory: (earnings.data ?? [])
          .slice()
          .sort((a, b) => (b.period ?? '').localeCompare(a.period ?? ''))
          .slice(0, 8),
        stockScore: scored.score,
        scoreBreakdown: scored.breakdown,
        industryBenchmarks: scored.benchmarks,
        marketContext,
        dataQuality: {
          peersResolved: peerResult.peers.length,
          peersRequested: peerResult.requested,
          benchmarksReliable: peerResult.complete,
          peerCohort: peerResult.cohort,
          degradedReason: peerResult.degradedReason,
          newsAvailable: newsApiOk,
          financialsAvailable: metric.ok && !!metric.data?.metric,
          generatedAt: new Date().toISOString(),
          elapsedMs: Date.now() - startedAt,
        },
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[getStockData] ${symbol} failed after ${Date.now() - startedAt}ms:`, message);

    // Rate limiting is temporary and distinct from a genuine failure.
    const rateLimited = message.includes('Rate limited');
    return {
      ok: false,
      status: rateLimited ? 503 : 500,
      error: {
        error: rateLimited ? 'Upstream rate limit reached' : 'Failed to fetch stock data',
        details: message,
      },
    };
  }
}
