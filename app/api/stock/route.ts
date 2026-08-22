/**
 * GET /api/stock?symbol=XYZ
 *
 * Thin HTTP wrapper over lib/getStockData.ts. The aggregation lives in the lib
 * so the ticker page can render on the server by calling it directly, without
 * a round trip to this endpoint. This route remains for external consumers and
 * for the concurrency benchmark in test-api-performance.js.
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import type { ApiError, StockData } from '@/types/stock';
import { getStockData } from '@/lib/getStockData';

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol') ?? '';
  const result = await getStockData(symbol);

  if (!result.ok) {
    return NextResponse.json<ApiError>(result.error, {
      status: result.status,
      headers: result.status === 503 ? { 'Retry-After': '5' } : undefined,
    });
  }

  return NextResponse.json<StockData>(result.data, {
    headers: {
      // Let Vercel's CDN serve repeat requests without invoking the function at
      // all, and keep serving slightly stale data while it refreshes. This is
      // what turns "N concurrent users" into "one upstream fetch".
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'X-Elapsed-Ms': String(result.data.dataQuality?.elapsedMs ?? 0),
      'X-Peers-Resolved': String(result.data.dataQuality?.peersResolved ?? 0),
    },
  });
}
