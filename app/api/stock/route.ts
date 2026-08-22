/**
 * GET /api/stock?symbol=XYZ
 *
 * Aggregates Finnhub and NewsAPI data into a single scored payload.
 *
 * Rewritten to fix the concurrency failure. The previous version issued ~27
 * upstream calls per request with `cache: 'no-store'` on every one, including
 * two calls for each of ten peers. Two simultaneous visitors exceeded
 * Finnhub's 30-req/sec burst cap; the resulting 429s were swallowed, leaving
 * an empty peer list, which the scoring engine turned into a confident-looking
 * ~50/100 for every stock.
 *
 * Now:
 *   - all calls route through lib/finnhub.ts (cached, coalesced, rate limited)
 *   - peer quotes are gone, so the fanout is 7 calls cold and ~1 warm
 *   - the request runs in two hops rather than three
 *   - degraded peer data is reported in `dataQuality`, never hidden
 *   - responses carry CDN cache headers so repeat views skip the function
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
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
const SYMBOL_PATTERN = /^[A-Z0-9.\-]{1,12}$/;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('symbol')?.trim().toUpperCase();

  if (!raw) {
    return NextResponse.json<ApiError>(
      { error: 'Missing required parameter', details: 'symbol is required' },
      { status: 400 }
    );
  }

  if (!SYMBOL_PATTERN.test(raw)) {
    return NextResponse.json<ApiError>(
      { error: 'Invalid symbol', details: 'Symbol must be 1-12 characters (A-Z, 0-9, . or -)' },
      { status: 400 }
    );
  }

  const symbol = raw;

  if (!process.env.FINNHUB_KEY) {
    return NextResponse.json<ApiError>(
      { error: 'Server configuration error', details: 'FINNHUB_KEY not configured' },
      { status: 500 }
    );
  }

  const startedAt = Date.now();

  try {
    // ---- Hop 1: everything that only needs the symbol -----------------------
    // Seven calls, all cached at resource-appropriate TTLs and coalesced across
    // concurrent visitors, so in the warm case this costs close to nothing.
    const [quote, profile, news, metric, recommendations, priceTarget, peerList] =
      await Promise.all([
        finnhub.quote(symbol),
        finnhub.profile(symbol),
        finnhub.news(symbol, isoDaysAgo(14), isoDaysAgo(0)),
        finnhub.metric(symbol),
        finnhub.recommendations(symbol),
        finnhub.priceTarget(symbol),
        finnhub.peers(symbol),
      ]);

    // A profile with no name means the symbol does not exist.
    if (!profile?.name) {
      return NextResponse.json<ApiError>(
        { error: 'Invalid symbol', details: `No data found for symbol: ${symbol}` },
        { status: 404 }
      );
    }

    // ---- Hop 2: work that depended on hop 1 ---------------------------------
    // Peer metrics need the subject's market cap to build a size-comparable
    // cohort; the news lookup needs the company name. Both run together.
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

    // ---- Score --------------------------------------------------------------
    const scored = calculateIntelligentStockScore(
      symbol,
      quote,
      metric.data,
      recommendations.data,
      priceTarget.data,
      peerResult,
      profile.finnhubIndustry || 'Unknown'
    );

    // Trim the response before it goes over the wire. The raw aggregate was
    // 393KB, of which 233KB was `financials.series` (historical quarterly and
    // annual arrays no view reads) and 135KB was 243 news articles for a list
    // that renders a couple of dozen. Shipping that to a phone on mobile data
    // cost far more than the API time it took to fetch.
    const trimmedFinancials = metric.data?.metric
      ? { metric: metric.data.metric }
      : metric.data;

    const payload: StockData = {
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
      stockScore: scored.score,
      scoreBreakdown: scored.breakdown,
      industryBenchmarks: scored.benchmarks,
      marketContext,
      // Surfaced so the UI can be honest about what the score is built on
      // instead of implying full peer analysis that did not happen.
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
    };

    return NextResponse.json<StockData>(payload, {
      headers: {
        // Let Vercel's CDN serve repeat requests without invoking the function
        // at all, and keep serving slightly stale data while it refreshes.
        // This is what turns "N concurrent users" into "one upstream fetch".
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-Elapsed-Ms': String(Date.now() - startedAt),
        'X-Peers-Resolved': String(peerResult.peers.length),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[api/stock] ${symbol} failed after ${Date.now() - startedAt}ms:`, message);

    // Rate limiting is a distinct, temporary condition. Say so, and let the
    // client retry, rather than reporting a generic failure.
    const rateLimited = message.includes('Rate limited');
    return NextResponse.json<ApiError>(
      {
        error: rateLimited ? 'Upstream rate limit reached' : 'Failed to fetch stock data',
        details: message,
      },
      {
        status: rateLimited ? 503 : 500,
        headers: rateLimited ? { 'Retry-After': '5' } : undefined,
      }
    );
  }
}

/**
 * Keep the most recent `limit` articles and drop fields no view renders.
 * Finnhub returns every headline in the window - 243 for AAPL over 14 days.
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
 * NewsAPI lookup by company name. Optional: a failure here degrades the page
 * rather than breaking it, but the caller is told whether it worked.
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
