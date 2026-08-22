/**
 * GET /api/health
 *
 * Deployment check plus live rate-limiter state. The limiter snapshot is the
 * useful part in production: if peer data starts thinning out, this shows
 * immediately whether the cause is an exhausted upstream window rather than
 * leaving it to be inferred from degraded scores.
 *
 * Reports only whether keys are present, never their values.
 */

import { NextResponse } from 'next/server';
import { limiterSnapshot, memoSize, inFlightCount } from '@/lib/upstream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const limiters = limiterSnapshot();

  return NextResponse.json({
    ok: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    vercel: process.env.VERCEL === '1',
    env: {
      hasNewsApiKey: !!process.env.NEWS_API_KEY,
      hasFinnhubKey: !!process.env.FINNHUB_KEY,
    },
    upstream: {
      finnhub: {
        ...limiters.finnhub,
        resetInMs: Math.max(0, limiters.finnhub.resetAt - Date.now()),
      },
      news: {
        ...limiters.news,
        resetInMs: Math.max(0, limiters.news.resetAt - Date.now()),
      },
      memoEntries: memoSize(),
      inFlight: inFlightCount(),
    },
  });
}
