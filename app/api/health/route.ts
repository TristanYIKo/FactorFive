/**
 * Health Check Endpoint - /api/health
 * 
 * Simple endpoint to verify the API is running
 * Useful for Vercel deployment verification and monitoring
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
}
