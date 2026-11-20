/**
 * U.S. equity market session, evaluated on the New York clock.
 *
 * Decides how often the ticker page re-checks its price, and what the status
 * line beside the price says. Holidays and early closes come from
 * nyseSchedule(), so this and the market calendar cannot disagree about
 * whether the market is open on a given day.
 *
 * Server-side only: the calendar module it reads from also holds the FRED
 * client. The browser receives a MarketSession as plain data, from the page
 * render and from every /api/quote response.
 */

import { nyseSchedule } from './marketCalendar';

export type SessionState = 'open' | 'pre-market' | 'after-hours' | 'closed';

export interface MarketSession {
  state: SessionState;
  /** Today's date in New York, YYYY-MM-DD. */
  date: string;
  /** How long a viewer should wait before re-checking the price, ms. */
  refreshMs: number;
}

const PRE_MARKET_OPEN = 4 * 60;
const REGULAR_OPEN = 9 * 60 + 30;
const REGULAR_CLOSE = 16 * 60;
const AFTER_HOURS_CLOSE = 20 * 60;

/**
 * Refresh cadence per state.
 *
 * Every refresh is a potential Finnhub request against a 60-per-minute budget
 * that a single cold analysis spends 15 of, so the cadence follows how fast the
 * price can actually move. During regular hours 15 seconds matches the quote's
 * server-side memo, so polling faster would only re-read the same value.
 * Outside them the price barely moves or does not move at all, and the slow
 * poll exists mainly to notice when the session changes.
 */
const REFRESH_MS: Record<SessionState, number> = {
  open: 15_000,
  'pre-market': 60_000,
  'after-hours': 60_000,
  closed: 5 * 60_000,
};

const NEW_YORK_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function newYorkClock(now: Date) {
  const parts = NEW_YORK_PARTS.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    year: Number(get('year')),
    weekday: get('weekday'),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function marketSession(now: Date = new Date()): MarketSession {
  const ny = newYorkClock(now);
  const { holidays, earlyCloses } = nyseSchedule(ny.year);

  let state: SessionState;
  if (ny.weekday === 'Sat' || ny.weekday === 'Sun' || holidays.some((h) => h.date === ny.date)) {
    state = 'closed';
  } else {
    const close = earlyCloses.find((e) => e.date === ny.date)?.closeMinutesET ?? REGULAR_CLOSE;
    if (ny.minutes < PRE_MARKET_OPEN) state = 'closed';
    else if (ny.minutes < REGULAR_OPEN) state = 'pre-market';
    else if (ny.minutes < close) state = 'open';
    else if (ny.minutes < AFTER_HOURS_CLOSE) state = 'after-hours';
    else state = 'closed';
  }

  return { state, date: ny.date, refreshMs: REFRESH_MS[state] };
}
