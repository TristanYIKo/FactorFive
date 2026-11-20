/**
 * GET /api/quote?symbol=XYZ
 *
 * The price alone, so the ticker page can keep its price current without
 * re-running the whole analysis. Costs at most one Finnhub request and usually
 * none: the quote is memoised in-process for 15 seconds, concurrent callers
 * share one fetch, and the CDN holds each response for 5 seconds so viewers on
 * different instances share it too.
 *
 * Also returns the market session, so an open page notices the opening and
 * closing bell and changes its refresh cadence to match.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { finnhub } from '@/lib/finnhub';
import { SYMBOL_PATTERN } from '@/lib/getStockData';
import { marketSession } from '@/lib/marketHours';

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get('symbol') ?? '').trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }

  try {
    const quote = await finnhub.quote(symbol);
    return NextResponse.json(
      { quote, session: marketSession() },
      // No stale-while-revalidate: a stale price is exactly what this route
      // exists to prevent.
      { headers: { 'Cache-Control': 'public, s-maxage=5' } }
    );
  } catch (err) {
    console.error(`[api/quote] ${symbol}:`, err instanceof Error ? err.message : err);
    // The page keeps showing its last price and backs off; a 503 tells it the
    // failure is temporary.
    return NextResponse.json(
      { error: 'Quote temporarily unavailable' },
      { status: 503, headers: { 'Retry-After': '15', 'Cache-Control': 'no-store' } }
    );
  }
}
