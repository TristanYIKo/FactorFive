/**
 * NewsAPI Endpoint - /api/news?symbol=AAPL
 * 
 * Fetches recent news articles from NewsAPI for a given stock ticker
 * 
 * Flow:
 * 1. Resolve ticker symbol to company name via Finnhub
 * 2. Fetch top 20 recent articles from NewsAPI using company name
 * 3. Analyze sentiment of headlines
 * 4. Return articles with sentiment analysis
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { NewsAPIArticle, SentimentAnalysis } from '@/types/stock';
import { analyzeNewsSentiment } from '@/lib/sentiment';
import { newsAPICache } from '@/lib/cache';

const FINNHUB_KEY = process.env.FINNHUB_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

/**
 * GET /api/news?symbol=AAPL
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol')?.toUpperCase();

  // Validate inputs
  if (!symbol) {
    return NextResponse.json(
      { error: 'Missing required parameter: symbol' },
      { status: 400 }
    );
  }

  if (!FINNHUB_KEY) {
    return NextResponse.json(
      { error: 'Server configuration error: FINNHUB_KEY not set' },
      { status: 500 }
    );
  }

  if (!NEWS_API_KEY) {
    return NextResponse.json(
      { error: 'Server configuration error: NEWS_API_KEY not set' },
      { status: 500 }
    );
  }

  try {
    // Step 1: Get company name from Finnhub
    const profileResponse = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`,
      { cache: 'no-store' }
    );

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch company profile from Finnhub');
    }

    const profile = await profileResponse.json();
    const companyName = profile.name;

    if (!companyName) {
      return NextResponse.json(
        { error: `Company name not found for symbol: ${symbol}` },
        { status: 404 }
      );
    }

    // Step 2: Fetch news from NewsAPI (with 15-minute cache)
    const cacheKey = `news_${symbol}_${companyName}`;
    let articles: NewsAPIArticle[] = [];
    let totalResults = 0;
    
    // Check cache first
    const cachedData = newsAPICache.get(cacheKey);
    if (cachedData) {
      articles = cachedData.articles || [];
      totalResults = cachedData.totalResults || 0;
    } else {
      // Fetch from NewsAPI if not cached
      const newsAPIUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
        companyName
      )}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`;

      const newsResponse = await fetch(newsAPIUrl, { cache: 'no-store' });

      if (!newsResponse.ok) {
        const errorData = await newsResponse.json();
        throw new Error(
          `NewsAPI error: ${errorData.message || 'Failed to fetch news'}`
        );
      }

      const newsData = await newsResponse.json();
      articles = newsData.articles || [];
      totalResults = newsData.totalResults || 0;
      
      // Cache the successful response
      newsAPICache.set(cacheKey, { articles, totalResults });
    }

    // Step 3: Analyze sentiment
    const sentiment: SentimentAnalysis = analyzeNewsSentiment(articles);

    // Return response
    return NextResponse.json({
      symbol,
      companyName,
      articles,
      sentiment,
      totalResults,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch news data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
