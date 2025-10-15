/**
 * Health Check Endpoint - /api/health
 * 
 * vercel-ready: Endpoint to verify deployment and environment configuration
 * 
 * Returns:
 * - ok: true if API is responding
 * - status: 'healthy'
 * - timestamp: Current server time
 * - environment: NODE_ENV value
 * - env: Check if required environment variables are set (without exposing values)
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // vercel-ready: Check environment variables without exposing secrets
  const hasNewsApiKey = !!process.env.NEWS_API_KEY;
  const hasFinnhubKey = !!process.env.FINNHUB_KEY;

  return NextResponse.json({
    ok: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    vercel: process.env.VERCEL === '1',
    env: {
      hasNewsApiKey,
      hasFinnhubKey,
    },
  });
}
