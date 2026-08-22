/**
 * FRED client — authoritative macroeconomic release dates.
 *
 * FRED (Federal Reserve Bank of St. Louis) publishes the actual release
 * calendars of the statistical agencies, including dates that have not happened
 * yet. That makes it a source of record rather than a prediction, which is the
 * whole reason the calendar now depends on it.
 *
 * The previous calendar DERIVED these dates from publishing conventions -
 * "CPI lands around the 12th", "PPI follows CPI". Checked against FRED for
 * September 2026, those rules were wrong in ways that matter:
 *
 *   CPI           rule said Sep 14   actual Sep 11
 *   PPI           rule said Sep 15   actual Sep 10
 *   Retail Sales  rule said Sep 15   actual Sep 16
 *
 * The PPI error is the instructive one: the rule assumed PPI always follows
 * CPI, and in September 2026 it precedes it by a day. A convention that holds
 * most months is not a schedule.
 *
 * Docs: https://fred.stlouisfed.org/docs/api/fred/
 * Rate limit: 120 requests/minute (we use ~11, cached for 12 hours).
 */

import { upstreamJsonOptional } from './upstream';

const BASE = 'https://api.stlouisfed.org/fred';

/** Cache release schedules for 12 hours; agencies publish them months ahead. */
const RELEASE_TTL = 60 * 60 * 12;

export type Impact = 'high' | 'medium' | 'low';

/**
 * The curated set of FRED releases worth putting on a market calendar.
 *
 * FRED carries 331 releases, most of which are daily series updates - Coinbase
 * crypto prices, Dow Jones averages, daily Treasury yields. Querying
 * `releases/dates` wholesale returns roughly 1,240 entries over 45 days and is
 * unusable as a calendar. This allowlist is the filter.
 *
 * `impact` follows the convention of standard economic calendars: high means it
 * routinely moves rates and equities on release.
 */
export interface ReleaseSpec {
  id: number;
  name: string;
  short: string;
  agency: string;
  impact: Impact;
  description: string;
}

export const MACRO_RELEASES: ReleaseSpec[] = [
  {
    id: 50,
    name: 'Employment Situation',
    short: 'Non-Farm Payrolls',
    agency: 'Bureau of Labor Statistics',
    impact: 'high',
    description:
      'Payroll growth, unemployment rate and average hourly earnings. Typically the highest-volatility scheduled release of the month.',
  },
  {
    id: 10,
    name: 'Consumer Price Index',
    short: 'CPI',
    agency: 'Bureau of Labor Statistics',
    impact: 'high',
    description:
      'Headline and core consumer inflation. The most closely watched input to Federal Reserve rate expectations.',
  },
  {
    id: 54,
    name: 'Personal Income and Outlays',
    short: 'PCE',
    agency: 'Bureau of Economic Analysis',
    impact: 'high',
    description:
      'Includes the core PCE price index, which is the inflation measure the Federal Reserve formally targets.',
  },
  {
    id: 53,
    name: 'Gross Domestic Product',
    short: 'GDP',
    agency: 'Bureau of Economic Analysis',
    impact: 'high',
    description:
      'Quarterly economic growth. Released in three passes — advance, second and third estimates — each revising the last.',
  },
  {
    id: 9,
    name: 'Advance Monthly Sales for Retail and Food Services',
    short: 'Retail Sales',
    agency: 'Census Bureau',
    impact: 'high',
    description:
      'Consumer spending across retail and food service. Roughly two-thirds of U.S. GDP runs through the consumer.',
  },
  {
    id: 46,
    name: 'Producer Price Index',
    short: 'PPI',
    agency: 'Bureau of Labor Statistics',
    impact: 'medium',
    description:
      'Wholesale prices. Often read as a leading indicator for consumer inflation.',
  },
  {
    id: 192,
    name: 'Job Openings and Labor Turnover Survey',
    short: 'JOLTS',
    agency: 'Bureau of Labor Statistics',
    impact: 'medium',
    description: 'Job openings, hires and quits. Read as a gauge of labour-market slack.',
  },
  {
    id: 91,
    name: 'Surveys of Consumers',
    short: 'Consumer Sentiment',
    agency: 'University of Michigan',
    impact: 'medium',
    description:
      'Consumer sentiment index and inflation expectations, which the Federal Reserve watches closely.',
  },
  {
    id: 27,
    name: 'New Residential Construction',
    short: 'Housing Starts',
    agency: 'Census Bureau',
    impact: 'medium',
    description: 'Housing starts and building permits — an early read on construction activity.',
  },
  {
    id: 13,
    name: 'Industrial Production and Capacity Utilization',
    short: 'Industrial Production',
    agency: 'Federal Reserve',
    impact: 'low',
    description: 'Output of factories, mines and utilities, plus how much capacity is in use.',
  },
  {
    id: 188,
    name: 'U.S. Import and Export Price Indexes',
    short: 'Import/Export Prices',
    agency: 'Bureau of Labor Statistics',
    impact: 'low',
    description: 'Traded-goods prices — a channel through which currency moves reach inflation.',
  },
];

interface FredReleaseDatesResponse {
  release_dates?: Array<{ release_id: number; date: string }>;
}

/** One scheduled release, as published by the source agency via FRED. */
export interface MacroRelease {
  releaseId: number;
  /** YYYY-MM-DD, as published. */
  date: string;
  spec: ReleaseSpec;
}

function key(): string | null {
  return process.env.FRED_API_KEY ?? null;
}

/**
 * Fetch scheduled dates for one release.
 *
 * `include_release_dates_with_no_data=true` is what surfaces FUTURE dates —
 * without it FRED only returns dates where data already exists, which makes the
 * endpoint useless for a forward calendar.
 */
async function fetchReleaseDates(
  spec: ReleaseSpec,
  from: string,
  to: string
): Promise<MacroRelease[]> {
  const apiKey = key();
  if (!apiKey) return [];

  const params = new URLSearchParams({
    release_id: String(spec.id),
    api_key: apiKey,
    file_type: 'json',
    realtime_start: from,
    realtime_end: to,
    include_release_dates_with_no_data: 'true',
    sort_order: 'asc',
    limit: '200',
  });

  const res = await upstreamJsonOptional<FredReleaseDatesResponse>(
    `${BASE}/release/dates?${params.toString()}`,
    {
      provider: 'fred',
      revalidate: RELEASE_TTL,
      // Key excludes the API key so it stays out of cache keys and logs.
      key: `fred:release-dates:${spec.id}:${from}:${to}`,
      priority: 'low',
      retries: 1,
    },
    {}
  );

  if (!res.ok) return [];

  return (res.data.release_dates ?? [])
    .filter((d) => typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .map((d) => ({ releaseId: spec.id, date: d.date, spec }));
}

/**
 * Every scheduled macro release in the window, across the curated allowlist.
 *
 * Releases are fetched in parallel and failures are per-release: if one agency's
 * schedule cannot be retrieved, the rest of the calendar still renders and that
 * release is simply absent rather than guessed at.
 */
export async function fetchMacroReleases(from: string, to: string): Promise<MacroRelease[]> {
  if (!key()) return [];

  const results = await Promise.all(
    MACRO_RELEASES.map((spec) => fetchReleaseDates(spec, from, to))
  );

  return results
    .flat()
    .sort((a, b) => a.date.localeCompare(b.date) || a.spec.impact.localeCompare(b.spec.impact));
}

/** Whether macro data can be fetched at all. Surfaced in /api/health. */
export function fredConfigured(): boolean {
  return key() !== null;
}
