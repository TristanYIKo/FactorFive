/**
 * Market Calendar API - /api/calendar
 * 
 * Uses NewsAPI to extract upcoming U.S. economic event dates from financial news articles.
 * Parses reliable sources (Bloomberg, Reuters, CNBC, MarketWatch, Yahoo Finance) to identify:
 * - FOMC meetings
 * - CPI, PPI reports
 * - JOLTS job openings
 * - University of Michigan Consumer Sentiment
 * - Retail Sales, Consumer Confidence
 * - GDP, Non-Farm Payrolls, ISM reports
 * 
 * Updates: Daily (24-hour cache)
 * Source: NewsAPI financial articles
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const NEWS_API_KEY = process.env.NEWS_API_KEY;

// 24-hour cache for calendar data
const calendarCache = new Map<string, { data: any; expires: number }>();

interface MarketEvent {
  id: string;
  date: string; // ISO format YYYY-MM-DD
  displayDate: string;
  time?: string;
  title: string;
  description: string;
  category: 'monetary' | 'inflation' | 'employment' | 'consumer' | 'growth' | 'other';
  impact: 'High' | 'Medium' | 'Low';
  icon: string;
  sources: string[]; // News sources that mentioned this event
  confidence: 'Verified' | 'Estimated'; // Verified if 2+ sources confirm
}

/**
 * Search queries for different event types
 */
const EVENT_SEARCH_QUERIES = [
  'FOMC meeting date',
  'Federal Reserve meeting schedule',
  'CPI release date inflation report',
  'PPI producer price index report',
  'JOLTS job openings report date',
  'University of Michigan consumer sentiment',
  'retail sales report date',
  'consumer confidence index release',
  'Non-Farm Payrolls jobs report',
  'GDP release date',
  'ISM manufacturing PMI report',
];

/**
 * Reliable financial news sources
 */
const TRUSTED_SOURCES = [
  'bloomberg',
  'reuters',
  'cnbc',
  'marketwatch',
  'yahoo finance',
  'the wall street journal',
  'financial times',
  'investing.com',
  'barrons',
];

/**
 * Categorize event based on keywords in title/description
 */
function categorizeEvent(text: string): {
  category: MarketEvent['category'];
  impact: MarketEvent['impact'];
  icon: string;
  eventName: string | null;
} {
  const lower = text.toLowerCase();

  // FOMC / Federal Reserve
  if (lower.includes('fomc') || lower.includes('federal reserve meeting') || 
      (lower.includes('fed') && (lower.includes('meeting') || lower.includes('decision')))) {
    return { 
      category: 'monetary', 
      impact: 'High', 
      icon: '🏛️',
      eventName: 'FOMC Meeting'
    };
  }

  // CPI
  if (lower.includes('cpi') || lower.includes('consumer price index')) {
    return { 
      category: 'inflation', 
      impact: 'High', 
      icon: '💹',
      eventName: 'Consumer Price Index (CPI)'
    };
  }

  // PPI
  if (lower.includes('ppi') || lower.includes('producer price index')) {
    return { 
      category: 'inflation', 
      impact: 'High', 
      icon: '💹',
      eventName: 'Producer Price Index (PPI)'
    };
  }

  // JOLTS
  if (lower.includes('jolts') || lower.includes('job openings')) {
    return { 
      category: 'employment', 
      impact: 'High', 
      icon: '🧾',
      eventName: 'JOLTS Job Openings Report'
    };
  }

  // Non-Farm Payrolls
  if (lower.includes('non-farm') || lower.includes('nonfarm') || 
      (lower.includes('payroll') && lower.includes('job'))) {
    return { 
      category: 'employment', 
      impact: 'High', 
      icon: '🧾',
      eventName: 'Non-Farm Payrolls Report'
    };
  }

  // Retail Sales
  if (lower.includes('retail sales')) {
    return { 
      category: 'growth', 
      impact: 'High', 
      icon: '🛍️',
      eventName: 'Retail Sales Report'
    };
  }

  // Consumer Sentiment (U of Michigan)
  if (lower.includes('michigan') || lower.includes('consumer sentiment')) {
    return { 
      category: 'consumer', 
      impact: 'Medium', 
      icon: '📊',
      eventName: 'University of Michigan Consumer Sentiment'
    };
  }

  // Consumer Confidence
  if (lower.includes('consumer confidence') || lower.includes('conference board')) {
    return { 
      category: 'consumer', 
      impact: 'Medium', 
      icon: '📊',
      eventName: 'Consumer Confidence Index'
    };
  }

  // GDP
  if (lower.includes('gdp') || lower.includes('gross domestic product')) {
    return { 
      category: 'growth', 
      impact: 'High', 
      icon: '📊',
      eventName: 'GDP Report'
    };
  }

  // ISM
  if (lower.includes('ism') || lower.includes('purchasing managers')) {
    return { 
      category: 'growth', 
      impact: 'Medium', 
      icon: '🏭',
      eventName: 'ISM Manufacturing Report'
    };
  }

  return { 
    category: 'other', 
    impact: 'Low', 
    icon: '📌',
    eventName: null
  };
}

/**
 * Extract dates from article text using various patterns
 */
function extractDates(text: string, publishedDate: Date): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Pattern 1: "on November 14", "on Dec 12", "on Jan 5"
  const onDatePattern = /on\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?/gi;
  let match;
  while ((match = onDatePattern.exec(text)) !== null) {
    const month = match[1];
    const day = parseInt(match[2]);
    const date = parseMonthDay(month, day, publishedDate.getFullYear());
    if (date && date >= today) {
      dates.push(date);
    }
  }

  // Pattern 2: "November 14", "Dec 12", "January 5th"
  const monthDayPattern = /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/gi;
  while ((match = monthDayPattern.exec(text)) !== null) {
    const month = match[1];
    const day = parseInt(match[2]);
    const year = match[3] ? parseInt(match[3]) : publishedDate.getFullYear();
    const date = parseMonthDay(month, day, year);
    if (date && date >= today) {
      dates.push(date);
    }
  }

  // Pattern 3: "due Wednesday", "next Thursday", "this Friday"
  const dayOfWeekPattern = /(next|this|upcoming)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/gi;
  while ((match = dayOfWeekPattern.exec(text)) !== null) {
    const date = getNextDayOfWeek(match[2], publishedDate);
    if (date && date >= today) {
      dates.push(date);
    }
  }

  // Pattern 4: ISO-like dates "2025-11-14"
  const isoPattern = /\b(202[5-9])-(\d{2})-(\d{2})\b/g;
  while ((match = isoPattern.exec(text)) !== null) {
    const date = new Date(match[0]);
    if (!isNaN(date.getTime()) && date >= today) {
      dates.push(date);
    }
  }

  return dates;
}

/**
 * Parse month name and day to Date object
 */
function parseMonthDay(monthStr: string, day: number, year: number): Date | null {
  const monthMap: { [key: string]: number } = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11,
  };

  const month = monthMap[monthStr.toLowerCase()];
  if (month === undefined || day < 1 || day > 31) return null;

  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;

  return date;
}

/**
 * Get the next occurrence of a day of week
 */
function getNextDayOfWeek(dayName: string, fromDate: Date): Date | null {
  const dayMap: { [key: string]: number } = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6,
  };

  const targetDay = dayMap[dayName.toLowerCase()];
  if (targetDay === undefined) return null;

  const result = new Date(fromDate);
  const currentDay = result.getDay();
  const daysUntilTarget = (targetDay - currentDay + 7) % 7;
  result.setDate(result.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));

  return result;
}

/**
 * Fetch news articles from NewsAPI for economic events
 */
async function fetchNewsArticles(query: string): Promise<any[]> {
  try {
    // Search for articles from the last 7 days
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    const fromStr = fromDate.toISOString().split('T')[0];

    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=20&from=${fromStr}&apiKey=${NEWS_API_KEY}`;

    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      console.warn(`[NewsAPI] Query "${query}" failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.articles || [];
  } catch (error) {
    console.error('[NewsAPI] Error fetching articles:', error);
    return [];
  }
}

/**
 * Parse news articles to extract upcoming economic events
 */
async function parseNewsForEvents(): Promise<MarketEvent[]> {
  const eventMap = new Map<string, MarketEvent>();

  console.log('[Calendar] Fetching news articles for economic events...');

  // Fetch articles for each search query
  for (const query of EVENT_SEARCH_QUERIES) {
    const articles = await fetchNewsArticles(query);
    console.log(`[Calendar] Query "${query}": ${articles.length} articles`);

    for (const article of articles) {
      // Skip if not from a trusted source
      const source = article.source?.name?.toLowerCase() || '';
      const isTrusted = TRUSTED_SOURCES.some(ts => source.includes(ts));
      if (!isTrusted && source) {
        continue; // Only process trusted sources
      }

      const text = `${article.title} ${article.description || ''}`;
      const publishedDate = new Date(article.publishedAt);

      // Categorize the event
      const { category, impact, icon, eventName } = categorizeEvent(text);
      if (!eventName) continue; // Skip if we can't identify the event type

      // Extract potential dates
      const dates = extractDates(text, publishedDate);

      for (const date of dates) {
        const dateKey = `${eventName}-${date.toISOString().split('T')[0]}`;
        
        if (eventMap.has(dateKey)) {
          // Add source to existing event
          const existing = eventMap.get(dateKey)!;
          if (!existing.sources.includes(article.source.name)) {
            existing.sources.push(article.source.name);
            // Update confidence if we now have 2+ sources
            if (existing.sources.length >= 2) {
              existing.confidence = 'Verified';
            }
          }
        } else {
          // Create new event
          const displayDate = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          eventMap.set(dateKey, {
            id: dateKey,
            date: date.toISOString().split('T')[0],
            displayDate,
            title: eventName,
            description: `${icon} ${eventName}`,
            category,
            impact,
            icon,
            sources: [article.source.name],
            confidence: 'Estimated',
          });
        }
      }
    }
  }

  // Convert map to array and sort by date
  const events = Array.from(eventMap.values()).sort((a, b) => 
    a.date.localeCompare(b.date)
  );

  console.log(`[Calendar] Extracted ${events.length} upcoming events from news`);
  return events;
}

/**
 * GET /api/calendar
 */
export async function GET() {
  const startTime = Date.now();

  try {
    if (!NEWS_API_KEY) {
      return NextResponse.json({
        error: 'Server configuration error: NEWS_API_KEY not set',
      }, { status: 500 });
    }

    // Check cache (24-hour TTL)
    const cacheKey = 'news_calendar';
    const cached = calendarCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expires > now) {
      const age = Math.round((now - (cached.expires - 24 * 60 * 60 * 1000)) / 1000);
      console.log(`[Calendar] Returning cached data (age: ${age}s)`);

      return NextResponse.json({
        events: cached.data,
        cached: true,
        cacheAge: age,
        timestamp: new Date().toISOString(),
        source: 'NewsAPI',
      });
    }

    // Parse news articles for events
    console.log('[Calendar] Parsing news articles...');
    const events = await parseNewsForEvents();

    // Cache for 24 hours
    calendarCache.set(cacheKey, {
      data: events,
      expires: now + 24 * 60 * 60 * 1000,
    });

    const duration = Date.now() - startTime;
    console.log(`[Calendar] API processed in ${duration}ms`);

    // Event breakdown
    const breakdown = {
      High: events.filter(e => e.impact === 'High').length,
      Medium: events.filter(e => e.impact === 'Medium').length,
      Low: events.filter(e => e.impact === 'Low').length,
      Verified: events.filter(e => e.confidence === 'Verified').length,
      Estimated: events.filter(e => e.confidence === 'Estimated').length,
    };

    return NextResponse.json({
      events,
      cached: false,
      count: events.length,
      breakdown,
      timestamp: new Date().toISOString(),
      duration,
      source: 'NewsAPI',
    }, {
      headers: {
        'Cache-Control': 'public, max-age=86400', // 24 hours
        'X-Response-Time': `${duration}ms`,
      },
    });

  } catch (error) {
    console.error('[Calendar] Error:', error);

    return NextResponse.json({
      error: 'Failed to fetch market calendar',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, {
      status: 500,
    });
  }
}
