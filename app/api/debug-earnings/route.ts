import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to test earnings calendar sorting
 * GET /api/debug-earnings?symbol=AAPL
 */

const FINNHUB_KEY = process.env.FINNHUB_KEY;
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol')?.toUpperCase() || 'AAPL';

  if (!FINNHUB_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  // Calculate date range
  const today = new Date();
  const toDate = today.toISOString().split('T')[0];
  
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + 120);
  const toDateFuture = futureDate.toISOString().split('T')[0];

  try {
    // Fetch earnings from Finnhub
    const url = `${FINNHUB_BASE_URL}/calendar/earnings?symbol=${symbol}&from=${toDate}&to=${toDateFuture}&token=${FINNHUB_KEY}`;
    const response = await fetch(url, { cache: 'no-store' });
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch from Finnhub' }, { status: response.status });
    }

    const data = await response.json();

    // Show raw data
    const rawEarnings = data.earningsCalendar || [];

    // Apply our sorting logic
    const sortedEarnings = [...rawEarnings].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Filter future dates
    const futureEarnings = sortedEarnings.filter(e => new Date(e.date) >= today);

    // Get the selected one
    const selected = futureEarnings.length > 0 ? futureEarnings[0] : null;

    return NextResponse.json({
      symbol,
      dateRange: {
        from: toDate,
        to: toDateFuture
      },
      apiUrl: url.replace(FINNHUB_KEY!, 'HIDDEN'),
      rawData: {
        count: rawEarnings.length,
        earnings: rawEarnings.map((e: any) => ({
          date: e.date,
          quarter: `Q${e.quarter} ${e.year}`,
          hour: e.hour,
          daysFromNow: Math.floor((new Date(e.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        }))
      },
      afterSorting: {
        count: sortedEarnings.length,
        earnings: sortedEarnings.map((e: any) => ({
          date: e.date,
          quarter: `Q${e.quarter} ${e.year}`,
          hour: e.hour,
          daysFromNow: Math.floor((new Date(e.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        }))
      },
      afterFiltering: {
        count: futureEarnings.length,
        earnings: futureEarnings.map((e: any) => ({
          date: e.date,
          quarter: `Q${e.quarter} ${e.year}`,
          hour: e.hour,
          daysFromNow: Math.floor((new Date(e.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        }))
      },
      selected: selected ? {
        date: selected.date,
        quarter: `Q${selected.quarter} ${selected.year}`,
        hour: selected.hour,
        daysFromNow: Math.floor((new Date(selected.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
        epsEstimate: selected.epsEstimate,
        revenueEstimate: selected.revenueEstimate
      } : null,
      verification: {
        yahooFinance: `https://finance.yahoo.com/quote/${symbol}`,
        nasdaq: `https://www.nasdaq.com/market-activity/stocks/${symbol.toLowerCase()}/earnings`,
        companyIR: `Search Google: "${symbol} investor relations earnings"`
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch earnings data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
