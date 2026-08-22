/**
 * Robust statistics for peer benchmarking.
 *
 * The previous engine compared each company to the arithmetic MEAN of its
 * peers and normalised by standard deviation. Both are unusable on this data.
 * Finnhub's peer list is unvetted, so a single loss-making micro-cap with a
 * 1,400% EPS swing drags the benchmark to nonsense. Observed on AAPL:
 *
 *   avgRevenueGrowth  149.3%     (no real industry grows at 149%)
 *   avgEpsGrowth      266.9%
 *   avgNetMargin      -19.8%     (negative, from unprofitable small caps)
 *   avgPe             180.3
 *
 * Against that fabricated baseline Apple scored 3/20 on growth.
 *
 * The fix is standard robust-statistics practice: summarise with the MEDIAN,
 * scale with the MEDIAN ABSOLUTE DEVIATION, and winsorize extremes before they
 * reach either. A median tolerates up to 50% contaminated data; a mean is
 * broken by one bad point.
 */

/** Discard undefined, null, NaN and infinities. */
export function clean(values: Array<number | undefined | null>): number[] {
  return values.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  );
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/**
 * Median absolute deviation, scaled by 1.4826 so that for normally distributed
 * data it estimates the same quantity as the standard deviation - but without
 * being destroyed by outliers.
 */
export function mad(values: number[]): number {
  if (values.length === 0) return 0;
  const med = median(values);
  const deviations = values.map((v) => Math.abs(v - med));
  return median(deviations) * 1.4826;
}

/**
 * Clamp values into the [lowerQ, upperQ] quantile range. Extreme peers still
 * count as "high" or "low" but can no longer set the scale on their own.
 */
export function winsorize(values: number[], lowerQ = 0.1, upperQ = 0.9): number[] {
  if (values.length < 3) return [...values];
  const lo = quantile(values, lowerQ);
  const hi = quantile(values, upperQ);
  return values.map((v) => Math.min(hi, Math.max(lo, v)));
}

/**
 * Robust z-score: how many robust standard deviations `value` sits from the
 * peer median.
 *
 * Returns null when the peer set cannot support the calculation, which callers
 * must handle explicitly. The old code returned 0 in that case, which the
 * sigmoid then mapped to exactly half marks - the bug that made every stock
 * score ~50/100 whenever peer fetches failed.
 */
export function robustZScore(value: number, peers: number[]): number | null {
  const usable = clean(peers);
  if (usable.length < 3) return null;

  const w = winsorize(usable);
  const centre = median(w);
  const scale = mad(w);

  if (scale === 0) {
    // Every peer is identical. Report direction only.
    if (value === centre) return 0;
    return value > centre ? 1 : -1;
  }

  const z = (value - centre) / scale;
  return Math.max(-4, Math.min(4, z));
}

/**
 * Percentile rank of `value` within `peers`, 0-100, using the standard
 * midpoint convention for ties: everything strictly below, plus half the ties.
 */
export function percentileRank(value: number, peers: number[]): number | null {
  const usable = clean(peers);
  if (usable.length === 0) return null;

  const below = usable.filter((v) => v < value).length;
  const equal = usable.filter((v) => v === value).length;
  return ((below + equal / 2) / usable.length) * 100;
}

/**
 * Map a z-score onto a 0-`maxPoints` scale with a logistic curve.
 *
 * Deliberately gentler than the previous implementation, which applied a
 * steepness of 2.5 plus an extra power term, then added a separate "compound
 * excellence" bonus of up to +15 on the total. Stacking three amplifiers made
 * scores bimodal - companies piled up at the extremes and a small change in
 * one input could swing the headline number by 20 points. A single calibrated
 * curve is both more stable and easier to reason about.
 *
 * z = -2 -> ~9%   of max
 * z = -1 -> ~23%
 * z =  0 -> 50%
 * z = +1 -> ~77%
 * z = +2 -> ~91%
 */
export function zScoreToPoints(z: number, maxPoints: number): number {
  const steepness = 1.2;
  const sigmoid = 1 / (1 + Math.exp(-steepness * z));
  return Math.max(0, Math.min(maxPoints, sigmoid * maxPoints));
}

/**
 * Points for a metric where LOWER is better (P/E, debt-to-equity).
 * Simply inverts the z-score.
 */
export function zScoreToPointsInverted(z: number, maxPoints: number): number {
  return zScoreToPoints(-z, maxPoints);
}

/**
 * Analytically sensible bounds per metric, applied before any statistics.
 *
 * Some reported values are arithmetically correct but carry no information.
 * An EPS growth of +954% (Western Digital, mid-memory-cycle) or a P/E of 1399
 * (HPE on near-zero earnings) are base-effect artefacts: they say the
 * denominator was tiny, not that the business is a thousand times better.
 * Left unclamped they dominate any distribution they appear in.
 *
 * Values outside these bounds are clamped rather than dropped, so the company
 * still registers as "very high" or "very low" without setting the scale.
 */
export const SANE_RANGES = {
  growthPct: [-100, 150] as [number, number],
  marginPct: [-100, 100] as [number, number],
  returnPct: [-100, 150] as [number, number],
  ratio: [0, 150] as [number, number],
  leverage: [0, 10] as [number, number],
  liquidity: [0, 10] as [number, number],
} as const;

export function clampSane(value: number, range: [number, number]): number {
  return Math.min(range[1], Math.max(range[0], value));
}

/**
 * Score a value against fixed thresholds, returning a 0-1 fraction.
 * `thresholds` are ascending boundaries [poor, fair, good, excellent] on the
 * raw value; set `lowerIsBetter` for metrics like P/E where small wins.
 */
export function absoluteFraction(
  value: number,
  thresholds: [number, number, number, number],
  lowerIsBetter = false
): number {
  const [poor, fair, good, excellent] = thresholds;

  if (lowerIsBetter) {
    if (value <= poor) return 1.0;
    if (value <= fair) return 0.78;
    if (value <= good) return 0.55;
    if (value <= excellent) return 0.32;
    return 0.12;
  }

  if (value >= excellent) return 1.0;
  if (value >= good) return 0.78;
  if (value >= fair) return 0.55;
  if (value >= poor) return 0.32;
  return 0.12;
}

/** Summary of a peer distribution, for display and for scoring. */
export interface Distribution {
  median: number;
  p25: number;
  p75: number;
  mad: number;
  count: number;
}

export function describe(values: Array<number | undefined | null>): Distribution | null {
  const usable = clean(values);
  if (usable.length === 0) return null;
  return {
    median: median(usable),
    p25: quantile(usable, 0.25),
    p75: quantile(usable, 0.75),
    mad: mad(usable),
    count: usable.length,
  };
}
