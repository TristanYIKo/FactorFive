/**
 * Typed Finnhub client.
 *
 * Every call routes through lib/upstream.ts for rate limiting, request
 * coalescing and caching. The per-resource TTLs below are the single biggest
 * performance lever in the app, so they are chosen deliberately rather than
 * uniformly:
 *
 *   quote        30s   - the only genuinely live value on the page
 *   news         15m   - headlines do not need second-level freshness
 *   metric       12h   - fundamentals update quarterly
 *   recommend    12h   - analyst ratings move slowly
 *   priceTarget  12h   - same
 *   profile      7d    - name, logo, industry, share count
 *   peers        30d   - peer sets are effectively static
 *
 * The old code passed `cache: 'no-store'` to all of these, so every page view
 * refetched all of it. Fundamentals that change four times a year were being
 * refetched several times a second under load.
 */

import type {
  FinnhubQuote,
  FinnhubProfile,
  FinnhubNewsArticle,
  FinnhubBasicFinancials,
  FinnhubRecommendationTrend,
  FinnhubPriceTarget,
  PeerMetrics,
} from '@/types/stock';
import { upstreamJson, upstreamJsonOptional, UpstreamError } from './upstream';

const BASE = 'https://finnhub.io/api/v1';

/** Cache lifetimes in seconds, keyed by how fast the underlying data actually moves. */
export const TTL = {
  quote: 30,
  news: 60 * 15,
  metric: 60 * 60 * 12,
  recommendation: 60 * 60 * 12,
  priceTarget: 60 * 60 * 12,
  profile: 60 * 60 * 24 * 7,
  peers: 60 * 60 * 24 * 30,
} as const;

function key(): string {
  const k = process.env.FINNHUB_KEY;
  if (!k) throw new UpstreamError('FINNHUB_KEY is not configured', 500, false);
  return k;
}

/** Build a URL, keeping the token out of the coalescing/cache key. */
function url(path: string, params: Record<string, string>): string {
  const qs = new URLSearchParams({ ...params, token: key() });
  return `${BASE}${path}?${qs.toString()}`;
}

/** A stable cache key that excludes the API token. */
function cacheKey(path: string, params: Record<string, string>): string {
  return `finnhub:${path}:${new URLSearchParams(params).toString()}`;
}

function get<T>(path: string, params: Record<string, string>, revalidate: number): Promise<T> {
  return upstreamJson<T>(url(path, params), {
    provider: 'finnhub',
    revalidate,
    key: cacheKey(path, params),
  });
}

function getOptional<T>(
  path: string,
  params: Record<string, string>,
  revalidate: number,
  fallback: T,
  extra?: { priority?: 'high' | 'low'; deadlineAt?: number; retries?: number }
) {
  return upstreamJsonOptional<T>(
    url(path, params),
    { provider: 'finnhub', revalidate, key: cacheKey(path, params), ...extra },
    fallback
  );
}

/**
 * Peer fundamentals, fetched at LOW priority.
 *
 * These are enrichment: the page renders a price, a profile and a score
 * without them. Yielding the rate-limit budget to page-critical calls keeps
 * the headline number fast for everyone when several cold symbols are being
 * analysed at once.
 */
function peerMetric(symbol: string, deadlineAt: number) {
  return getOptional<FinnhubBasicFinancials | null>(
    '/stock/metric',
    { symbol, metric: 'all' },
    TTL.metric,
    null,
    // retries: 0 is deliberate. When rate-limit budget is the scarce resource,
    // spending three of it re-asking for one peer is strictly worse than
    // spending it on three different peers - the benchmark only needs a
    // representative sample, not any particular company. With the default of
    // two retries, a cold five-symbol fill burned 49 requests to resolve
    // roughly sixteen peers and never finished populating the cache.
    { priority: 'low', deadlineAt, retries: 0 }
  );
}

export const finnhub = {
  quote: (symbol: string) => get<FinnhubQuote>('/quote', { symbol }, TTL.quote),

  profile: (symbol: string) => get<FinnhubProfile>('/stock/profile2', { symbol }, TTL.profile),

  news: (symbol: string, from: string, to: string) =>
    getOptional<FinnhubNewsArticle[]>('/company-news', { symbol, from, to }, TTL.news, []),

  metric: (symbol: string) =>
    getOptional<FinnhubBasicFinancials | null>(
      '/stock/metric',
      { symbol, metric: 'all' },
      TTL.metric,
      null
    ),

  recommendations: (symbol: string) =>
    getOptional<FinnhubRecommendationTrend[]>(
      '/stock/recommendation',
      { symbol },
      TTL.recommendation,
      []
    ),

  priceTarget: (symbol: string) =>
    getOptional<FinnhubPriceTarget | null>('/stock/price-target', { symbol }, TTL.priceTarget, null),

  peers: (symbol: string) => getOptional<string[]>('/stock/peers', { symbol }, TTL.peers, []),
};

/**
 * Result of a peer-metrics fetch. `complete` reports whether we got enough
 * peers to compute a trustworthy benchmark.
 *
 * This shape exists because the old code returned a bare array, so a
 * rate-limited fetch and a genuinely peerless stock were indistinguishable -
 * both produced `[]`, and the scoring engine went on to emit confident numbers
 * built on nothing. Callers now have to look at `complete` and `requested`.
 */
export interface PeerMetricsResult {
  peers: PeerMetrics[];
  /** How many peers we attempted to fetch. */
  requested: number;
  /** True when enough peers resolved for the benchmark to mean something. */
  complete: boolean;
  /** How size-comparable the surviving cohort is, for display. */
  cohort: string;
  /** Set when peers were lost to fetch failures or size filtering. */
  degradedReason?: string;
}

/** Below this many peers, an industry benchmark is not worth computing. */
export const MIN_PEERS_FOR_BENCHMARK = 4;

/** How many peers to pull metrics for. */
const PEER_LIMIT = 8;

/**
 * Stop waiting for peer metrics after this long and score with whatever
 * arrived, marked as degraded.
 *
 * At 60 requests/minute a fully cold cohort can take longer than anyone will
 * wait. Bounding it keeps the page responsive and, critically, makes the
 * shortfall visible in dataQuality rather than silently thinning the
 * benchmark - which is the exact failure this rebuild set out to remove.
 */
const PEER_DEADLINE_MS = 6000;

/**
 * Peers below this market cap (millions USD) are excluded outright.
 *
 * Finnhub groups by SIC code, so Apple's "peers" arrive as DELL, WDC, NTAP,
 * HPQ, SMCI, IONQ, GPGI, INFQ - disk-drive makers, a pre-revenue quantum
 * computing startup, and two obscure micro-caps. Companies at that scale post
 * percentage metrics that are arithmetically real but analytically useless
 * (IONQ alone contributed a +281% EPS growth median and a -113% net margin
 * quartile), and no amount of downstream statistics makes them a sound
 * comparison for a mega-cap.
 */
const MIN_PEER_MARKET_CAP = 2_000;

/**
 * Progressive size bands, as a multiplicative ratio around the subject's
 * market cap. Try the tightest first and widen only if too few peers survive,
 * so a comparison is as size-appropriate as the data allows. The band that was
 * actually used is reported back to the caller.
 */
const SIZE_BANDS: Array<{ ratio: number; label: string }> = [
  { ratio: 10, label: 'closely size-matched' },
  { ratio: 30, label: 'broadly size-matched' },
  { ratio: 100, label: 'loosely size-matched' },
  { ratio: Infinity, label: 'sector-wide, mixed market caps' },
];

/**
 * Select peers whose market cap is within a reasonable multiple of the
 * subject's, widening the band until enough peers qualify.
 */
function selectSizeCohort(
  subjectCap: number | undefined,
  candidates: PeerMetrics[]
): { cohort: PeerMetrics[]; label: string } {
  const eligible = candidates.filter(
    (p) => p.marketCap === undefined || p.marketCap >= MIN_PEER_MARKET_CAP
  );

  // Without the subject's own market cap we cannot band at all.
  if (!subjectCap || subjectCap <= 0) {
    return { cohort: eligible, label: 'sector peers (size unknown)' };
  }

  for (const band of SIZE_BANDS) {
    if (band.ratio === Infinity) break;
    const cohort = eligible.filter((p) => {
      if (p.marketCap === undefined) return false;
      const ratio = p.marketCap > subjectCap ? p.marketCap / subjectCap : subjectCap / p.marketCap;
      return ratio <= band.ratio;
    });
    if (cohort.length >= MIN_PEERS_FOR_BENCHMARK) {
      return { cohort, label: band.label };
    }
  }

  return { cohort: eligible, label: SIZE_BANDS[SIZE_BANDS.length - 1].label };
}

/**
 * Fetch fundamentals for a symbol's industry peers.
 *
 * The old implementation issued two calls per peer - a quote and a metric -
 * for 10 peers, so 20 calls on top of the 7 for the primary symbol. The quote
 * call existed only to populate `momentum1M` and `momentum3M`, and it set both
 * to `quote.dp`, which is today's percentage change. That is not one-month or
 * three-month momentum, and storing the same number under two names made the
 * benchmark look richer than it was. The quote call is gone; momentum now
 * comes from the metric payload, which carries real 1M/3M price returns.
 *
 * With a 12h TTL these are near-free after the first request for an industry.
 *
 * The peer LIST is fetched by the caller in its first parallel hop, so that
 * this function - which needs the subject's own market cap to size-filter -
 * can run in the second hop without adding a third round trip.
 */
export async function fetchPeerMetrics(
  symbol: string,
  peersRes: { data: string[]; ok: boolean; error?: string },
  subjectMarketCap?: number
): Promise<PeerMetricsResult> {
  if (!peersRes.ok) {
    return {
      peers: [],
      requested: 0,
      complete: false,
      cohort: 'unavailable',
      degradedReason: `could not fetch peer list: ${peersRes.error}`,
    };
  }

  const candidates = peersRes.data
    .filter((p) => typeof p === 'string' && p.length > 0)
    .filter((p) => p.toUpperCase() !== symbol.toUpperCase())
    .slice(0, PEER_LIMIT);

  if (candidates.length === 0) {
    return {
      peers: [],
      requested: 0,
      complete: false,
      cohort: 'unavailable',
      degradedReason: 'Finnhub lists no peers for this symbol',
    };
  }

  // The deadline is handed to the limiter rather than raced against it. A peer
  // that is still queued when time runs out releases its slot and spends none
  // of the window's budget; racing a timeout instead left the request queued,
  // so it went on to consume a request nobody was waiting for and starved the
  // next visitor's page-critical calls.
  const deadlineAt = Date.now() + PEER_DEADLINE_MS;

  const settled = await Promise.all(
    candidates.map(async (peerSymbol) => {
      const res = await peerMetric(peerSymbol, deadlineAt);
      if (!res.ok || !res.data?.metric) return null;

      const m = res.data.metric;
      const peer: PeerMetrics = {
        symbol: peerSymbol,
        marketCap: m.marketCapitalization,
        revenueGrowth: m.revenueGrowthQuarterlyYoy ?? m.revenueGrowthAnnual,
        epsGrowth: m.epsGrowthQuarterlyYoy ?? m.epsGrowthAnnual,
        roe: m.roeRfy,
        roa: m.roaRfy,
        netMargin: m.netProfitMarginAnnual,
        operatingMargin: m.operatingMarginAnnual,
        pe: m.peNormalizedAnnual,
        pb: m.pbAnnual,
        debtEquity: m.debtEquityAnnual,
        currentRatio: m.currentRatioAnnual,
        // Real price momentum from the metric payload rather than a duplicated
        // daily change. Finnhub has no exact 1-month field, so month-to-date is
        // the closest honest proxy; 13-week is a true 3-month return.
        momentum1M: m.monthToDatePriceReturnDaily,
        momentum3M: m['13WeekPriceReturnDaily'],
      };
      return peer;
    })
  );

  const resolved = settled.filter((p): p is PeerMetrics => p !== null);
  const fetchFailures = candidates.length - resolved.length;

  const { cohort, label } = selectSizeCohort(subjectMarketCap, resolved);
  const excludedForSize = resolved.length - cohort.length;
  const complete = cohort.length >= MIN_PEERS_FOR_BENCHMARK;

  const notes: string[] = [];
  // Covers both a genuine fetch failure and a peer still queued for rate-limit
  // budget when the deadline fired; from the reader's point of view the
  // consequence is the same and the wording should not overclaim which it was.
  if (fetchFailures > 0) notes.push(`${fetchFailures} did not resolve in time`);
  if (excludedForSize > 0) notes.push(`${excludedForSize} excluded as size-inappropriate`);

  return {
    peers: cohort,
    requested: candidates.length,
    complete,
    cohort: label,
    degradedReason: complete
      ? undefined
      : `only ${cohort.length} of ${candidates.length} peers usable` +
        (notes.length ? ` (${notes.join(', ')})` : ''),
  };
}
