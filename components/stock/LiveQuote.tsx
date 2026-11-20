'use client';

/**
 * The price block, kept current while the page is open.
 *
 * The server renders the page with a fresh quote. This component then
 * re-checks /api/quote on the market's own clock: every 15 seconds during
 * regular hours, every minute in pre-market and after-hours, every five
 * minutes when the market is shut. It stops entirely while the tab is hidden
 * and catches up the moment it is shown again, so a tab left open overnight
 * never displays yesterday's price as if it were current.
 *
 * Everything that moves with the price lives here: the price and change, the
 * day's range, market cap (shares outstanding x live price, since the profile's
 * own market cap is cached for a week), and the 52-week range bar.
 */

import { useEffect, useState, type ReactNode } from 'react';
import type { FinnhubQuote } from '@/types/stock';
import type { MarketSession, SessionState } from '@/lib/marketHours';
import { Stat } from '@/components/ui/Primitives';
import { RangeBar, DeltaText } from '@/components/ui/Charts';
import { formatCurrency } from '@/lib/formatters';

const SESSION_LABEL: Record<SessionState, string> = {
  open: 'Market open',
  'pre-market': 'Pre-market',
  'after-hours': 'After hours',
  closed: 'Market closed',
};

const ET_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
});
const ET_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
});
/** en-CA formats as YYYY-MM-DD, matching MarketSession.date. */
const ET_DAY_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });

/**
 * When the quote is from, in New York time. The date is included whenever the
 * quote is not from today, so "4:00 PM" can never be mistaken for this
 * afternoon's close. Built from server-supplied values only, so the server
 * render and hydration always agree.
 */
function asOf(quoteTime: number, session: MarketSession): string {
  if (!quoteTime) return '';
  const at = new Date(quoteTime * 1000);
  const time = `${ET_TIME.format(at)} ET`;
  return ET_DAY_KEY.format(at) === session.date ? time : `${ET_DATE.format(at)}, ${time}`;
}

const usd = (v: number) => `$${v.toFixed(2)}`;

export function LiveQuote({
  symbol,
  identity,
  initialQuote,
  initialSession,
  renderedAt,
  high52,
  low52,
  sharesOutstandingM,
  fallbackMarketCap,
}: {
  symbol: string;
  /** Logo, name and exchange, rendered on the server. */
  identity: ReactNode;
  initialQuote: FinnhubQuote;
  initialSession: MarketSession;
  /** Server clock at render, ms. Detects a page restored from history. */
  renderedAt: number;
  high52?: number;
  low52?: number;
  /** Finnhub reports shares outstanding in millions. */
  sharesOutstandingM?: number;
  /** Used only when shares outstanding is unavailable. Dollars. */
  fallbackMarketCap?: number;
}) {
  const [quote, setQuote] = useState(initialQuote);
  const [session, setSession] = useState(initialSession);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let failures = 0;
    let lastCheckedAt = renderedAt;
    let refreshMs = initialSession.refreshMs;

    /** Wait until the next check is due. Clamped, so a skewed client clock can't stall it. */
    const scheduleNext = () => {
      clearTimeout(timer);
      const interval = refreshMs * 2 ** Math.min(failures, 3);
      const due = Math.min(interval, Math.max(0, lastCheckedAt + interval - Date.now()));
      timer = setTimeout(refresh, due);
    };

    async function refresh() {
      if (stopped || document.visibilityState !== 'visible') return;

      controller?.abort();
      controller = new AbortController();
      lastCheckedAt = Date.now();

      try {
        const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`quote ${res.status}`);
        const body = (await res.json()) as { quote?: FinnhubQuote; session?: MarketSession };
        if (stopped) return;

        // Finnhub answers an unknown or halted symbol with all zeros. Keep the
        // last real price rather than flashing $0.00.
        if (body.quote && body.quote.c > 0) setQuote(body.quote);
        if (body.session) {
          setSession(body.session);
          refreshMs = body.session.refreshMs;
        }
        failures = 0;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        // Keep the last good price on screen and back off: 2x, 4x, then 8x.
        failures += 1;
      }

      if (!stopped) scheduleNext();
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleNext();
      else clearTimeout(timer);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    // Due immediately if this render came back from the router cache or the
    // back/forward cache; otherwise one interval after the server rendered it.
    scheduleNext();

    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [symbol, renderedAt, initialSession.refreshMs]);

  const price = quote.c > 0 ? quote.c : undefined;
  const marketCap =
    price && sharesOutstandingM ? sharesOutstandingM * 1_000_000 * price : fallbackMarketCap;

  // Finnhub recomputes the 52-week high and low once a day, so on a day the
  // price breaks out of its range the live price would sit off the end of the
  // bar. Today is inside the 52 weeks, so today's own high and low belong in it.
  const rangeLow =
    low52 && price ? Math.min(low52, price, quote.l > 0 ? quote.l : Infinity) : undefined;
  const rangeHigh = high52 && price ? Math.max(high52, price, quote.h > 0 ? quote.h : 0) : undefined;

  const status = asOf(quote.t, session);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-5">
        {identity}

        <div className="text-right">
          <div
            className="tabular text-[30px] leading-none font-semibold tracking-tight sm:text-[34px]"
            style={{ color: 'var(--text-primary)' }}
          >
            {price ? usd(price) : '—'}
          </div>
          <div className="mt-1.5 text-[13px]">
            {typeof quote.dp === 'number' ? (
              <>
                <DeltaText value={quote.dp} />
                <span className="tabular ml-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  ({quote.d >= 0 ? '+' : ''}
                  {quote.d?.toFixed(2)})
                </span>
              </>
            ) : (
              <span style={{ color: 'var(--text-tertiary)' }}>no change data</span>
            )}
          </div>
          <div
            className="tabular mt-1.5 flex items-center justify-end gap-1.5 text-[11.5px]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: session.state === 'open' ? 'var(--positive)' : 'var(--text-tertiary)' }}
            />
            {SESSION_LABEL[session.state]}
            {status ? ` · ${status}` : ''}
          </div>
        </div>
      </div>

      <div
        className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 sm:grid-cols-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <Stat label="Open" value={quote.o ? usd(quote.o) : '—'} />
        <Stat
          label="Day range"
          value={quote.l && quote.h ? `${usd(quote.l)} - ${usd(quote.h)}` : '—'}
        />
        <Stat label="Prev close" value={quote.pc ? usd(quote.pc) : '—'} />
        <Stat label="Market cap" value={marketCap ? formatCurrency(marketCap) : '—'} />
      </div>

      {rangeLow !== undefined && rangeHigh !== undefined && price && (
        <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
          <div className="mb-2.5 flex items-baseline justify-between">
            <span
              className="text-[12px] font-medium tracking-wider uppercase"
              style={{ color: 'var(--text-tertiary)' }}
            >
              52-week range
            </span>
          </div>
          <RangeBar
            low={rangeLow}
            high={rangeHigh}
            current={price}
            lowLabel={usd(rangeLow)}
            highLabel={usd(rangeHigh)}
            currentLabel={usd(price)}
          />
        </div>
      )}
    </>
  );
}
