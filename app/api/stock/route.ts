import { NextRequest, NextResponse } from 'next/server';
import {
  FinnhubQuote,
  FinnhubProfile,
  FinnhubNewsArticle,
  FinnhubEarnings,
  EarningsEvent,
  FinnhubBasicFinancials,
  FinnhubRecommendationTrend,
  FinnhubPriceTarget,
  PeerMetrics,
  StockData,
  ApiError,
  NewsAPIArticle,
  SentimentAnalysis
} from '@/types/stock';
import { calculateIntelligentStockScore } from '@/lib/scoring';
import { analyzeNewsSentiment } from '@/lib/sentiment';
import { newsAPICache } from '@/lib/cache';

// Finnhub API base URL
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// Server-side API keys (never exposed to client)
const FINNHUB_API_KEY = process.env.FINNHUB_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// Timeout for API requests (10 seconds)
const API_TIMEOUT = 10000;

// Helper function to fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number = API_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if ((error as Error).name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

// Helper function to retry failed requests
async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries: number = 2): Promise<Response> {
  let lastError: Error | undefined;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fetchWithTimeout(url, options);
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries) {
        // Exponential backoff: wait 1s, then 2s
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

/**
 * GET /api/stock?symbol=XYZ
 * 
 * Server-side endpoint that aggregates data from multiple Finnhub endpoints:
 * - /quote - Current price and daily change
 * - /stock/profile2 - Company profile (name, logo, industry, market cap)
 * - /company-news - Last 14 days of news headlines
 * - /calendar/earnings - Next earnings date with EPS/revenue estimates
 * 
 * Returns a combined JSON payload with a computed Stock Score (0-100).
 * All API calls use cache: "no-store" to avoid stale data during development.
 * 
 * Future enhancement points:
 * - Add NewsAPI integration for additional news sources
 * - Add Financial Modeling Prep (FMP) for more financial metrics
 * - Add Reddit sentiment analysis via Reddit API
 */
export async function GET(request: NextRequest) {
  // Validate API key is configured
  if (!FINNHUB_API_KEY) {
    return NextResponse.json<ApiError>(
      { error: 'Server configuration error', details: 'API key not configured' },
      { status: 500 }
    );
  }

  // Extract symbol from query parameters
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol')?.toUpperCase();

  if (!symbol) {
    return NextResponse.json<ApiError>(
      { error: 'Missing required parameter', details: 'symbol is required' },
      { status: 400 }
    );
  }

  try {
    // Calculate date range for news (last 14 days)
    const today = new Date();
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);
    
    const toDate = today.toISOString().split('T')[0];
    const fromDate = twoWeeksAgo.toISOString().split('T')[0];

    // Fetch all data in parallel from Finnhub with retry logic and timeouts
    // Using cache: "no-store" to ensure fresh data during development
    const [quoteRes, profileRes, newsRes, earningsRes, financialsRes, recommendationsRes, priceTargetRes, newsAPIRes] = await Promise.all([
      // Quote endpoint - current price and daily change (CRITICAL - no fallback)
      fetchWithRetry(
        `${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
        { cache: 'no-store' }
      ),
      // Profile endpoint - company information (CRITICAL - no fallback)
      fetchWithRetry(
        `${FINNHUB_BASE_URL}/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
        { cache: 'no-store' }
      ),
      // News endpoint - last 14 days of company news (NON-CRITICAL - graceful degradation)
      fetchWithRetry(
        `${FINNHUB_BASE_URL}/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${FINNHUB_API_KEY}`,
        { cache: 'no-store' }
      ).catch(() => new Response(JSON.stringify([]), { status: 200 })),
      // Earnings calendar - upcoming earnings date and estimates (NON-CRITICAL - graceful degradation)
      fetchWithRetry(
        `${FINNHUB_BASE_URL}/calendar/earnings?symbol=${symbol}&from=${toDate}&to=${getFutureDate(90)}&token=${FINNHUB_API_KEY}`,
        { cache: 'no-store' }
      ).catch(() => new Response(JSON.stringify({ earningsCalendar: [] }), { status: 200 })),
      // Basic financials - comprehensive metrics (NON-CRITICAL - graceful degradation)
      fetchWithRetry(
        `${FINNHUB_BASE_URL}/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`,
        { cache: 'no-store' }
      ).catch(() => new Response(JSON.stringify(null), { status: 200 })),
      // Recommendation trends - analyst ratings (NON-CRITICAL - graceful degradation)
      fetchWithRetry(
        `${FINNHUB_BASE_URL}/stock/recommendation?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
        { cache: 'no-store' }
      ).catch(() => new Response(JSON.stringify([]), { status: 200 })),
      // Price target - analyst consensus targets (NON-CRITICAL - graceful degradation)
      fetchWithRetry(
        `${FINNHUB_BASE_URL}/stock/price-target?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
        { cache: 'no-store' }
      ).catch(() => new Response(JSON.stringify(null), { status: 200 })),
      // NewsAPI - placeholder (will be fetched after profile is available)
      Promise.resolve(null),
    ]);

    // Check for API errors on core endpoints
    if (!quoteRes.ok || !profileRes.ok) {
      throw new Error('Failed to fetch data from Finnhub API');
    }

    // Parse responses
    const quote: FinnhubQuote = await quoteRes.json();
    const profile: FinnhubProfile = await profileRes.json();
    const news: FinnhubNewsArticle[] = newsRes.ok ? await newsRes.json() : [];
    const earningsData: FinnhubEarnings = earningsRes.ok ? await earningsRes.json() : { earningsCalendar: [] };
    const financials: FinnhubBasicFinancials | null = financialsRes.ok ? await financialsRes.json() : null;
    const recommendations: FinnhubRecommendationTrend[] = recommendationsRes.ok ? await recommendationsRes.json() : [];
    const priceTarget: FinnhubPriceTarget | null = priceTargetRes.ok ? await priceTargetRes.json() : null;

    // Validate that we got valid data (profile name is a good indicator)
    if (!profile.name) {
      return NextResponse.json<ApiError>(
        { error: 'Invalid symbol', details: `No data found for symbol: ${symbol}` },
        { status: 404 }
      );
    }

    // Now fetch NewsAPI data using the company name
    // NewsAPI is NON-CRITICAL - failures here won't block the entire response
    // Using 15-minute cache to reduce API calls and prevent rate limiting
    let newsAPIArticles: NewsAPIArticle[] = [];
    let sentiment: SentimentAnalysis | undefined = undefined;

    if (NEWS_API_KEY && profile.name) {
      const cacheKey = `news_${symbol}_${profile.name}`;
      
      // Check cache first
      const cachedData = newsAPICache.get(cacheKey);
      if (cachedData) {
        newsAPIArticles = cachedData.articles || [];
        if (newsAPIArticles.length > 0) {
          sentiment = analyzeNewsSentiment(newsAPIArticles);
        }
      } else {
        // Fetch from NewsAPI if not cached
        try {
          const newsAPIUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
            profile.name
          )}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`;

          // Use fetchWithTimeout (no retry for NewsAPI due to rate limits)
          const newsAPIResponse = await fetchWithTimeout(newsAPIUrl, { cache: 'no-store' }, 8000);

          if (newsAPIResponse.ok) {
            const newsAPIData = await newsAPIResponse.json();
            
            // Handle rate limit response
            if (newsAPIData.status === 'error' && newsAPIData.code === 'rateLimited') {
              console.warn('NewsAPI rate limit exceeded - continuing without news sentiment');
            } else {
              newsAPIArticles = newsAPIData.articles || [];

              // Cache the successful response
              newsAPICache.set(cacheKey, { articles: newsAPIArticles });

              // Analyze sentiment if we have articles
              if (newsAPIArticles.length > 0) {
                sentiment = analyzeNewsSentiment(newsAPIArticles);
              }
            }
          } else if (newsAPIResponse.status === 429) {
            console.warn('NewsAPI rate limit exceeded (429) - continuing without news sentiment');
          }
        } catch (error) {
          // NewsAPI failures are logged but don't break the entire response
          console.warn('Failed to fetch NewsAPI data, continuing without it:', error);
          // Gracefully continue without NewsAPI data
        }
      }
    }

    // Extract next earnings event (first in the calendar)
    const nextEarnings: EarningsEvent | null = 
      earningsData.earningsCalendar && earningsData.earningsCalendar.length > 0
        ? earningsData.earningsCalendar[0]
        : null;

    // Fetch peer companies for industry comparison
    // This enables context-aware scoring relative to industry benchmarks
    const peerMetrics = await fetchPeerMetrics(symbol, profile.finnhubIndustry || 'Technology');

    // Compute intelligent Stock Score (0-100) using context-aware algorithm
    // Scores are normalized using z-scores and percentile rankings against industry peers
    const intelligentScore = calculateIntelligentStockScore(
      symbol,
      quote,
      financials,
      recommendations,
      priceTarget,
      peerMetrics,
      profile.finnhubIndustry || 'Technology'
    );

    // Combine all data into single response
    const stockData: StockData = {
      symbol: symbol,
      profile: profile,
      quote: quote,
      news: news,
      newsAPIArticles: newsAPIArticles.length > 0 ? newsAPIArticles : undefined,
      sentiment: sentiment,
      earnings: nextEarnings,
      financials: financials,
      recommendations: recommendations,
      priceTarget: priceTarget,
      stockScore: intelligentScore.score,
      scoreBreakdown: intelligentScore.breakdown,
      industryBenchmarks: intelligentScore.benchmarks,
    };

    return NextResponse.json<StockData>(stockData);

  } catch (error) {
    console.error('Error fetching stock data:', error);
    return NextResponse.json<ApiError>(
      { 
        error: 'Failed to fetch stock data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}



/**
 * Get a future date string in YYYY-MM-DD format
 */
function getFutureDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
}

/**
 * Fetch peer company metrics for industry comparison
 * Uses Finnhub's /stock/peers endpoint to get similar companies,
 * then fetches their financial metrics for benchmarking
 */
async function fetchPeerMetrics(symbol: string, industry: string): Promise<PeerMetrics[]> {
  try {
    // Fetch peer companies with retry logic
    const peersRes = await fetchWithRetry(
      `${FINNHUB_BASE_URL}/stock/peers?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
      { cache: 'no-store' }
    );

    if (!peersRes.ok) {
      console.warn('Failed to fetch peers, using empty peer list');
      return [];
    }

    const peers: string[] = await peersRes.json();
    
    // Limit to top 10 peers to avoid excessive API calls
    const limitedPeers = peers.slice(0, 10);

    // Fetch metrics for each peer in parallel with retry logic
    const peerMetricsPromises = limitedPeers.map(async (peerSymbol) => {
      try {
        const [quoteRes, metricsRes] = await Promise.all([
          fetchWithRetry(
            `${FINNHUB_BASE_URL}/quote?symbol=${peerSymbol}&token=${FINNHUB_API_KEY}`,
            { cache: 'no-store' }
          ).catch(() => null),
          fetchWithRetry(
            `${FINNHUB_BASE_URL}/stock/metric?symbol=${peerSymbol}&metric=all&token=${FINNHUB_API_KEY}`,
            { cache: 'no-store' }
          ).catch(() => null),
        ]);

        if (!quoteRes || !metricsRes || !quoteRes.ok || !metricsRes.ok) {
          return null;
        }

        const quoteData: FinnhubQuote = await quoteRes.json();
        const metricsData: FinnhubBasicFinancials = await metricsRes.json();

        const peerMetric: PeerMetrics = {
          symbol: peerSymbol,
          revenueGrowth: metricsData.metric?.revenueGrowthQuarterlyYoy ?? metricsData.metric?.revenueGrowthAnnual,
          epsGrowth: metricsData.metric?.epsGrowthQuarterlyYoy ?? metricsData.metric?.epsGrowthAnnual,
          roe: metricsData.metric?.roeRfy,
          netMargin: metricsData.metric?.netProfitMarginAnnual,
          operatingMargin: metricsData.metric?.operatingMarginAnnual,
          pe: metricsData.metric?.peNormalizedAnnual,
          pb: metricsData.metric?.pbAnnual,
          momentum1M: quoteData.dp, // Using daily change as proxy
          momentum3M: quoteData.dp, // Would need historical data for true 3M momentum
        };

        return peerMetric;
      } catch (error) {
        console.warn(`Failed to fetch metrics for peer ${peerSymbol}:`, error);
        return null;
      }
    });

    const results = await Promise.all(peerMetricsPromises);
    return results.filter((peer): peer is PeerMetrics => peer !== null);

  } catch (error) {
    console.error('Error fetching peer metrics:', error);
    return [];
  }
}
