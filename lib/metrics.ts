/**
 * The figures the score actually measures, derived from Finnhub's raw payload.
 *
 * Two jobs, kept in one place so field-name knowledge lives in one place:
 *
 * 1. PRICE IT LIVE. Finnhub's metric payload is a daily snapshot, and on the
 *    free tier it lags. On 2026-11-20 every symbol sampled was priced as of the
 *    same session two days earlier - TSLA at $405.48 against a previous close
 *    of $374.41 - and P/B was on last fiscal year's price (NVDA's implied $186
 *    against a live $137). Anything with price in it was stale by however far
 *    the stock had moved since.
 *
 *    The per-share figures underneath (EPS, book value) change once a quarter,
 *    so valuation can be recomputed exactly: live price over the same
 *    per-share figure. Returns are carried forward by the stock's own move
 *    since the snapshot, whose price is recovered from Finnhub's own ratios.
 *
 * 2. READ THE RIGHT FIELDS. The engine used to read `debtEquityAnnual`, which
 *    Finnhub does not send - it was absent from all 64 payloads checked - so
 *    leverage silently scored as "no data" (neutral half marks) for every
 *    company ever analysed. The real field is `totalDebt/totalEquity*`.
 */

import type { FinnhubBasicFinancials, FinnhubQuote } from '@/types/stock';
import { SANE_RANGES } from '@/lib/stats';

type Metric = FinnhubBasicFinancials['metric'];

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const positive = (v: unknown): v is number => finite(v) && v > 0;

/**
 * The price Finnhub used for this snapshot, recovered from its own ratios:
 * `peTTM` is price / `epsTTM`, so their product IS the snapshot price. Falls
 * back through other ratio and per-share pairs for companies without earnings.
 */
export function impliedSnapshotPrice(m: Metric | undefined): number | undefined {
  if (!m) return undefined;
  const pairs: Array<[unknown, unknown]> = [
    [m.peTTM, m.epsTTM],
    [m.psTTM, m.revenuePerShareTTM],
    [m.pb, m.bookValuePerShareQuarterly],
  ];
  for (const [ratio, perShare] of pairs) {
    if (finite(ratio) && finite(perShare) && ratio * perShare > 0) return ratio * perShare;
  }
  return undefined;
}

/**
 * Total debt over total equity, latest quarter first.
 *
 * Negative equity - liabilities exceeding assets, common after years of
 * buybacks - makes the ratio negative, and a negative number would otherwise
 * read as "less leverage than zero" and score best in class. It is the
 * opposite, so it maps to the top of the sane leverage range.
 */
export function debtToEquity(m: Metric | undefined): number | undefined {
  const v = m?.['totalDebt/totalEquityQuarterly'] ?? m?.['totalDebt/totalEquityAnnual'];
  if (!finite(v)) return undefined;
  return v < 0 ? SANE_RANGES.leverage[1] : v;
}

export function currentRatio(m: Metric | undefined): number | undefined {
  const v = m?.currentRatioQuarterly ?? m?.currentRatioAnnual;
  return finite(v) ? v : undefined;
}

/** Distance below the 52-week high at Finnhub's snapshot price. Used for peers. */
export function snapshotDrawdown(m: Metric | undefined): number | undefined {
  const price = impliedSnapshotPrice(m);
  const high = m?.['52WeekHigh'];
  if (!positive(price) || !positive(high)) return undefined;
  return Math.max(0, (1 - price / high) * 100);
}

export interface LiveMetrics {
  /** The price everything below was computed at. */
  price: number;
  /** The price Finnhub's snapshot was taken at, when it could be recovered. */
  snapshotPrice?: number;
  /** Trailing P/E at the live price. Undefined when trailing EPS is not positive. */
  pe?: number;
  /** P/B on the latest quarterly book value. Undefined when book value is not positive. */
  pb?: number;
  /** Trailing EPS is zero or negative, so P/E has no meaning. */
  lossMaking: boolean;
  /** Excess return over the S&P 500 in percentage points, carried to the live price. */
  relative52W?: number;
  relative26W?: number;
  relative13W?: number;
  relative4W?: number;
  /** Percent below the 52-week high, counting today's high. */
  drawdown?: number;
  /**
   * The stock moved since the snapshot but the index's move could not be
   * netted out, so the relative figures carry the raw move instead.
   */
  marketAdjustmentMissing: boolean;
}

/**
 * Recompute every price-dependent figure at the live price.
 *
 * `marketDayChangePct` is the S&P 500 proxy's move today. It is the only part
 * of the index's move since the snapshot that is observable for free (an
 * index price history is a premium endpoint), so on a snapshot older than one
 * session the earlier sessions' index move is not netted out. On the sample
 * above that residual was about one percentage point.
 */
export function liveMetrics(
  quote: FinnhubQuote,
  m: Metric | undefined,
  marketDayChangePct?: number
): LiveMetrics {
  const price = quote?.c;
  if (!positive(price) || !m) {
    return { price: price ?? 0, lossMaking: false, marketAdjustmentMissing: false };
  }

  // Distrust an implied price wildly off the live one (a per-share figure for
  // a different share class, say) and fall back to the previous close.
  const implied = impliedSnapshotPrice(m);
  const snapshotPrice =
    implied && implied / price > 0.5 && implied / price < 2
      ? implied
      : positive(quote.pc)
        ? quote.pc
        : undefined;

  const stockFactor = snapshotPrice ? price / snapshotPrice : 1;
  const snapshotIsCurrent = Math.abs(stockFactor - 1) < 0.0005;
  const canAdjust = finite(marketDayChangePct);
  const marketFactor = !snapshotIsCurrent && canAdjust ? 1 + marketDayChangePct / 100 : 1;

  /**
   * Finnhub's relative strength is a DIFFERENCE of returns in percentage
   * points, not a ratio: across eight symbols on one snapshot the implied S&P
   * return agreed to the hundredth under subtraction and scattered by six
   * points under division. So both legs are carried forward separately and
   * differenced again.
   */
  const carry = (stockReturn: number | undefined, relative: number | undefined) => {
    if (!finite(relative)) return undefined;
    if (!finite(stockReturn)) return relative + (stockFactor - marketFactor) * 100;
    const marketReturn = stockReturn - relative;
    const stockLive = (1 + stockReturn / 100) * stockFactor - 1;
    const marketLive = (1 + marketReturn / 100) * marketFactor - 1;
    return (stockLive - marketLive) * 100;
  };

  const eps = m.epsTTM;
  const book = m.bookValuePerShareQuarterly ?? m.bookValuePerShareAnnual;
  const high52 = m['52WeekHigh'];
  const high = positive(high52) ? Math.max(high52, positive(quote.h) ? quote.h : 0, price) : undefined;

  return {
    price,
    snapshotPrice,
    pe: positive(eps) ? price / eps : undefined,
    pb: positive(book) ? price / book : undefined,
    lossMaking: finite(eps) && eps <= 0,
    relative52W: carry(m['52WeekPriceReturnDaily'], m['priceRelativeToS&P50052Week']),
    relative26W: carry(m['26WeekPriceReturnDaily'], m['priceRelativeToS&P50026Week']),
    relative13W: carry(m['13WeekPriceReturnDaily'], m['priceRelativeToS&P50013Week']),
    relative4W: carry(undefined, m['priceRelativeToS&P5004Week']),
    drawdown: high ? Math.max(0, (1 - price / high) * 100) : undefined,
    marketAdjustmentMissing: !snapshotIsCurrent && !canAdjust,
  };
}
