/**
 * FactorFive scoring engine.
 *
 * Five factors, 20 points each, summing to 0-100:
 *   Growth, Quality, Valuation, Momentum, Analyst.
 *
 * Three properties matter more than any individual formula.
 *
 * 1. ROBUST BENCHMARKS. Peers are summarised by median and MAD with winsorized
 *    tails rather than mean and standard deviation. Finnhub peer lists contain
 *    unvetted micro-caps; on AAPL the old mean-based benchmark reported 149%
 *    "average" industry revenue growth and -20% net margin, which scored Apple
 *    3/20 on growth. See lib/stats.ts.
 *
 * 2. HONEST DEGRADATION. When peer data is missing the engine does not invent
 *    a comparison. An empty peer set once produced z-score 0 for every factor,
 *    which the sigmoid mapped to exactly half marks, so any rate-limited
 *    request silently returned ~50/100 while the UI claimed a full peer
 *    analysis. Factors that cannot be computed against peers fall back to
 *    absolute thresholds and are reported at lower confidence.
 *
 * 3. PRICED LIVE. Valuation and Momentum are computed at the live share price
 *    (lib/metrics.ts), so the score moves when the price does. Previously
 *    nothing in the score depended on today's price at all: a simulated 6%
 *    drop changed none of eight sampled scores, and the valuation ratios it
 *    did use were priced days to months in the past. Growth, Quality and
 *    Analyst describe the business and still move only when it reports.
 *
 * Quality absorbed the former Profitability factor. The two overlapped - ROE
 * and ROA are both returns on capital - so "profitable" was counted twice, at
 * 40% of the score, and Momentum takes the slot that freed.
 */

import type {
  FinnhubBasicFinancials,
  FinnhubRecommendationTrend,
  PeerMetrics,
  IndustryBenchmarks,
  MetricDistribution,
  ScoreBreakdown,
  BenchmarkMetric,
} from '@/types/stock';
import type { PeerMetricsResult } from '@/lib/finnhub';
import type { LiveMetrics } from '@/lib/metrics';
import { debtToEquity, currentRatio } from '@/lib/metrics';
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
  /** Unrounded, 0-20. Rounded once, for the total, in apportion(). */
  points: number;
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

/** Every metric the engine scores, with its sane range for clamping. */
const RANGES: Record<BenchmarkMetric, readonly [number, number]> = {
  revenueGrowth: SANE_RANGES.growthPct,
  epsGrowth: SANE_RANGES.growthPct,
  roe: SANE_RANGES.returnPct,
  netMargin: SANE_RANGES.marginPct,
  operatingMargin: SANE_RANGES.marginPct,
  debtEquity: SANE_RANGES.leverage,
  currentRatio: SANE_RANGES.liquidity,
  pe: SANE_RANGES.ratio,
  pb: SANE_RANGES.ratio,
  relative52W: SANE_RANGES.relativePct,
  relative13W: SANE_RANGES.relativePct,
  drawdown: SANE_RANGES.drawdownPct,
};

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

/**
 * Round factor points to whole numbers that sum EXACTLY to `total`, using the
 * largest-remainder method.
 *
 * Each factor used to be rounded on its own and the rounded values summed.
 * That swallowed small moves: a day that cost three factors 0.4 points each
 * left every one of them on the same integer, so the headline did not move at
 * all though the true total fell by 1.2. Rounding once, at the total, and then
 * apportioning keeps the bars on screen adding up to the number beside them.
 */
function apportion(points: number[], total: number): number[] {
  const floors = points.map((p) => Math.floor(p));
  let remaining = total - floors.reduce((a, b) => a + b, 0);
  const byRemainder = points
    .map((p, i) => ({ i, frac: p - Math.floor(p) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of byRemainder) {
    if (remaining <= 0) break;
    floors[i] += 1;
    remaining -= 1;
  }
  return floors;
}

function averagePercentile(values: Array<number | null>): number | null {
  const usable = clean(values);
  return usable.length ? Math.round(usable.reduce((a, b) => a + b, 0) / usable.length) : null;
}

const isNum = (v: number | undefined | null): v is number =>
  v !== undefined && v !== null && Number.isFinite(v);

function num(v: number | undefined | null, digits = 1): string {
  return isNum(v) ? v.toFixed(digits) : 'n/a';
}

/** Describe where a value sits relative to a peer distribution, in words. */
function vsMedian(value: number | undefined, dist: MetricDistribution | null, unit = '%'): string {
  if (!isNum(value)) return 'no company data';
  if (!dist) return `${value.toFixed(1)}${unit} (no peer baseline)`;
  const delta = value - dist.median;
  const direction = delta >= 0 ? 'above' : 'below';
  return `${value.toFixed(1)}${unit} vs peer median ${dist.median.toFixed(1)}${unit} (${Math.abs(delta).toFixed(1)}${unit} ${direction})`;
}

/** "12.3 pts ahead of the S&P 500 (peer median -4.0)". */
function vsMarket(value: number | undefined, dist: MetricDistribution | null): string {
  if (!isNum(value)) return 'n/a';
  const words = `${Math.abs(value).toFixed(1)} pts ${value >= 0 ? 'ahead of' : 'behind'} the S&P 500`;
  return dist ? `${words} (peer median ${dist.median >= 0 ? '+' : ''}${dist.median.toFixed(1)})` : words;
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
  return describe(clean(values).map((v) => clampSane(v, range as [number, number])));
}

/** The company's own value for every benchmarked metric, as scored. */
function subjectValues(
  financials: FinnhubBasicFinancials | null,
  live: LiveMetrics
): IndustryBenchmarks['subject'] {
  const m = financials?.metric;
  return {
    revenueGrowth: m?.revenueGrowthQuarterlyYoy ?? m?.revenueGrowthAnnual,
    epsGrowth: m?.epsGrowthQuarterlyYoy ?? m?.epsGrowthAnnual,
    roe: m?.roeRfy,
    netMargin: m?.netProfitMarginAnnual,
    operatingMargin: m?.operatingMarginAnnual,
    debtEquity: debtToEquity(m),
    currentRatio: currentRatio(m),
    pe: live.pe,
    pb: live.pb,
    relative52W: live.relative52W,
    relative13W: live.relative13W,
    drawdown: live.drawdown,
  };
}

export function calculateIndustryBenchmarks(
  peers: PeerMetrics[],
  industry: string,
  reliable: boolean,
  subject: IndustryBenchmarks['subject'] = {}
): IndustryBenchmarks {
  const dist = (key: BenchmarkMetric, values: Array<number | undefined>) =>
    describeClamped(values, RANGES[key]);
  // Negative earnings or book make a multiple meaningless rather than cheap.
  const positiveOnly = (v: number | undefined) => (v !== undefined && v > 0 ? v : undefined);

  return {
    industry,
    peerCount: peers.length,
    reliable,
    distributions: {
      revenueGrowth: dist('revenueGrowth', peers.map((p) => p.revenueGrowth)),
      epsGrowth: dist('epsGrowth', peers.map((p) => p.epsGrowth)),
      roe: dist('roe', peers.map((p) => p.roe)),
      netMargin: dist('netMargin', peers.map((p) => p.netMargin)),
      operatingMargin: dist('operatingMargin', peers.map((p) => p.operatingMargin)),
      debtEquity: dist('debtEquity', peers.map((p) => p.debtEquity)),
      currentRatio: dist('currentRatio', peers.map((p) => p.currentRatio)),
      pe: dist('pe', peers.map((p) => positiveOnly(p.pe))),
      pb: dist('pb', peers.map((p) => positiveOnly(p.pb))),
      relative52W: dist('relative52W', peers.map((p) => p.relative52W)),
      relative13W: dist('relative13W', peers.map((p) => p.relative13W)),
      drawdown: dist('drawdown', peers.map((p) => p.drawdown)),
    },
    subject,
  };
}

/** GROWTH - revenue and EPS growth versus peers. */
function calculateGrowthScore(
  subject: IndustryBenchmarks['subject'],
  peers: PeerMetrics[],
  benchmarks: IndustryBenchmarks
): FactorResult {
  const d = benchmarks.distributions;

  const rev = scoreMetric(subject.revenueGrowth, peers.map((p) => p.revenueGrowth), 10, {
    thresholds: [0, 5, 12, 25],
    sane: RANGES.revenueGrowth,
  });
  const eps = scoreMetric(subject.epsGrowth, peers.map((p) => p.epsGrowth), 10, {
    thresholds: [0, 8, 15, 30],
    sane: RANGES.epsGrowth,
  });

  const peerBased = rev.peerBased || eps.peerBased;

  return {
    points: rev.points + eps.points,
    detail: `Revenue ${vsMedian(subject.revenueGrowth, d.revenueGrowth)}; EPS ${vsMedian(subject.epsGrowth, d.epsGrowth)}`,
    tooltip: peerBased
      ? `Growth ranked against ${benchmarks.peerCount} ${benchmarks.industry} peers using median-based normalisation.`
      : `Not enough peer data for an industry comparison. Scored against absolute growth thresholds instead.`,
    percentile: averagePercentile([rev.percentile, eps.percentile]),
    peerBased,
  };
}

/**
 * QUALITY - how profitable the business is, and how safely it is financed.
 *
 * Twelve points of profitability (returns and margins) and eight of balance
 * sheet (leverage and liquidity). ROA was dropped in the merge: return on
 * equity already carries it, scaled by leverage, which is scored separately.
 */
function calculateQualityScore(
  subject: IndustryBenchmarks['subject'],
  peers: PeerMetrics[],
  benchmarks: IndustryBenchmarks
): FactorResult {
  const d = benchmarks.distributions;

  const roe = scoreMetric(subject.roe, peers.map((p) => p.roe), 5, {
    thresholds: [0, 8, 15, 25],
    sane: RANGES.roe,
  });
  const op = scoreMetric(subject.operatingMargin, peers.map((p) => p.operatingMargin), 4, {
    thresholds: [0, 8, 15, 25],
    sane: RANGES.operatingMargin,
  });
  const net = scoreMetric(subject.netMargin, peers.map((p) => p.netMargin), 3, {
    thresholds: [0, 5, 12, 20],
    sane: RANGES.netMargin,
  });
  const de = scoreMetric(subject.debtEquity, peers.map((p) => p.debtEquity), 5, {
    lowerIsBetter: true,
    thresholds: [0.3, 0.8, 1.5, 2.5],
    sane: RANGES.debtEquity,
  });
  const cr = scoreMetric(subject.currentRatio, peers.map((p) => p.currentRatio), 3, {
    thresholds: [0.8, 1.0, 1.5, 2.0],
    sane: RANGES.currentRatio,
  });

  const parts = [roe, op, net, de, cr];
  const peerBased = parts.some((p) => p.peerBased);

  return {
    points: parts.reduce((total, p) => total + p.points, 0),
    detail:
      `ROE ${vsMedian(subject.roe, d.roe)}; operating margin ${num(subject.operatingMargin)}%; ` +
      `debt/equity ${num(subject.debtEquity, 2)}; current ratio ${num(subject.currentRatio, 2)}`,
    tooltip: peerBased
      ? `Returns, margins, leverage and liquidity versus ${benchmarks.peerCount} peers. Higher returns and a safer balance sheet score higher.`
      : `Scored against absolute profitability and balance-sheet thresholds - peer data unavailable.`,
    percentile: averagePercentile(parts.map((p) => p.percentile)),
    peerBased,
  };
}

/**
 * VALUATION - P/E and P/B at the live price, where lower is better.
 *
 * Trailing-twelve-month EPS and latest-quarter book value, both of which move
 * quarterly, divided into today's price. The old inputs were Finnhub's own
 * ratios: normalised annual P/E (NVDA's implied a price of $148 against a live
 * $137) and annual P/B, priced at the last fiscal year end ($186).
 */
function calculateValuationScore(
  subject: IndustryBenchmarks['subject'],
  live: LiveMetrics,
  peers: PeerMetrics[],
  benchmarks: IndustryBenchmarks
): FactorResult {
  const d = benchmarks.distributions;
  const positiveOnly = (v: number | undefined) => (v !== undefined && v > 0 ? v : undefined);

  const pe = scoreMetric(subject.pe, peers.map((p) => positiveOnly(p.pe)), 12, {
    lowerIsBetter: true,
    thresholds: [10, 18, 28, 45],
    sane: RANGES.pe,
  });
  const pb = scoreMetric(subject.pb, peers.map((p) => positiveOnly(p.pb)), 8, {
    lowerIsBetter: true,
    thresholds: [1.5, 3, 6, 10],
    sane: RANGES.pb,
  });

  const peerBased = pe.peerBased || pb.peerBased;
  const peNote = live.lossMaking
    ? 'P/E not meaningful (trailing losses)'
    : `P/E ${vsMedian(subject.pe, d.pe, '')}`;
  const at = live.price > 0 ? `At $${live.price.toFixed(2)}: ` : '';

  return {
    points: pe.points + pb.points,
    detail: `${at}${peNote}; P/B ${vsMedian(subject.pb, d.pb, '')}`,
    tooltip: peerBased
      ? `At today's price. Cheaper than sector peers scores higher. Ranked against ${benchmarks.peerCount} peers.`
      : `At today's price, scored against absolute valuation bands - peer data unavailable.`,
    percentile: averagePercentile([pe.percentile, pb.percentile]),
    peerBased,
  };
}

/**
 * MOMENTUM - the price trend, at the live price.
 *
 * Twelve-month and three-month return against the S&P 500, and distance from
 * the 52-week high. All three are carried to today's price, so a day's move
 * registers the same day.
 *
 * No one-month window on purpose: at that horizon returns tend to partly
 * reverse rather than persist, so scoring it would reward noise. A sharp day
 * still counts - it moves all three measures - but a single day cannot
 * dominate a trend measured over a quarter and a year.
 */
function calculateMomentumScore(
  subject: IndustryBenchmarks['subject'],
  peers: PeerMetrics[],
  benchmarks: IndustryBenchmarks
): FactorResult {
  const d = benchmarks.distributions;

  const year = scoreMetric(subject.relative52W, peers.map((p) => p.relative52W), 8, {
    thresholds: [-20, -5, 5, 20],
    sane: RANGES.relative52W,
  });
  const quarter = scoreMetric(subject.relative13W, peers.map((p) => p.relative13W), 6, {
    thresholds: [-10, -3, 3, 10],
    sane: RANGES.relative13W,
  });
  const high = scoreMetric(subject.drawdown, peers.map((p) => p.drawdown), 6, {
    lowerIsBetter: true,
    thresholds: [5, 12, 25, 40],
    sane: RANGES.drawdown,
  });

  const peerBased = year.peerBased || quarter.peerBased || high.peerBased;
  const drawdown = isNum(subject.drawdown)
    ? subject.drawdown < 0.5
      ? 'at its 52-week high'
      : `${subject.drawdown.toFixed(0)}% below its 52-week high`
    : '52-week high unavailable';

  return {
    points: year.points + quarter.points + high.points,
    detail: `12 months: ${vsMarket(subject.relative52W, d.relative52W)}; 3 months: ${vsMarket(subject.relative13W, d.relative13W)}; ${drawdown}`,
    tooltip: peerBased
      ? `Price trend at today's price: return against the S&P 500 over twelve and three months, and distance from the 52-week high, versus ${benchmarks.peerCount} peers.`
      : `Price trend at today's price, scored against absolute thresholds - peer data unavailable.`,
    percentile: averagePercentile([year.percentile, quarter.percentile, high.percentile]),
    peerBased,
  };
}

/**
 * ANALYST - consensus ratings.
 * This factor is inherently absolute rather than peer-relative.
 *
 * This previously split its 20 points as 12 for ratings and 8 for price-target
 * upside. `/stock/price-target` is premium-only, so on a free key the target
 * was always null and every stock silently collected the same neutral 4 of
 * those 8 points: a dead fifth of the factor that discriminated between
 * nothing, cost an upstream call per symbol against a 60/minute ceiling, and
 * printed "No price target available" on every page. Ratings now carry all 20.
 */
function calculateAnalystScore(recommendations: FinnhubRecommendationTrend[]): FactorResult {
  let points = 10; // neutral default out of 20
  let detail = 'No analyst ratings available';

  const latest = recommendations?.[0];
  if (latest) {
    const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
    if (total > 0) {
      // Weighted mean on a 1 (strong sell) to 5 (strong buy) scale.
      const weighted =
        (latest.strongBuy * 5 + latest.buy * 4 + latest.hold * 3 + latest.sell * 2 + latest.strongSell) /
        total;
      points = ((weighted - 1) / 4) * 20;
      const bullish = latest.strongBuy + latest.buy;
      detail = `${bullish}/${total} analysts rate Buy or better (consensus ${weighted.toFixed(1)}/5)`;
    }
  }

  return {
    points,
    detail,
    tooltip: 'Analyst consensus rating across covering analysts. Absolute rather than peer-relative.',
    percentile: null,
    peerBased: false,
  };
}

/**
 * Compose the five factors into a 0-100 score.
 */
export function calculateIntelligentStockScore(
  symbol: string,
  financials: FinnhubBasicFinancials | null,
  recommendations: FinnhubRecommendationTrend[],
  peerResult: PeerMetricsResult,
  industry: string,
  live: LiveMetrics
): { score: number; breakdown: ScoreBreakdown; benchmarks: IndustryBenchmarks } {
  const peers = peerResult.peers;
  const subject = subjectValues(financials, live);
  const benchmarks = calculateIndustryBenchmarks(peers, industry, peerResult.complete, subject);

  const growth = calculateGrowthScore(subject, peers, benchmarks);
  const quality = calculateQualityScore(subject, peers, benchmarks);
  const valuation = calculateValuationScore(subject, live, peers, benchmarks);
  const momentum = calculateMomentumScore(subject, peers, benchmarks);
  const analyst = calculateAnalystScore(recommendations);

  const factors = [growth, quality, valuation, momentum, analyst];
  const exact = factors.reduce((total, f) => total + f.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(exact)));
  const [growthScore, qualityScore, valuationScore, momentumScore, analystScore] = apportion(
    factors.map((f) => f.points),
    score
  );

  // Confidence reflects how much of the score rested on real comparisons.
  const caveats: string[] = [];
  const peerBackedFactors = [growth, quality, valuation, momentum].filter((f) => f.peerBased).length;

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
  if (live.marketAdjustmentMissing) {
    caveats.push(
      "Momentum could not net out today's S&P 500 move, because index data was unavailable."
    );
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
    growthScore,
    qualityScore,
    valuationScore,
    momentumScore,
    analystScore,
    pricedAt: live.price,
    description,
    confidence,
    caveats,
    details: {
      growth: growth.detail,
      quality: quality.detail,
      valuation: valuation.detail,
      momentum: momentum.detail,
      analyst: analyst.detail,
    },
    tooltips: {
      growth: growth.tooltip,
      quality: quality.tooltip,
      valuation: valuation.tooltip,
      momentum: momentum.tooltip,
      analyst: analyst.tooltip,
    },
    peerContext: {
      industry: benchmarks.industry,
      peerCount: benchmarks.peerCount,
      percentileRanks: {
        growth: growth.percentile,
        quality: quality.percentile,
        valuation: valuation.percentile,
        momentum: momentum.percentile,
        analyst: analyst.percentile,
      },
    },
  };

  return { score, breakdown, benchmarks };
}
