/**
 * FactorFive scoring engine.
 *
 * Five factors, 20 points each, summing to 0-100:
 *   Growth, Profitability, Valuation, Quality, Analyst.
 *
 * Two changes from the previous engine matter most.
 *
 * 1. ROBUST BENCHMARKS. Peers are summarised by median and MAD with winsorized
 *    tails rather than mean and standard deviation. Finnhub peer lists contain
 *    unvetted micro-caps; on AAPL the old mean-based benchmark reported 149%
 *    "average" industry revenue growth and -20% net margin, which scored Apple
 *    3/20 on growth. See lib/stats.ts.
 *
 * 2. HONEST DEGRADATION. When peer data is missing the engine no longer
 *    invents a comparison. Previously an empty peer set produced z-score 0 for
 *    every factor, which the sigmoid mapped to exactly half marks, so any
 *    rate-limited request silently returned ~50/100 while the UI claimed a
 *    full peer analysis. Factors that cannot be computed against peers now
 *    fall back to absolute thresholds and are reported at lower confidence.
 *
 * The old "compound excellence multiplier" (up to +15 on the total, stacked on
 * an already-amplified sigmoid) is gone. Three multiplicative amplifiers made
 * the output bimodal and unstable; one calibrated curve is more informative.
 */

import type {
  FinnhubQuote,
  FinnhubBasicFinancials,
  FinnhubRecommendationTrend,
  FinnhubPriceTarget,
  PeerMetrics,
  IndustryBenchmarks,
  MetricDistribution,
  ScoreBreakdown,
} from '@/types/stock';
import type { PeerMetricsResult } from '@/lib/finnhub';
import {
  describe,
  robustZScore,
  percentileRank,
  zScoreToPoints,
  zScoreToPointsInverted,
  absoluteFraction,
  clampSane,
  clean,
  SANE_RANGES,
} from '@/lib/stats';

/** One factor's result. */
interface FactorResult {
  score: number;
  detail: string;
  tooltip: string;
  percentile: number | null;
  /** True when the score came from peer comparison rather than a fallback. */
  peerBased: boolean;
}

/**
 * How much of a factor's score comes from peer comparison versus absolute
 * thresholds, when peer data is available.
 *
 * A pure peer-relative score is hostage to whatever cohort the data provider
 * returns. Apple's Finnhub peers are currently mid-memory-cycle storage firms
 * posting 954% EPS growth and 372% revenue growth; against that cohort Apple's
 * steady 16% looks like failure, which is an artefact of the comparison set
 * rather than a fact about Apple. A pure absolute score has the opposite flaw:
 * it ignores that a 20% margin means very different things in software and in
 * grocery retail.
 *
 * Blending keeps sector context meaningful while anchoring the result to
 * something stable.
 */
const PEER_WEIGHT = 0.6;

/**
 * Score one metric, blending a peer-relative and an absolute view.
 *
 * `thresholds` are [poor, fair, good, excellent] boundaries on the raw value.
 * `sane` clamps base-effect artefacts before they reach the statistics.
 */
function scoreMetric(
  value: number | undefined,
  peerValues: Array<number | undefined>,
  maxPoints: number,
  opts: {
    lowerIsBetter?: boolean;
    thresholds: [number, number, number, number];
    sane: readonly [number, number];
  }
): { points: number; peerBased: boolean; percentile: number | null } {
  if (value === undefined || !Number.isFinite(value)) {
    // No data for this company at all. Award the midpoint, but flag it as a
    // non-peer result so overall confidence drops.
    return { points: maxPoints / 2, peerBased: false, percentile: null };
  }

  const range = opts.sane as [number, number];
  const absolutePoints =
    absoluteFraction(value, opts.thresholds, opts.lowerIsBetter) * maxPoints;

  const clampedValue = clampSane(value, range);
  const clampedPeers = clean(peerValues).map((v) => clampSane(v, range));

  const z = robustZScore(clampedValue, clampedPeers);

  // Not enough peers to compare against: absolute score only, reported as
  // non-peer-based so the caller can lower confidence and say so in the UI.
  // The old engine returned a z-score of 0 here, which the sigmoid mapped to
  // exactly half marks - the silent ~50/100 bug.
  if (z === null) {
    return { points: absolutePoints, peerBased: false, percentile: null };
  }

  const peerPoints = opts.lowerIsBetter
    ? zScoreToPointsInverted(z, maxPoints)
    : zScoreToPoints(z, maxPoints);

  const points = PEER_WEIGHT * peerPoints + (1 - PEER_WEIGHT) * absolutePoints;

  const raw = percentileRank(clampedValue, clampedPeers);
  const percentile = raw === null ? null : opts.lowerIsBetter ? 100 - raw : raw;

  return { points, peerBased: true, percentile };
}

function pct(v: number | undefined | null, digits = 1): string {
  return v === undefined || v === null || !Number.isFinite(v) ? 'n/a' : `${v.toFixed(digits)}%`;
}

function num(v: number | undefined | null, digits = 1): string {
  return v === undefined || v === null || !Number.isFinite(v) ? 'n/a' : v.toFixed(digits);
}

/** Describe where a value sits relative to a peer distribution, in words. */
function vsMedian(value: number | undefined, dist: MetricDistribution | null, unit = '%'): string {
  if (value === undefined || !Number.isFinite(value)) return 'no company data';
  if (!dist) return `${value.toFixed(1)}${unit} (no peer baseline)`;
  const delta = value - dist.median;
  const direction = delta >= 0 ? 'above' : 'below';
  return `${value.toFixed(1)}${unit} vs peer median ${dist.median.toFixed(1)}${unit} (${Math.abs(delta).toFixed(1)}${unit} ${direction})`;
}

/**
 * Summarise a peer metric using the SAME clamped values the scorer uses.
 *
 * Displaying an unclamped median next to a clamped score would tell the user
 * "peer median EPS growth 617.8%" while the engine actually scored against
 * 150%. The numbers on screen must be the numbers the score came from.
 */
function describeClamped(
  values: Array<number | undefined>,
  range: readonly [number, number]
): MetricDistribution | null {
  return describe(
    clean(values).map((v) => clampSane(v, range as [number, number]))
  );
}

export function calculateIndustryBenchmarks(
  peers: PeerMetrics[],
  industry: string,
  reliable: boolean
): IndustryBenchmarks {
  return {
    industry,
    peerCount: peers.length,
    reliable,
    distributions: {
      revenueGrowth: describeClamped(peers.map((p) => p.revenueGrowth), SANE_RANGES.growthPct),
      epsGrowth: describeClamped(peers.map((p) => p.epsGrowth), SANE_RANGES.growthPct),
      roe: describeClamped(peers.map((p) => p.roe), SANE_RANGES.returnPct),
      netMargin: describeClamped(peers.map((p) => p.netMargin), SANE_RANGES.marginPct),
      operatingMargin: describeClamped(peers.map((p) => p.operatingMargin), SANE_RANGES.marginPct),
      pe: describeClamped(peers.map((p) => p.pe), SANE_RANGES.ratio),
      pb: describeClamped(peers.map((p) => p.pb), SANE_RANGES.ratio),
      debtEquity: describeClamped(peers.map((p) => p.debtEquity), SANE_RANGES.leverage),
      momentum3M: describeClamped(peers.map((p) => p.momentum3M), SANE_RANGES.returnPct),
    },
  };
}

/** GROWTH - revenue and EPS growth versus peers. */
function calculateGrowthScore(
  financials: FinnhubBasicFinancials | null,
  peers: PeerMetrics[],
  benchmarks: IndustryBenchmarks
): FactorResult {
  const m = financials?.metric;
  const revenueGrowth = m?.revenueGrowthQuarterlyYoy ?? m?.revenueGrowthAnnual;
  const epsGrowth = m?.epsGrowthQuarterlyYoy ?? m?.epsGrowthAnnual;

  const rev = scoreMetric(revenueGrowth, peers.map((p) => p.revenueGrowth), 10, {
    thresholds: [0, 5, 12, 25],
    sane: SANE_RANGES.growthPct,
  });
  const eps = scoreMetric(epsGrowth, peers.map((p) => p.epsGrowth), 10, {
    thresholds: [0, 8, 15, 30],
    sane: SANE_RANGES.growthPct,
  });

  const peerBased = rev.peerBased || eps.peerBased;
  const percentiles = clean([rev.percentile, eps.percentile]);

  return {
    score: Math.round(rev.points + eps.points),
    detail: `Revenue ${vsMedian(revenueGrowth, benchmarks.distributions.revenueGrowth)}; EPS ${vsMedian(epsGrowth, benchmarks.distributions.epsGrowth)}`,
    tooltip: peerBased
      ? `Growth ranked against ${benchmarks.peerCount} ${benchmarks.industry} peers using median-based normalisation.`
      : `Not enough peer data for an industry comparison. Scored against absolute growth thresholds instead.`,
    percentile: percentiles.length ? Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length) : null,
    peerBased,
  };
}

/** PROFITABILITY - ROE, net margin, operating margin. */
function calculateProfitabilityScore(
  financials: FinnhubBasicFinancials | null,
  peers: PeerMetrics[],
  benchmarks: IndustryBenchmarks
): FactorResult {
  const m = financials?.metric;

  const roe = scoreMetric(m?.roeRfy, peers.map((p) => p.roe), 8, {
    thresholds: [0, 8, 15, 25],
    sane: SANE_RANGES.returnPct,
  });
  const net = scoreMetric(m?.netProfitMarginAnnual, peers.map((p) => p.netMargin), 6, {
    thresholds: [0, 5, 12, 20],
    sane: SANE_RANGES.marginPct,
  });
  const op = scoreMetric(m?.operatingMarginAnnual, peers.map((p) => p.operatingMargin), 6, {
    thresholds: [0, 8, 15, 25],
    sane: SANE_RANGES.marginPct,
  });

  const peerBased = roe.peerBased || net.peerBased || op.peerBased;
  const percentiles = clean([roe.percentile, net.percentile, op.percentile]);

  return {
    score: Math.round(roe.points + net.points + op.points),
    detail: `ROE ${vsMedian(m?.roeRfy, benchmarks.distributions.roe)}; net margin ${vsMedian(m?.netProfitMarginAnnual, benchmarks.distributions.netMargin)}`,
    tooltip: peerBased
      ? `Margins and returns ranked against ${benchmarks.peerCount} sector peers.`
      : `Scored against absolute profitability thresholds - peer data unavailable.`,
    percentile: percentiles.length ? Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length) : null,
    peerBased,
  };
}

/** VALUATION - P/E and P/B, where lower is better. */
function calculateValuationScore(
  financials: FinnhubBasicFinancials | null,
  peers: PeerMetrics[],
  benchmarks: IndustryBenchmarks
): FactorResult {
  const m = financials?.metric;

  // Negative earnings make P/E meaningless rather than attractive; exclude
  // them from both the company value and the peer set.
  const peValue = m?.peNormalizedAnnual !== undefined && m.peNormalizedAnnual > 0 ? m.peNormalizedAnnual : undefined;
  const peerPe = peers.map((p) => (p.pe !== undefined && p.pe > 0 ? p.pe : undefined));

  const pe = scoreMetric(peValue, peerPe, 12, {
    lowerIsBetter: true,
    thresholds: [10, 18, 28, 45],
    sane: SANE_RANGES.ratio,
  });
  const pb = scoreMetric(m?.pbAnnual, peers.map((p) => p.pb), 8, {
    lowerIsBetter: true,
    thresholds: [1.5, 3, 6, 10],
    sane: SANE_RANGES.ratio,
  });

  const peerBased = pe.peerBased || pb.peerBased;
  const percentiles = clean([pe.percentile, pb.percentile]);

  const peNote =
    m?.peNormalizedAnnual !== undefined && m.peNormalizedAnnual <= 0
      ? 'P/E not meaningful (negative earnings)'
      : `P/E ${vsMedian(peValue, benchmarks.distributions.pe, '')}`;

  return {
    score: Math.round(pe.points + pb.points),
    detail: `${peNote}; P/B ${vsMedian(m?.pbAnnual, benchmarks.distributions.pb, '')}`,
    tooltip: peerBased
      ? `Cheaper than sector peers scores higher. Ranked against ${benchmarks.peerCount} peers.`
      : `Scored against absolute valuation bands - peer data unavailable.`,
    percentile: percentiles.length ? Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length) : null,
    peerBased,
  };
}

/** QUALITY - balance-sheet strength. */
function calculateQualityScore(
  financials: FinnhubBasicFinancials | null,
  peers: PeerMetrics[],
  benchmarks: IndustryBenchmarks
): FactorResult {
  const m = financials?.metric;

  const de = scoreMetric(m?.debtEquityAnnual, peers.map((p) => p.debtEquity), 8, {
    lowerIsBetter: true,
    thresholds: [0.3, 0.8, 1.5, 2.5],
    sane: SANE_RANGES.leverage,
  });
  const cr = scoreMetric(m?.currentRatioAnnual, peers.map((p) => p.currentRatio), 6, {
    thresholds: [0.8, 1.0, 1.5, 2.0],
    sane: SANE_RANGES.liquidity,
  });
  const roa = scoreMetric(m?.roaRfy, peers.map((p) => p.roa), 6, {
    thresholds: [0, 3, 7, 12],
    sane: SANE_RANGES.returnPct,
  });

  const peerBased = de.peerBased || cr.peerBased || roa.peerBased;
  const percentiles = clean([de.percentile, cr.percentile, roa.percentile]);

  return {
    score: Math.round(de.points + cr.points + roa.points),
    detail: `Debt/equity ${num(m?.debtEquityAnnual, 2)}; current ratio ${num(m?.currentRatioAnnual, 2)}; ROA ${pct(m?.roaRfy)}`,
    tooltip: peerBased
      ? `Balance-sheet strength versus ${benchmarks.peerCount} peers. Lower leverage and healthier liquidity score higher.`
      : `Scored against absolute balance-sheet thresholds - peer data unavailable.`,
    percentile: percentiles.length ? Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length) : null,
    peerBased,
  };
}

/**
 * ANALYST - consensus ratings and price-target upside.
 * This factor is inherently absolute rather than peer-relative.
 */
function calculateAnalystScore(
  quote: FinnhubQuote,
  recommendations: FinnhubRecommendationTrend[],
  priceTarget: FinnhubPriceTarget | null
): FactorResult {
  let ratingPoints = 6; // neutral default out of 12
  let ratingDetail = 'No analyst ratings available';

  const latest = recommendations?.[0];
  if (latest) {
    const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
    if (total > 0) {
      // Weighted mean on a 1 (strong sell) to 5 (strong buy) scale.
      const weighted =
        (latest.strongBuy * 5 + latest.buy * 4 + latest.hold * 3 + latest.sell * 2 + latest.strongSell) /
        total;
      ratingPoints = ((weighted - 1) / 4) * 12;
      const bullish = latest.strongBuy + latest.buy;
      ratingDetail = `${bullish}/${total} analysts rate Buy or better (consensus ${weighted.toFixed(1)}/5)`;
    }
  }

  let upsidePoints = 4; // neutral default out of 8
  let upsideDetail = 'No price target available';

  const current = quote?.c;
  const target = priceTarget?.targetMean;
  if (current && target && current > 0 && target > 0) {
    const upside = ((target - current) / current) * 100;
    // -20% upside -> 0 points, +40% -> 8 points, linear between.
    upsidePoints = Math.max(0, Math.min(8, ((upside + 20) / 60) * 8));
    upsideDetail = `Mean target ${target.toFixed(2)} implies ${upside >= 0 ? '+' : ''}${upside.toFixed(1)}% versus ${current.toFixed(2)}`;
  }

  return {
    score: Math.round(ratingPoints + upsidePoints),
    detail: `${ratingDetail}. ${upsideDetail}`,
    tooltip: 'Analyst consensus rating and mean price target. Absolute rather than peer-relative.',
    percentile: null,
    peerBased: false,
  };
}

/**
 * Compose the five factors into a 0-100 score.
 */
export function calculateIntelligentStockScore(
  symbol: string,
  quote: FinnhubQuote,
  financials: FinnhubBasicFinancials | null,
  recommendations: FinnhubRecommendationTrend[],
  priceTarget: FinnhubPriceTarget | null,
  peerResult: PeerMetricsResult,
  industry: string
): { score: number; breakdown: ScoreBreakdown; benchmarks: IndustryBenchmarks } {
  const peers = peerResult.peers;
  const benchmarks = calculateIndustryBenchmarks(peers, industry, peerResult.complete);

  const growth = calculateGrowthScore(financials, peers, benchmarks);
  const profitability = calculateProfitabilityScore(financials, peers, benchmarks);
  const valuation = calculateValuationScore(financials, peers, benchmarks);
  const quality = calculateQualityScore(financials, peers, benchmarks);
  const analyst = calculateAnalystScore(quote, recommendations, priceTarget);

  const total =
    growth.score + profitability.score + valuation.score + quality.score + analyst.score;
  const score = Math.max(0, Math.min(100, Math.round(total)));

  // Confidence reflects how much of the score rested on real comparisons.
  const caveats: string[] = [];
  const peerBackedFactors = [growth, profitability, valuation, quality].filter((f) => f.peerBased).length;

  if (!financials?.metric) {
    caveats.push('Fundamental metrics were unavailable, so most factors fell back to neutral defaults.');
  }
  if (!peerResult.complete) {
    caveats.push(
      peerResult.degradedReason
        ? `Industry comparison is limited: ${peerResult.degradedReason}.`
        : 'Industry comparison is limited by missing peer data.'
    );
  }
  if (!recommendations?.length) {
    caveats.push('No analyst coverage was returned for this symbol.');
  }

  let confidence: 'high' | 'medium' | 'low';
  if (!financials?.metric || peerBackedFactors === 0) {
    confidence = 'low';
  } else if (peerResult.complete && peerBackedFactors >= 3) {
    confidence = 'high';
  } else {
    confidence = 'medium';
  }

  const description = peerResult.complete
    ? `Scored against ${peers.length} ${industry} peers using median-based normalisation.`
    : `Limited peer data (${peers.length} of ${peerResult.requested} resolved). Factors without a peer baseline were scored against absolute thresholds.`;

  const breakdown: ScoreBreakdown = {
    growthScore: growth.score,
    profitabilityScore: profitability.score,
    valuationScore: valuation.score,
    qualityScore: quality.score,
    analystScore: analyst.score,
    description,
    confidence,
    caveats,
    details: {
      growth: growth.detail,
      profitability: profitability.detail,
      valuation: valuation.detail,
      quality: quality.detail,
      analyst: analyst.detail,
    },
    tooltips: {
      growth: growth.tooltip,
      profitability: profitability.tooltip,
      valuation: valuation.tooltip,
      quality: quality.tooltip,
      analyst: analyst.tooltip,
    },
    peerContext: {
      industry: benchmarks.industry,
      peerCount: benchmarks.peerCount,
      percentileRanks: {
        growth: growth.percentile,
        profitability: profitability.percentile,
        valuation: valuation.percentile,
        quality: quality.percentile,
        analyst: analyst.percentile,
      },
    },
  };

  return { score, breakdown, benchmarks };
}
