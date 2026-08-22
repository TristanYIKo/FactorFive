/**
 * /ticker/[symbol]
 *
 * A server component. The previous version was `'use client'` and fetched in
 * useEffect, so the browser had to download the shell, boot the bundle, and
 * only then request data - three serial legs before anything appeared.
 *
 * Now the shell (nav, search, ticker name) streams immediately and the data
 * panels stream in behind a Suspense boundary as the server resolves them.
 * The skeleton is shape-matched to the real layout so nothing shifts when the
 * content lands.
 */

import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getStockData } from '@/lib/getStockData';
import { TickerSearch } from '@/components/TickerSearch';
import { PriceHeader } from '@/components/stock/PriceHeader';
import { ScorePanel } from '@/components/stock/ScorePanel';
import { MarketContextPanel } from '@/components/stock/MarketContextPanel';
import { PeerBenchmarks } from '@/components/stock/PeerBenchmarks';
import { SentimentPanel, AnalystPanel, NewsPanel } from '@/components/stock/NewsPanel';
import { Card, Skeleton, EmptyState } from '@/components/ui/Primitives';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const upper = decodeURIComponent(symbol).toUpperCase();
  return {
    title: `${upper} — FactorFive analysis`,
    description: `Five-factor analysis of ${upper}: growth, profitability, valuation, quality and analyst consensus, benchmarked against size-matched industry peers.`,
  };
}

export default async function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const upper = decodeURIComponent(symbol).toUpperCase();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <TopBar />

      <main className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">
        <Suspense fallback={<TickerSkeleton symbol={upper} />}>
          <StockContent symbol={upper} />
        </Suspense>
      </main>
    </div>
  );
}

function TopBar() {
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-xl"
      style={{
        borderColor: 'var(--border)',
        background: 'color-mix(in srgb, var(--bg-base) 82%, transparent)',
      }}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-primary)' }}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-[7px] text-[12px] font-bold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            F5
          </span>
          <span className="hidden sm:inline">FactorFive</span>
        </Link>

        <div className="ml-auto w-full max-w-sm">
          <TickerSearch size="compact" placeholder="Search ticker…" />
        </div>
      </div>
    </header>
  );
}

async function StockContent({ symbol }: { symbol: string }) {
  const result = await getStockData(symbol);

  if (!result.ok) {
    return (
      <div className="pt-10">
        <Card>
          <EmptyState
            title={result.error.error}
            detail={result.error.details}
          />
          <div className="mt-5 text-center">
            <Link
              href="/"
              className="inline-block rounded-[var(--radius-md)] px-4 py-2 text-[13.5px] font-medium transition-opacity hover:opacity-85"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Back to search
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const d = result.data;

  return (
    <div className="space-y-5 pt-6">
      <PriceHeader symbol={d.symbol} profile={d.profile} quote={d.quote} financials={d.financials} />

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div className="space-y-5">
          <ScorePanel score={d.stockScore} breakdown={d.scoreBreakdown} dataQuality={d.dataQuality} />
          <PeerBenchmarks
            benchmarks={d.industryBenchmarks}
            financials={d.financials}
            dataQuality={d.dataQuality}
          />
        </div>

        <div className="space-y-5">
          <MarketContextPanel context={d.marketContext} />
          <SentimentPanel sentiment={d.sentiment} articles={d.newsAPIArticles} />
          <AnalystPanel recommendations={d.recommendations} />
        </div>
      </div>

      <NewsPanel news={d.news} />

      {d.dataQuality && (
        <p className="tabular pt-1 text-center text-[11.5px]" style={{ color: 'var(--text-tertiary)' }}>
          Generated in {d.dataQuality.elapsedMs}ms ·{' '}
          {new Date(d.dataQuality.generatedAt).toLocaleTimeString('en-US')} · Data from Finnhub and
          NewsAPI · Not investment advice
        </p>
      )}
    </div>
  );
}

/** Shape-matched to StockContent so the layout does not shift on load. */
function TickerSkeleton({ symbol }: { symbol: string }) {
  return (
    <div className="space-y-5 pt-6">
      <Card>
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <Skeleton style={{ width: 52, height: 52, borderRadius: 'var(--radius-md)' }} />
            <div className="space-y-2">
              <div className="text-[22px] leading-tight font-semibold tracking-tight sm:text-[26px]"
                style={{ color: 'var(--text-primary)' }}>
                {symbol}
              </div>
              <Skeleton className="h-3.5 w-40" />
            </div>
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="ml-auto h-3.5 w-20" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 sm:grid-cols-4"
          style={{ borderColor: 'var(--border)' }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Card>
            <Skeleton className="mb-5 h-4 w-40" />
            <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:gap-8">
              <Skeleton style={{ width: 176, height: 176, borderRadius: '50%' }} />
              <div className="space-y-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card>
            <Skeleton className="mb-5 h-4 w-36" />
            <div className="space-y-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <Skeleton className="mb-4 h-4 w-32" />
            <Skeleton className="mb-2 h-3 w-full" />
            <Skeleton className="mb-2 h-3 w-11/12" />
            <Skeleton className="mb-5 h-3 w-4/5" />
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          </Card>
          <Card>
            <Skeleton className="mb-4 h-4 w-28" />
            <Skeleton className="h-2.5 w-full rounded-full" />
          </Card>
        </div>
      </div>
    </div>
  );
}
