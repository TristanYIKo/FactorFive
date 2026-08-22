/**
 * Rolling U.S. market calendar.
 *
 * The previous implementation hardcoded 2025 dates - FOMC meetings, holidays,
 * earnings windows, and even two one-off "November 2025" overrides. Every date
 * it produced is now in the past, so the calendar tab has been showing a stale
 * year to every visitor.
 *
 * This version derives every event from the publishing rules the agencies
 * actually follow, relative to whatever today is, so it stays correct without
 * anyone editing it:
 *
 *   Employment Situation  first Friday, 08:30 ET            (BLS)
 *   CPI                   ~10th-13th, 08:30 ET              (BLS)
 *   PPI                   day after CPI, 08:30 ET           (BLS)
 *   JOLTS                 ~first Tuesday, 10:00 ET          (BLS)
 *   Retail Sales          ~15th, 08:30 ET                   (Census)
 *   Consumer Sentiment    2nd and 4th Friday, 10:00 ET      (U. Michigan)
 *   GDP                   ~last Thursday after quarter end  (BEA)
 *   FOMC                  eight meetings a year             (Federal Reserve)
 *   Holidays              computed, incl. weekend observance (NYSE)
 *   Earnings season       ~2 weeks after quarter end, 5wks
 *
 * IMPORTANT ON ACCURACY: only market holidays and the weekday-rule releases
 * (Employment Situation, Consumer Sentiment, JOLTS) are exactly determined.
 * The rest - especially FOMC - are marked `confidence: 'estimated'` and carry
 * a source link. Do not present an estimated date as a scheduled one; the UI
 * reads this field and labels accordingly.
 */

export interface MarketEvent {
  id: string;
  date: Date;
  title: string;
  description: string;
  category: 'FOMC' | 'Economic Data' | 'Earnings Season' | 'Holiday' | 'Other';
  impact: 'High' | 'Medium' | 'Low';
  time?: string;
  isRecurring?: boolean;
  /**
   * 'scheduled' - determined by a fixed rule (holidays, first-Friday releases).
   * 'estimated' - follows the usual pattern but should be confirmed.
   */
  confidence: 'scheduled' | 'estimated';
  /** Authoritative source for the real date. */
  source?: string;
}

// --- date helpers ----------------------------------------------------------

/** Nth occurrence of a weekday in a month. `n` is 1-based; month is 0-based. */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
}

/** Last occurrence of a weekday in a month. */
function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(Date.UTC(year, month + 1, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month + 1, 0 - offset));
}

/** Move a date forward to the next weekday if it lands on a weekend. */
function nextBusinessDay(date: Date): Date {
  const d = new Date(date);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
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
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * NYSE observance: a holiday falling on Saturday is observed the preceding
 * Friday, and one falling on Sunday the following Monday.
 */
function observed(date: Date): Date {
  const d = new Date(date);
  if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  else if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function iso(date: Date): string {
  return date.toISOString().split('T')[0];
}

// --- event generators ------------------------------------------------------

const BLS = 'https://www.bls.gov/schedule/news_release/';
const FED = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
const CENSUS = 'https://www.census.gov/economic-indicators/';
const BEA = 'https://www.bea.gov/news/schedule';
const UMICH = 'https://www.sca.isr.umich.edu/';

/** Monthly economic releases for one calendar month. */
function monthlyReleases(year: number, month: number): MarketEvent[] {
  const events: MarketEvent[] = [];
  const monthName = new Date(Date.UTC(year, month, 1)).toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });
  const priorMonth = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  });

  // Employment Situation - first Friday. This one is a firm rule.
  events.push({
    id: `nfp-${year}-${month}`,
    date: nthWeekday(year, month, 5, 1),
    title: 'Employment Situation (Non-Farm Payrolls)',
    description: `${priorMonth} payrolls, unemployment rate and average hourly earnings. Typically the highest-volatility scheduled release of the month.`,
    category: 'Economic Data',
    impact: 'High',
    time: '8:30 AM ET',
    isRecurring: true,
    confidence: 'scheduled',
    source: BLS,
  });

  // CPI - BLS targets the 10th-13th. Nudge off weekends.
  const cpiDate = nextBusinessDay(new Date(Date.UTC(year, month, 12)));
  events.push({
    id: `cpi-${year}-${month}`,
    date: cpiDate,
    title: 'Consumer Price Index (CPI)',
    description: `${priorMonth} headline and core inflation. The single most closely watched input to Fed rate expectations.`,
    category: 'Economic Data',
    impact: 'High',
    time: '8:30 AM ET',
    isRecurring: true,
    confidence: 'estimated',
    source: BLS,
  });

  // PPI - usually the day after CPI.
  const ppiDate = nextBusinessDay(new Date(cpiDate.getTime() + 86400000));
  events.push({
    id: `ppi-${year}-${month}`,
    date: ppiDate,
    title: 'Producer Price Index (PPI)',
    description: `${priorMonth} wholesale prices. Often a leading indicator for consumer inflation.`,
    category: 'Economic Data',
    impact: 'Medium',
    time: '8:30 AM ET',
    isRecurring: true,
    confidence: 'estimated',
    source: BLS,
  });

  // JOLTS - roughly the first Tuesday, reporting two months back.
  events.push({
    id: `jolts-${year}-${month}`,
    date: nthWeekday(year, month, 2, 1),
    title: 'JOLTS Job Openings',
    description: 'Job openings, hires and quits. Read as a gauge of labour-market slack.',
    category: 'Economic Data',
    impact: 'Medium',
    time: '10:00 AM ET',
    isRecurring: true,
    confidence: 'estimated',
    source: BLS,
  });

  // Retail Sales - around the 15th.
  events.push({
    id: `retail-${year}-${month}`,
    date: nextBusinessDay(new Date(Date.UTC(year, month, 15))),
    title: 'Retail Sales',
    description: `${priorMonth} consumer spending. Roughly two-thirds of U.S. GDP runs through the consumer.`,
    category: 'Economic Data',
    impact: 'High',
    time: '8:30 AM ET',
    isRecurring: true,
    confidence: 'estimated',
    source: CENSUS,
  });

  // U. Michigan Consumer Sentiment - preliminary 2nd Friday, final 4th Friday.
  events.push({
    id: `umich-prelim-${year}-${month}`,
    date: nthWeekday(year, month, 5, 2),
    title: 'Consumer Sentiment (Preliminary)',
    description: `${monthName} University of Michigan sentiment index, including inflation expectations.`,
    category: 'Economic Data',
    impact: 'Medium',
    time: '10:00 AM ET',
    isRecurring: true,
    confidence: 'scheduled',
    source: UMICH,
  });

  events.push({
    id: `umich-final-${year}-${month}`,
    date: nthWeekday(year, month, 5, 4),
    title: 'Consumer Sentiment (Final)',
    description: `Final ${monthName} reading of the University of Michigan sentiment index.`,
    category: 'Economic Data',
    impact: 'Low',
    time: '10:00 AM ET',
    isRecurring: true,
    confidence: 'scheduled',
    source: UMICH,
  });

  // GDP - advance estimate in the month after a quarter ends (Jan/Apr/Jul/Oct).
  if (month % 3 === 0) {
    const q = ((month / 3 + 3) % 4) + 1;
    events.push({
      id: `gdp-${year}-${month}`,
      date: lastWeekday(year, month, 4),
      title: `GDP - Q${q} Advance Estimate`,
      description: 'First official read on quarterly economic growth. Revised twice in later months.',
      category: 'Economic Data',
      impact: 'High',
      time: '8:30 AM ET',
      isRecurring: true,
      confidence: 'estimated',
      source: BEA,
    });
  }

  return events;
}

/**
 * FOMC meetings for a year.
 *
 * The Fed holds eight meetings annually, roughly every six to seven weeks, in
 * the months below. Exact dates are published years ahead but are NOT derivable
 * from a rule, so these are flagged as estimates with a link to the official
 * calendar. Replacing this with the published schedule - or a scraped feed - is
 * the obvious upgrade.
 */
function fomcMeetings(year: number): MarketEvent[] {
  // Month index and which Tuesday/Wednesday pair the meeting usually falls on.
  const pattern: Array<{ month: number; nth: number }> = [
    { month: 0, nth: 4 }, // late January
    { month: 2, nth: 3 }, // mid March
    { month: 4, nth: 1 }, // early May
    { month: 5, nth: 3 }, // mid June
    { month: 6, nth: 4 }, // late July
    { month: 8, nth: 3 }, // mid September
    { month: 10, nth: 1 }, // early November
    { month: 11, nth: 2 }, // mid December
  ];

  return pattern.map(({ month, nth }, i) => {
    // Meetings run Tuesday-Wednesday; the decision lands on the Wednesday.
    const decision = nthWeekday(year, month, 3, nth);
    const isProjectionMeeting = [2, 5, 8, 11].includes(month);

    return {
      id: `fomc-${year}-${i + 1}`,
      date: decision,
      title: 'FOMC Rate Decision',
      description: isProjectionMeeting
        ? 'Federal Reserve interest rate decision, plus updated economic projections and the dot plot. Press conference follows.'
        : 'Federal Reserve interest rate decision and policy statement. Press conference follows.',
      category: 'FOMC' as const,
      impact: 'High' as const,
      time: '2:00 PM ET',
      isRecurring: true,
      confidence: 'estimated' as const,
      source: FED,
    };
  });
}

/** NYSE market holidays for a year, with weekend observance applied. */
function marketHolidays(year: number): MarketEvent[] {
  const goodFriday = new Date(easterSunday(year).getTime() - 2 * 86400000);

  const holidays: Array<{ date: Date; name: string }> = [
    { date: observed(new Date(Date.UTC(year, 0, 1))), name: "New Year's Day" },
    { date: nthWeekday(year, 0, 1, 3), name: 'Martin Luther King Jr. Day' },
    { date: nthWeekday(year, 1, 1, 3), name: "Presidents' Day" },
    { date: goodFriday, name: 'Good Friday' },
    { date: lastWeekday(year, 4, 1), name: 'Memorial Day' },
    { date: observed(new Date(Date.UTC(year, 5, 19))), name: 'Juneteenth' },
    { date: observed(new Date(Date.UTC(year, 6, 4))), name: 'Independence Day' },
    { date: nthWeekday(year, 8, 1, 1), name: 'Labor Day' },
    { date: nthWeekday(year, 10, 4, 4), name: 'Thanksgiving Day' },
    { date: observed(new Date(Date.UTC(year, 11, 25))), name: 'Christmas Day' },
  ];

  return holidays.map((h) => ({
    id: `holiday-${year}-${iso(h.date)}`,
    date: h.date,
    title: `Market Closed - ${h.name}`,
    description: 'U.S. equity markets are closed. Bond markets may follow a different schedule.',
    category: 'Holiday' as const,
    impact: 'Low' as const,
    isRecurring: true,
    confidence: 'scheduled' as const,
    source: 'https://www.nyse.com/markets/hours-calendars',
  }));
}

/** Quarterly earnings season windows. */
function earningsSeasons(year: number): MarketEvent[] {
  // Reporting for quarter Q starts roughly two weeks after it ends.
  const quarters = [
    { endMonth: 11, endYear: year - 1, label: `Q4 ${year - 1}`, startMonth: 0 },
    { endMonth: 2, endYear: year, label: `Q1 ${year}`, startMonth: 3 },
    { endMonth: 5, endYear: year, label: `Q2 ${year}`, startMonth: 6 },
    { endMonth: 8, endYear: year, label: `Q3 ${year}`, startMonth: 9 },
  ];

  return quarters.map((q) => ({
    id: `earnings-${year}-${q.label.replace(/\s+/g, '')}`,
    date: nextBusinessDay(new Date(Date.UTC(year, q.startMonth, 13))),
    title: `${q.label} Earnings Season Begins`,
    description: `Large banks typically report first, with the bulk of the S&P 500 following over the next five weeks.`,
    category: 'Earnings Season' as const,
    impact: 'Medium' as const,
    isRecurring: true,
    confidence: 'estimated' as const,
  }));
}

// --- public API ------------------------------------------------------------

/**
 * Build the calendar for a rolling window around `startDate`: one month back
 * (so recent releases stay visible) through twelve months forward.
 */
export function generateMarketCalendar(startDate: Date = new Date()): MarketEvent[] {
  const events: MarketEvent[] = [];

  const from = new Date(startDate);
  from.setMonth(from.getMonth() - 1);
  const to = new Date(startDate);
  to.setMonth(to.getMonth() + 12);

  // Years touched by the window.
  const years = new Set<number>();
  for (let y = from.getFullYear(); y <= to.getFullYear(); y++) years.add(y);

  for (const year of years) {
    events.push(...fomcMeetings(year));
    events.push(...marketHolidays(year));
    events.push(...earningsSeasons(year));
  }

  // Monthly releases, month by month across the window.
  const cursor = new Date(Date.UTC(from.getFullYear(), from.getMonth(), 1));
  while (cursor <= to) {
    events.push(...monthlyReleases(cursor.getUTCFullYear(), cursor.getUTCMonth()));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return events
    .filter((e) => e.date >= from && e.date <= to)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function groupEventsByMonth(events: MarketEvent[]): Map<string, MarketEvent[]> {
  const grouped = new Map<string, MarketEvent[]>();
  for (const event of events) {
    const key = `${event.date.getFullYear()}-${String(event.date.getMonth() + 1).padStart(2, '0')}`;
    const bucket = grouped.get(key);
    if (bucket) bucket.push(event);
    else grouped.set(key, [event]);
  }
  return grouped;
}

export function getEventsForDate(events: MarketEvent[], date: Date): MarketEvent[] {
  return events.filter(
    (e) =>
      e.date.getFullYear() === date.getFullYear() &&
      e.date.getMonth() === date.getMonth() &&
      e.date.getDate() === date.getDate()
  );
}

export function getUpcomingEvents(events: MarketEvent[], count = 10): MarketEvent[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return events.filter((e) => e.date >= now).slice(0, count);
}
