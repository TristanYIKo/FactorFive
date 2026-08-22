/**
 * Home.
 *
 * A server component - the only interactivity is the search box and the
 * calendar, each isolated in its own client boundary. The old page was one
 * large `'use client'` component, so the whole thing shipped as JavaScript.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { TickerSearch } from '@/components/TickerSearch';
import MarketCalendar from '@/components/MarketCalendar';
import { getMarketCalendar } from '@/lib/marketCalendar';

const FACTORS = [
  {
    name: 'Growth',
    colour: 'var(--factor-growth)',
    detail: 'Revenue and EPS expansion, ranked against size-matched peers.',
  },
  {
    name: 'Profitability',
    colour: 'var(--factor-profitability)',
    detail: 'Return on equity and margin quality relative to the sector.',
  },
  {
    name: 'Valuation',
    colour: 'var(--factor-valuation)',
    detail: 'What you pay per unit of earnings and book value.',
  },
  {
    name: 'Quality',
    colour: 'var(--factor-quality)',
    detail: 'Leverage, liquidity and asset efficiency.',
  },
  {
    name: 'Analyst',
    colour: 'var(--factor-analyst)',
    detail: 'Consensus positioning across covering analysts.',
  },
];

const POPULAR = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'JPM'];

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <main className="mx-auto w-full max-w-4xl px-4 pt-16 pb-24 sm:px-6 sm:pt-24">
        <div className="ff-rise text-center">
          <div
            className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] text-[17px] font-bold"
            style={{ background: 'var(--accent)', color: '#fff', boxShadow: 'var(--shadow-md)' }}
          >
            F5
          </div>

          <h1
            className="text-[38px] leading-[1.1] font-semibold tracking-tight sm:text-[52px]"
            style={{ color: 'var(--text-primary)' }}
          >
            FactorFive
          </h1>

          <p
            className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed sm:text-[17px]"
            style={{ color: 'var(--text-secondary)' }}
          >
            Five-factor equity analysis, benchmarked against size-matched industry peers and the
            market it actually trades in.
          </p>
        </div>

        <div className="ff-rise mx-auto mt-9 max-w-xl" style={{ ['--delay' as string]: '80ms' }}>
          <TickerSearch autoFocus />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            <span className="mr-1 text-[12.5px]" style={{ color: 'var(--text-tertiary)' }}>
              Try
            </span>
            {POPULAR.map((s) => (
              <Link
                key={s}
                href={`/ticker/${s}`}
                className="rounded-[var(--radius-sm)] border px-2.5 py-1 text-[12.5px] font-medium transition-all hover:-translate-y-px"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                  background: 'var(--surface)',
                }}
              >
                {s}
              </Link>
            ))}
          </div>

          <p className="mt-4 text-center text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
            Press <kbd
              className="rounded border px-1.5 py-0.5 font-mono text-[11px]"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-subtle)' }}
            >/</kbd> anywhere to search
          </p>
        </div>

        {/* The five factors */}
        <div className="ff-rise mt-16" style={{ ['--delay' as string]: '160ms' }}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FACTORS.map((f, i) => (
              <div
                key={f.name}
                className="ff-fade rounded-[var(--radius-lg)] border p-4 transition-transform hover:-translate-y-0.5"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--surface)',
                  ['--delay' as string]: `${200 + i * 60}ms`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: f.colour }} />
                  <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {f.name}
                  </h2>
                  <span className="ml-auto text-[11.5px]" style={{ color: 'var(--text-tertiary)' }}>
                    20 pts
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {f.detail}
                </p>
              </div>
            ))}

            <div
              className="ff-fade rounded-[var(--radius-lg)] border border-dashed p-4"
              style={{ borderColor: 'var(--border-strong)', ['--delay' as string]: '500ms' }}
            >
              <h2 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                Every score shows its work
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Peer count, cohort quality and confidence sit next to the number. When the data is
                thin, the app says so instead of guessing.
              </p>
            </div>
          </div>
        </div>

        {/* Market calendar. Streams in behind the hero rather than blocking it,
            since the macro dates are fetched from FRED on the server. */}
        <div className="ff-rise mt-14" style={{ ['--delay' as string]: '240ms' }}>
          <Suspense fallback={<CalendarSkeleton />}>
            <CalendarSection />
          </Suspense>
        </div>

        <footer
          className="mt-16 border-t pt-6 text-center text-[12px]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}
        >
          <p>Market data from Finnhub · News from NewsAPI</p>
          <p className="mt-1">
            For research and education. Not investment advice, and not a recommendation to buy or
            sell any security.
          </p>
        </footer>
      </main>
    </div>
  );
}

/** Fetches on the server so FRED_API_KEY never reaches the browser. */
async function CalendarSection() {
  const events = await getMarketCalendar();
  return <MarketCalendar events={events} />;
}

function CalendarSkeleton() {
  return (
    <div
      className="rounded-[var(--radius-lg)] border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="space-y-2">
          <div className="ff-skeleton h-4 w-36" />
          <div className="ff-skeleton h-3 w-64" />
        </div>
        <div className="ff-skeleton h-8 w-40 rounded-[var(--radius-md)]" />
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-4 px-5 py-3.5">
            <div className="ff-skeleton h-9 w-12" />
            <div className="flex-1 space-y-2">
              <div className="ff-skeleton h-3.5 w-48" />
              <div className="ff-skeleton h-3 w-full max-w-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
