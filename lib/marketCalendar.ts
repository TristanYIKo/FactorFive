/**
 * U.S. market calendar — sourced events only.
 *
 * Every event here is either fetched from a source of record or computed from a
 * rule that DEFINES the event rather than approximating it. Nothing is guessed.
 *
 * Two kinds of certainty, and the distinction is the whole design:
 *
 *   FETCHED   Macro releases come from FRED, which publishes the statistical
 *             agencies' own release calendars including future dates. If FRED
 *             cannot be reached, those events are absent — never estimated.
 *
 *   DEFINED   Market holidays and options expiration are computed from the rule
 *             that constitutes them. Martin Luther King Jr. Day IS the third
 *             Monday in January; monthly options expiration IS the third Friday.
 *             These are not predictions, they are the definitions, so computing
 *             them is exact.
 *
 * What was removed, and why:
 *
 *   FOMC meetings       No free programmatic source. FRED's "FOMC Press Release"
 *                       (release 101) returns consecutive daily dates — an
 *                       artifact of how the series is tracked, not the meeting
 *                       schedule. Rather than hardcode a list that silently goes
 *                       stale, FOMC is omitted. See the note in docs/ARCHITECTURE.md.
 *
 *   Derived macro dates The old rules ("CPI around the 12th", "PPI follows CPI")
 *                       were wrong against FRED for September 2026: CPI Sep 11
 *                       not Sep 14, PPI Sep 10 not Sep 15 — and PPI actually
 *                       PRECEDES CPI that month, which the rule could not express.
 *
 *   Earnings seasons    "Reporting begins about two weeks after quarter end" is a
 *                       generalisation, not a date. Individual earnings dates
 *                       belong to a per-company feed, not a market calendar.
 */

import { fetchMacroReleases, type Impact } from './fred';

export type EventCategory = 'Economic Data' | 'Holiday' | 'Market Structure';

/** How we know this event happens. Rendered in the UI, never omitted. */
export type EventSource =
  /** Fetched from a source of record. */
  | { kind: 'published'; agency: string; via: string; url: string }
  /** Computed from the rule that defines the event. */
  | { kind: 'defined'; rule: string; url: string };

export interface MarketEvent {
  id: string;
  /**
   * Calendar date as YYYY-MM-DD.
   *
   * Deliberately a string, not a Date. `new Date('2026-09-11')` parses as UTC
   * midnight, which renders as September 10th for anyone west of Greenwich —
   * the single most common way calendars go quietly wrong. Callers that need a
   * Date build one in local time via `toLocalDate()`.
   */
  date: string;
  title: string;
  description: string;
  category: EventCategory;
  impact: Impact;
  source: EventSource;
}

// --- date helpers ----------------------------------------------------------

/** Build a local-midnight Date from YYYY-MM-DD, avoiding UTC-parse drift. */
export function toLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Nth occurrence of a weekday in a month. `n` is 1-based; month is 0-based. */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return toKey(year, month, 1 + offset + (n - 1) * 7);
}

/** Last occurrence of a weekday in a month. */
function lastWeekday(year: number, month: number, weekday: number): string {
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return toKey(year, month, last.getDate() - offset);
}

/** Anonymous Gregorian algorithm for Easter Sunday, used to find Good Friday. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * NYSE observance: a holiday falling on Saturday is observed the preceding
 * Friday, one falling on Sunday the following Monday.
 */
function observed(d: Date): string {
  const out = new Date(d);
  if (out.getDay() === 6) out.setDate(out.getDate() - 1);
  else if (out.getDay() === 0) out.setDate(out.getDate() + 1);
  return toKey(out.getFullYear(), out.getMonth(), out.getDate());
}

// --- defined events --------------------------------------------------------

const NYSE_URL = 'https://www.nyse.com/markets/hours-calendars';
const OCC_URL = 'https://www.optionseducation.org/referencelibrary/expiration-calendar';

/** NYSE market holidays. Computed from the statutory rule for each. */
function marketHolidays(year: number): MarketEvent[] {
  const goodFriday = new Date(easterSunday(year));
  goodFriday.setDate(goodFriday.getDate() - 2);

  const holidays: Array<{ date: string; name: string; rule: string }> = [
    { date: observed(new Date(year, 0, 1)), name: "New Year's Day", rule: 'January 1, weekend-observed' },
    { date: nthWeekday(year, 0, 1, 3), name: 'Martin Luther King Jr. Day', rule: 'Third Monday in January' },
    { date: nthWeekday(year, 1, 1, 3), name: "Presidents' Day", rule: 'Third Monday in February' },
    { date: toKey(goodFriday.getFullYear(), goodFriday.getMonth(), goodFriday.getDate()), name: 'Good Friday', rule: 'Friday before Easter Sunday' },
    { date: lastWeekday(year, 4, 1), name: 'Memorial Day', rule: 'Last Monday in May' },
    { date: observed(new Date(year, 5, 19)), name: 'Juneteenth', rule: 'June 19, weekend-observed' },
    { date: observed(new Date(year, 6, 4)), name: 'Independence Day', rule: 'July 4, weekend-observed' },
    { date: nthWeekday(year, 8, 1, 1), name: 'Labor Day', rule: 'First Monday in September' },
    { date: nthWeekday(year, 10, 4, 4), name: 'Thanksgiving Day', rule: 'Fourth Thursday in November' },
    { date: observed(new Date(year, 11, 25)), name: 'Christmas Day', rule: 'December 25, weekend-observed' },
  ];

  const events: MarketEvent[] = holidays.map((h) => ({
    id: `holiday-${h.date}`,
    date: h.date,
    title: `Market Closed — ${h.name}`,
    description: 'U.S. equity markets are closed. Bond markets follow a separate SIFMA schedule.',
    category: 'Holiday' as const,
    impact: 'low' as const,
    source: { kind: 'defined' as const, rule: h.rule, url: NYSE_URL },
  }));

  // The day after Thanksgiving is a standing 1:00 PM ET early close.
  const thanksgiving = toLocalDate(nthWeekday(year, 10, 4, 4));
  thanksgiving.setDate(thanksgiving.getDate() + 1);
  const blackFriday = toKey(thanksgiving.getFullYear(), thanksgiving.getMonth(), thanksgiving.getDate());

  events.push({
    id: `halfday-${blackFriday}`,
    date: blackFriday,
    title: 'Early Close — 1:00 PM ET',
    description: 'Shortened session the day after Thanksgiving. Volume is typically very light.',
    category: 'Holiday',
    impact: 'low',
    source: { kind: 'defined', rule: 'Day after Thanksgiving', url: NYSE_URL },
  });

  return events;
}

/**
 * Options expiration. Monthly contracts expire the third Friday; in March,
 * June, September and December stock options, index options and index futures
 * expire together, which is what "triple witching" names.
 *
 * Not "quadruple" — the fourth leg was single-stock futures, which stopped
 * trading in the U.S. when OneChicago closed in 2020.
 */
function optionsExpirations(year: number): MarketEvent[] {
  return Array.from({ length: 12 }, (_, month) => {
    const date = nthWeekday(year, month, 5, 3);
    const quarterly = month === 2 || month === 5 || month === 8 || month === 11;

    return {
      id: `opex-${date}`,
      date,
      title: quarterly ? 'Triple Witching' : 'Monthly Options Expiration',
      description: quarterly
        ? 'Stock options, index options and index futures all expire together. Volume and volatility are usually elevated into the close.'
        : 'Monthly equity and index options expire.',
      category: 'Market Structure' as const,
      impact: (quarterly ? 'medium' : 'low') as Impact,
      source: {
        kind: 'defined' as const,
        rule: 'Third Friday of the month',
        url: OCC_URL,
      },
    };
  });
}

// --- assembly --------------------------------------------------------------

const FRED_URL = 'https://fred.stlouisfed.org/releases';

/**
 * The calendar for a rolling window around `reference`: one month back so recent
 * releases stay visible, twelve months forward.
 *
 * Async because macro releases are fetched. Server-side only — it reads
 * FRED_API_KEY. Cached upstream, so repeat calls cost nothing.
 */
export async function getMarketCalendar(reference: Date = new Date()): Promise<MarketEvent[]> {
  const from = new Date(reference);
  from.setMonth(from.getMonth() - 1);
  const to = new Date(reference);
  to.setMonth(to.getMonth() + 12);

  const fromKey = toKey(from.getFullYear(), from.getMonth(), from.getDate());
  const toKeyStr = toKey(to.getFullYear(), to.getMonth(), to.getDate());

  const releases = await fetchMacroReleases(fromKey, toKeyStr);

  const macro: MarketEvent[] = releases.map((r) => ({
    id: `fred-${r.releaseId}-${r.date}`,
    date: r.date,
    title: r.spec.short,
    description: r.spec.description,
    category: 'Economic Data',
    impact: r.spec.impact,
    source: {
      kind: 'published',
      agency: r.spec.agency,
      via: 'FRED',
      url: `${FRED_URL}/${r.releaseId}`,
    },
  }));

  const defined: MarketEvent[] = [];
  for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
    defined.push(...marketHolidays(y), ...optionsExpirations(y));
  }

  return [...macro, ...defined]
    .filter((e) => e.date >= fromKey && e.date <= toKeyStr)
    .sort((a, b) => a.date.localeCompare(b.date) || impactRank(a.impact) - impactRank(b.impact));
}

function impactRank(impact: Impact): number {
  return impact === 'high' ? 0 : impact === 'medium' ? 1 : 2;
}

// --- client-side helpers (pure, operate on already-fetched events) ---------

/**
 * Index events by date once.
 *
 * Callers previously filtered the whole array per calendar cell — a linear scan
 * repeated 42 times per render. Build this once and look up in constant time.
 */
export function indexByDate(events: MarketEvent[]): Map<string, MarketEvent[]> {
  const map = new Map<string, MarketEvent[]>();
  for (const event of events) {
    const bucket = map.get(event.date);
    if (bucket) bucket.push(event);
    else map.set(event.date, [event]);
  }
  return map;
}

export function dateKey(date: Date): string {
  return toKey(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getUpcomingEvents(events: MarketEvent[], count = 12): MarketEvent[] {
  const today = dateKey(new Date());
  return events.filter((e) => e.date >= today).slice(0, count);
}
