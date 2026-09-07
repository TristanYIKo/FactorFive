/**
 * Home.
 *
 * A server component - the only interactivity is the search box and the
 * calendar, each isolated in its own client boundary. The old page was one
 * large `'use client'` component, so the whole thing shipped as JavaScript.
 *
 * Layout intent. The page is built from four distinct compositions rather than
 * one repeated card grid:
 *
 *   1. an asymmetric split hero, copy left and a live component preview right;
 *   2. the score anatomy, a 100-point rail segmented into the five factors;
 *   3. the market calendar, a dated table;
 *   4. the footer.
 *
 * The preview on the right is built from the same `ScoreGauge` and `FactorBar`
 * the ticker page uses, not a mock-up drawn in divs. It carries an "Example"
 * tag because the figures are illustrative: fetching a real quote here would
 * spend Finnhub budget on every revalidation and give the hero a failure mode
 * it does not need.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { TickerSearch } from '@/components/TickerSearch';
import MarketCalendar from '@/components/MarketCalendar';
import { getMarketCalendar } from '@/lib/marketCalendar';
import { Panel, PanelHeader, Tag } from '@/components/ui/Dense';
import { ScoreGauge, FactorBar } from '@/components/ui/Charts';

/**
 * The five factors.
 *
 * `points` is the real weight each factor carries in the 0-100 score. `example`
 * and `percentile` are illustrative only, and every surface that renders them
 * is tagged as such.
 */
const FACTORS = [
  {
    name: 'Growth',
    colour: 'var(--factor-growth)',
    points: 20,
    example: 14,
    percentile: 68,
    detail: 'Revenue and EPS expansion, ranked against size-matched peers.',
  },
  {
    name: 'Profitability',
    colour: 'var(--factor-profitability)',
    points: 20,
    example: 16,
    percentile: 81,
    detail: 'Return on equity and margin quality relative to the sector.',
  },
  {
    name: 'Valuation',
    colour: 'var(--factor-valuation)',
    points: 20,
    example: 11,
    percentile: 44,
    detail: 'What you pay per unit of earnings and book value.',
  },
  {
    name: 'Quality',
    colour: 'var(--factor-quality)',
    points: 20,
    example: 15,
    percentile: 74,
    detail: 'Leverage, liquidity and asset efficiency.',
  },
  {
    name: 'Analyst',
    colour: 'var(--factor-analyst)',
    points: 20,
    example: 16,
    percentile: 79,
    detail: 'Consensus positioning across covering analysts.',
  },
];

/** Sums to the score shown on the example gauge, so the preview is internally consistent. */
const EXAMPLE_SCORE = FACTORS.reduce((total, f) => total + f.example, 0);

/**
 * Regenerate hourly.
 *
 * Without this the route is fully static, so the calendar is baked in at build
 * time and frozen there. The "upcoming" list would keep showing the same dates
 * as they slid into the past, and a newly added FRED key would not take effect
 * until the next deploy. An hour is far finer than the data moves (agencies
 * publish schedules months ahead) while keeping the window rolling.
 */
export const revalidate = 3600;

const POPULAR = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'JPM'];

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6">
        {/* ---------------------------------------------------------- hero - */}
        <section className="grid items-center gap-10 pt-12 sm:pt-16 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
          <div className="ff-rise">
            <h1
              className="text-[34px] leading-[1.08] font-semibold tracking-tight sm:text-[44px]"
              style={{ color: 'var(--text-primary)' }}
            >
              Equity analysis that shows its work.
            </h1>

            <p
              className="mt-5 max-w-[52ch] text-[15.5px] leading-relaxed sm:text-[16px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Growth, profitability, valuation, quality and analyst consensus, benchmarked against
              size-matched industry peers. When the data is thin, it says so.
            </p>

            <div className="mt-7 max-w-xl">
              <TickerSearch autoFocus />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[12.5px]" style={{ color: 'var(--text-tertiary)' }}>
                Try
              </span>
              {POPULAR.map((s) => (
                <Link
                  key={s}
                  href={`/ticker/${s}`}
                  className="tabular rounded-[var(--radius-sm)] border px-2.5 py-1 font-mono text-[12px] font-medium transition-all hover:-translate-y-px"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--text-secondary)',
                    background: 'var(--surface)',
                  }}
                >
                  {s}
                </Link>
              ))}
              <span className="ml-1 text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                or press{' '}
                <kbd
                  className="rounded border px-1.5 py-0.5 font-mono text-[11px]"
                  style={{ borderColor: 'var(--border-strong)', background: 'var(--bg-subtle)' }}
                >
                  /
                </kbd>
              </span>
            </div>
          </div>

          <div className="ff-rise" style={{ ['--delay' as string]: '120ms' }}>
            <ScoreAnatomyPreview />
          </div>
        </section>

        {/* -------------------------------------------------- score anatomy - */}
        <section className="mt-24 sm:mt-28">
          <div className="max-w-2xl">
            <h2
              className="text-[24px] leading-tight font-semibold tracking-tight sm:text-[28px]"
              style={{ color: 'var(--text-primary)' }}
            >
              Five factors, twenty points each.
            </h2>
            <p
              className="mt-3 text-[14.5px] leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              Peer count, cohort quality and confidence sit next to the number rather than behind a
              tooltip. A score built on two peers is labelled as one, not presented as though it
              were built on twenty.
            </p>
          </div>

          {/* The 100-point rail. Each segment is one factor, and the rule above
              each definition below repeats its colour so the two read as one
              object rather than a chart and an unrelated list. */}
          <div className="mt-10 flex gap-0.5" aria-hidden="true">
            {FACTORS.map((f) => (
              <div
                key={f.name}
                className="h-2.5 flex-1 first:rounded-l-[var(--radius-sm)] last:rounded-r-[var(--radius-sm)]"
                style={{ background: f.colour }}
              />
            ))}
          </div>

          <div className="mt-6 grid gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-5">
            {FACTORS.map((f, i) => (
              <div
                key={f.name}
                className="ff-fade"
                style={{ ['--delay' as string]: `${i * 60}ms` }}
              >
                <div className="h-0.5 w-8" style={{ background: f.colour }} />
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <h3 className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {f.name}
                  </h3>
                  <span
                    className="tabular font-mono text-[11px]"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {f.points}
                  </span>
                </div>
                <p
                  className="mt-1.5 text-[13px] leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {f.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Market calendar. Streams in behind the hero rather than blocking it,
            since the macro dates are fetched from FRED on the server. */}
        <section className="ff-rise mt-20 sm:mt-24" style={{ ['--delay' as string]: '80ms' }}>
          <Suspense fallback={<CalendarSkeleton />}>
            <CalendarSection />
          </Suspense>
        </section>

        <footer
          className="mt-20 flex flex-col gap-2 border-t pt-6 text-[12px] sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}
        >
          <p>Market data from Finnhub. News from NewsAPI.</p>
          <p className="max-w-md sm:text-right">
            For research and education. Not investment advice, and not a recommendation to buy or
            sell any security.
          </p>
        </footer>
      </main>
    </div>
  );
}

/**
 * Wordmark row.
 *
 * Matches the ticker page's TopBar treatment so the two surfaces read as one
 * product, and keeps the brand out of the hero's own stack.
 */
function SiteHeader() {
  return (
    <header className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6">
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-md)] text-[12px] font-bold"
          style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
        >
          F5
        </span>
        <span
          className="text-[15px] font-semibold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          FactorFive
        </span>
      </div>
    </header>
  );
}

/**
 * The hero's visual.
 *
 * Assembled from the real `ScoreGauge` and `FactorBar` the ticker page renders,
 * so what a visitor sees here is the actual component they will meet after
 * searching. The figures are illustrative and tagged accordingly.
 */
function ScoreAnatomyPreview() {
  return (
    <Panel>
      <PanelHeader title="How a score is built" action={<Tag>Example</Tag>} />

      <div className="px-4 py-5 sm:px-5">
        <div className="flex justify-center">
          <ScoreGauge score={EXAMPLE_SCORE} confidence="high" size={148} />
        </div>

        <div className="mt-6 space-y-3.5">
          {FACTORS.map((f, i) => (
            <FactorBar
              key={f.name}
              label={f.name}
              score={f.example}
              percentile={f.percentile}
              colour={f.colour}
              delay={220 + i * 70}
            />
          ))}
        </div>
      </div>
    </Panel>
  );
}

/** Fetches on the server so FRED_API_KEY never reaches the browser. */
async function CalendarSection() {
  const { events, macro } = await getMarketCalendar();
  return <MarketCalendar events={events} macro={macro} />;
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
