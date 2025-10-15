/**
 * Intelligent Stock Scoring Engine
 * 
 * Context-aware scoring system that uses relative analysis and industry comparisons
 * rather than absolute thresholds. Scores are normalized using z-scores and percentile
 * rankings against peer companies in the same industry.
 * 
 * Each component (Growth, Profitability, Valuation, Momentum, Analyst) is scored 0-20
 * based on how the company compares to:
 * 1. Its own historical performance (3-5 year trends)
 * 2. Industry/sector peers (median and distribution)
 * 3. Broader market benchmarks where applicable
 */

import type {
  FinnhubQuote,
  FinnhubBasicFinancials,
  FinnhubRecommendationTrend,
  FinnhubPriceTarget,
  PeerMetrics,
  IndustryBenchmarks,
  ScoreBreakdown,
} from '@/types/stock';

/**
 * Calculate z-score for a value within a dataset
 * Z-score represents how many standard deviations a value is from the mean
 */
function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Calculate percentile rank (0-100) of a value within an array
 * Higher percentile = better performance relative to peers
 */
function calculatePercentile(value: number, values: number[]): number {
  if (values.length === 0) return 50; // Default to median if no data
  const sorted = [...values].sort((a, b) => a - b);
  const index = sorted.findIndex(v => v >= value);
  if (index === -1) return 100; // Value is highest
  return (index / sorted.length) * 100;
}

/**
 * Convert z-score to a 0-20 point score using AGGRESSIVE NON-LINEAR transformation
 * 
 * This creates MAXIMUM separation between companies:
 * - Z-score of -2 (2 std devs below) = 0-1 points (poor performers crushed)
 * - Z-score of -1 (1 std dev below) = 2-4 points (below average heavily penalized)
 * - Z-score of 0 (average) = 10 points (neutral baseline)
 * - Z-score of +1 (1 std dev above) = 16-17 points (above average strongly rewarded)
 * - Z-score of +2 (2 std devs above) = 19-20 points (excellent performers maxed out)
 * 
 * Uses STEEP sigmoid with power amplification for extreme separation
 */
function zScoreToPoints(zScore: number, maxPoints: number = 20): number {
  // Clamp z-score to reasonable bounds
  const clampedZ = Math.max(-3, Math.min(3, zScore));
  
  // MUCH STEEPER sigmoid for aggressive separation
  // Increased steepness from 1.5 to 2.5 for more dramatic differences
  const steepness = 2.5;
  let sigmoid = 1 / (1 + Math.exp(-steepness * clampedZ));
  
  // Additional power amplification for positive scores
  // This pushes good performers even higher while crushing poor ones
  if (clampedZ > 0) {
    // For above-average stocks, apply power function to amplify further
    // This makes +1 std dev → ~17 points instead of ~15
    const powerFactor = 1 + (clampedZ * 0.15); // Amplifies by up to 45% at z=+3
    sigmoid = Math.min(1, sigmoid * powerFactor);
  } else if (clampedZ < 0) {
    // For below-average stocks, apply exponential decay
    // This makes -1 std dev → ~3 points instead of ~5
    const decayFactor = 1 - (Math.abs(clampedZ) * 0.15); // Reduces by up to 45% at z=-3
    sigmoid = Math.max(0, sigmoid * decayFactor);
  }
  
  const points = sigmoid * maxPoints;
  
  return Math.max(0, Math.min(maxPoints, points));
}

/**
 * Calculate industry benchmarks from peer metrics
 */
export function calculateIndustryBenchmarks(
  peerMetrics: PeerMetrics[],
  industry: string
): IndustryBenchmarks {
  const validRevGrowth = peerMetrics.map(p => p.revenueGrowth).filter(v => v !== undefined) as number[];
  const validEpsGrowth = peerMetrics.map(p => p.epsGrowth).filter(v => v !== undefined) as number[];
  const validRoe = peerMetrics.map(p => p.roe).filter(v => v !== undefined) as number[];
  const validNetMargin = peerMetrics.map(p => p.netMargin).filter(v => v !== undefined) as number[];
  const validOpMargin = peerMetrics.map(p => p.operatingMargin).filter(v => v !== undefined) as number[];
  const validPe = peerMetrics.map(p => p.pe).filter(v => v !== undefined) as number[];
  const validPb = peerMetrics.map(p => p.pb).filter(v => v !== undefined) as number[];
  const validMom1M = peerMetrics.map(p => p.momentum1M).filter(v => v !== undefined) as number[];
  const validMom3M = peerMetrics.map(p => p.momentum3M).filter(v => v !== undefined) as number[];

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return {
    industry,
    peerCount: peerMetrics.length,
    avgRevenueGrowth: avg(validRevGrowth),
    avgEpsGrowth: avg(validEpsGrowth),
    avgRoe: avg(validRoe),
    avgNetMargin: avg(validNetMargin),
    avgOperatingMargin: avg(validOpMargin),
    avgPe: avg(validPe),
    avgPb: avg(validPb),
    avgMomentum1M: avg(validMom1M),
    avgMomentum3M: avg(validMom3M),
  };
}

/**
 * GROWTH SCORE (0-20 points)
 * 
 * Analyzes revenue growth, EPS growth, and margin expansion trends.
 * Compares to industry peers and rewards consistent, stable growth over volatility.
 */
function calculateGrowthScore(
  financials: FinnhubBasicFinancials | null,
  peerMetrics: PeerMetrics[],
  benchmarks: IndustryBenchmarks
): { score: number; detail: string; tooltip: string; percentile: number } {
  if (!financials?.metric) {
    return {
      score: 10,
      detail: 'Limited growth data available',
      tooltip: 'Insufficient data for growth analysis',
      percentile: 50,
    };
  }

  const metric = financials.metric;
  
  // Get company's growth metrics (prefer quarterly for recency, fall back to annual)
  const revenueGrowth = metric.revenueGrowthQuarterlyYoy ?? metric.revenueGrowthAnnual ?? 0;
  const epsGrowth = metric.epsGrowthQuarterlyYoy ?? metric.epsGrowthAnnual ?? 0;
  
  // Extract peer growth rates
  const peerRevGrowth = peerMetrics.map(p => p.revenueGrowth).filter(v => v !== undefined) as number[];
  const peerEpsGrowth = peerMetrics.map(p => p.epsGrowth).filter(v => v !== undefined) as number[];

  // Calculate statistics for z-score
  const avgRevGrowth = benchmarks.avgRevenueGrowth;
  const avgEpsGrowth = benchmarks.avgEpsGrowth;
  
  const stdDevRevGrowth = Math.sqrt(
    peerRevGrowth.reduce((sum, v) => sum + Math.pow(v - avgRevGrowth, 2), 0) / Math.max(peerRevGrowth.length, 1)
  );
  const stdDevEpsGrowth = Math.sqrt(
    peerEpsGrowth.reduce((sum, v) => sum + Math.pow(v - avgEpsGrowth, 2), 0) / Math.max(peerEpsGrowth.length, 1)
  );

  // Calculate z-scores
  const revGrowthZScore = calculateZScore(revenueGrowth, avgRevGrowth, stdDevRevGrowth);
  const epsGrowthZScore = calculateZScore(epsGrowth, avgEpsGrowth, stdDevEpsGrowth);

  // Convert to points (10 points each for revenue and EPS)
  const revPoints = zScoreToPoints(revGrowthZScore, 10);
  const epsPoints = zScoreToPoints(epsGrowthZScore, 10);

  const totalScore = Math.round(revPoints + epsPoints);

  // Calculate overall percentile
  const compositeGrowth = (revenueGrowth + epsGrowth) / 2;
  const peerCompositeGrowth = peerMetrics
    .map(p => ((p.revenueGrowth ?? 0) + (p.epsGrowth ?? 0)) / 2);
  const percentile = Math.round(calculatePercentile(compositeGrowth, peerCompositeGrowth));

  // Generate contextual explanation
  const revComparison = revenueGrowth > avgRevGrowth ? 'above' : 'below';
  const epsComparison = epsGrowth > avgEpsGrowth ? 'above' : 'below';
  
  const detail = `Revenue: ${revenueGrowth.toFixed(1)}% (${revComparison} industry avg ${avgRevGrowth.toFixed(1)}%), EPS: ${epsGrowth.toFixed(1)}% (${epsComparison} avg ${avgEpsGrowth.toFixed(1)}%)`;
  
  const tooltip = `${percentile}th percentile vs ${benchmarks.peerCount} peers. ${
    totalScore >= 15 ? 'Strong' : totalScore >= 10 ? 'Average' : 'Below average'
  } growth relative to ${benchmarks.industry} sector`;

  return { score: totalScore, detail, tooltip, percentile };
}

/**
 * PROFITABILITY SCORE (0-20 points)
 * 
 * Evaluates operating margin, net margin, and ROE relative to peers.
 * High margins vs industry increase score; volatility or decline reduces it.
 */
function calculateProfitabilityScore(
  financials: FinnhubBasicFinancials | null,
  peerMetrics: PeerMetrics[],
  benchmarks: IndustryBenchmarks
): { score: number; detail: string; tooltip: string; percentile: number } {
  if (!financials?.metric) {
    return {
      score: 10,
      detail: 'Limited profitability data available',
      tooltip: 'Insufficient data for profitability analysis',
      percentile: 50,
    };
  }

  const metric = financials.metric;
  const roe = metric.roeRfy ?? 0;
  const netMargin = metric.netProfitMarginAnnual ?? 0;
  const opMargin = metric.operatingMarginAnnual ?? 0;

  // Extract peer profitability
  const peerRoe = peerMetrics.map(p => p.roe).filter(v => v !== undefined) as number[];
  const peerNetMargin = peerMetrics.map(p => p.netMargin).filter(v => v !== undefined) as number[];
  const peerOpMargin = peerMetrics.map(p => p.operatingMargin).filter(v => v !== undefined) as number[];

  // Calculate statistics
  const stdDevRoe = Math.sqrt(
    peerRoe.reduce((sum, v) => sum + Math.pow(v - benchmarks.avgRoe, 2), 0) / Math.max(peerRoe.length, 1)
  );
  const stdDevNetMargin = Math.sqrt(
    peerNetMargin.reduce((sum, v) => sum + Math.pow(v - benchmarks.avgNetMargin, 2), 0) / Math.max(peerNetMargin.length, 1)
  );
  const stdDevOpMargin = Math.sqrt(
    peerOpMargin.reduce((sum, v) => sum + Math.pow(v - benchmarks.avgOperatingMargin, 2), 0) / Math.max(peerOpMargin.length, 1)
  );

  // Calculate z-scores
  const roeZScore = calculateZScore(roe, benchmarks.avgRoe, stdDevRoe);
  const netMarginZScore = calculateZScore(netMargin, benchmarks.avgNetMargin, stdDevNetMargin);
  const opMarginZScore = calculateZScore(opMargin, benchmarks.avgOperatingMargin, stdDevOpMargin);

  // Convert to points (weighted: ROE 8pts, Net Margin 6pts, Op Margin 6pts)
  const roePoints = zScoreToPoints(roeZScore, 8);
  const netMarginPoints = zScoreToPoints(netMarginZScore, 6);
  const opMarginPoints = zScoreToPoints(opMarginZScore, 6);

  const totalScore = Math.round(roePoints + netMarginPoints + opMarginPoints);

  // Calculate percentile
  const compositeProfitability = (roe + netMargin + opMargin) / 3;
  const peerCompositeProfitability = peerMetrics.map(
    p => ((p.roe ?? 0) + (p.netMargin ?? 0) + (p.operatingMargin ?? 0)) / 3
  );
  const percentile = Math.round(calculatePercentile(compositeProfitability, peerCompositeProfitability));

  const detail = `ROE: ${roe.toFixed(1)}% (avg ${benchmarks.avgRoe.toFixed(1)}%), Net margin: ${netMargin.toFixed(1)}% (avg ${benchmarks.avgNetMargin.toFixed(1)}%)`;
  const tooltip = `${percentile}th percentile. ${
    totalScore >= 15 ? 'Highly profitable' : totalScore >= 10 ? 'Average profitability' : 'Below average margins'
  } vs ${benchmarks.industry} peers`;

  return { score: totalScore, detail, tooltip, percentile };
}

/**
 * VALUATION SCORE (0-20 points)
 * 
 * Sophisticated valuation analysis that considers:
 * 1. P/E relative to industry (with tolerance for reasonable premiums)
 * 2. P/B relative to industry
 * 3. PEG ratio (P/E justified by growth) when available
 * 4. Industry context (tech can have higher multiples than banks)
 * 
 * Does NOT blindly penalize valuations above industry average - considers if they're justified.
 */
function calculateValuationScore(
  financials: FinnhubBasicFinancials | null,
  peerMetrics: PeerMetrics[],
  benchmarks: IndustryBenchmarks
): { score: number; detail: string; tooltip: string; percentile: number } {
  if (!financials?.metric) {
    return {
      score: 10,
      detail: 'Limited valuation data available',
      tooltip: 'Insufficient data for valuation analysis',
      percentile: 50,
    };
  }

  const metric = financials.metric;
  const pe = metric.peNormalizedAnnual ?? 0;
  const pb = metric.pbAnnual ?? 0;
  const peg = metric.pegAnnual;

  // Skip scoring if P/E is invalid or extreme
  if (pe <= 0 || pe > 500) {
    return {
      score: 10,
      detail: 'P/E not meaningful for valuation',
      tooltip: 'Company may be unprofitable or have unusual earnings',
      percentile: 50,
    };
  }

  // Extract peer valuations (filter outliers)
  const peerPe = peerMetrics
    .map(p => p.pe)
    .filter(v => v !== undefined && v > 0 && v < 500) as number[];
  const peerPb = peerMetrics
    .map(p => p.pb)
    .filter(v => v !== undefined && v > 0) as number[];

  // If insufficient peer data, use absolute but generous thresholds
  if (peerPe.length < 3) {
    let score = 10; // Start neutral
    
    // Generous absolute thresholds (industry-agnostic baseline)
    if (pe < 15) score = 18; // Very cheap
    else if (pe < 25) score = 15; // Reasonable
    else if (pe < 35) score = 12; // Fair
    else if (pe < 50) score = 10; // Slightly expensive
    else score = 8; // Expensive
    
    // PEG adjustment if available
    if (peg && peg > 0) {
      if (peg < 1) score += 2; // Growth at discount
      else if (peg > 2) score -= 2; // Expensive for growth
    }

    return {
      score: Math.max(0, Math.min(20, score)),
      detail: `P/E: ${pe.toFixed(1)}x, P/B: ${pb.toFixed(1)}x${peg ? `, PEG: ${peg.toFixed(2)}` : ''}`,
      tooltip: 'Limited peer data; using absolute valuation assessment',
      percentile: 50,
    };
  }

  // Calculate industry statistics
  const avgPe = benchmarks.avgPe;
  const stdDevPe = Math.sqrt(
    peerPe.reduce((sum, v) => sum + Math.pow(v - avgPe, 2), 0) / peerPe.length
  );

  // Calculate relative valuation (how much above/below industry)
  const peRatio = pe / avgPe; // 1.0 = at average, 1.2 = 20% premium, 0.8 = 20% discount
  
  // Score P/E with AGGRESSIVE non-linear approach (12 points max)
  // Heavily rewards undervaluation, severely penalizes overvaluation
  let peScore = 0;
  
  if (peRatio <= 0.6) {
    // 40%+ discount to industry = exceptional value
    peScore = 12;
  } else if (peRatio <= 0.75) {
    // 25-40% discount = excellent value
    peScore = 11.5;
  } else if (peRatio <= 0.85) {
    // 15-25% discount = very good value
    peScore = 10.5;
  } else if (peRatio <= 0.95) {
    // 5-15% discount = good value
    peScore = 9.5;
  } else if (peRatio <= 1.05) {
    // Within 5% of industry average = fair/neutral
    peScore = 8;
  } else if (peRatio <= 1.15) {
    // 5-15% premium = acceptable if justified
    peScore = 6.5;
  } else if (peRatio <= 1.30) {
    // 15-30% premium = concerning
    peScore = 4.5;
  } else if (peRatio <= 1.50) {
    // 30-50% premium = expensive
    peScore = 3;
  } else if (peRatio <= 2.0) {
    // 50-100% premium = very expensive
    peScore = 1.5;
  } else {
    // 100%+ premium = extremely overvalued
    peScore = 0.5;
  }

  // PEG Ratio Adjustment (can add up to 5 points or subtract up to 4)
  // PEG < 1 means P/E is justified by growth (good value)
  // PEG > 2 means expensive even accounting for growth
  let pegAdjustment = 0;
  if (peg && peg > 0) {
    if (peg < 0.5) {
      pegAdjustment = 5; // Exceptional - growth at steep discount
    } else if (peg < 0.8) {
      pegAdjustment = 4; // Excellent - growth at discount
    } else if (peg < 1.0) {
      pegAdjustment = 2.5; // Great - reasonable price for growth
    } else if (peg < 1.3) {
      pegAdjustment = 1; // Fair - growth justifies some premium
    } else if (peg < 1.8) {
      pegAdjustment = -0.5; // Slightly expensive for growth
    } else if (peg < 2.5) {
      pegAdjustment = -2; // Expensive even with growth
    } else {
      pegAdjustment = -4; // Very expensive relative to growth
    }
  }

  peScore = Math.max(0, Math.min(12, peScore + pegAdjustment));

  // Score P/B (8 points max) - aggressive industry-relative scoring
  let pbScore = 4; // Default neutral (reduced from 6)
  if (pb > 0 && peerPb.length >= 3) {
    const avgPb = benchmarks.avgPb;
    const pbRatio = pb / avgPb;
    
    if (pbRatio <= 0.6) pbScore = 8; // Deep discount
    else if (pbRatio <= 0.75) pbScore = 7.5; // Strong discount
    else if (pbRatio <= 0.9) pbScore = 6.5; // Good discount
    else if (pbRatio <= 1.0) pbScore = 5; // Slight discount
    else if (pbRatio <= 1.15) pbScore = 3.5; // Slight premium
    else if (pbRatio <= 1.35) pbScore = 2; // Moderate premium
    else if (pbRatio <= 1.6) pbScore = 1; // High premium
    else pbScore = 0.5; // Very high premium
  }

  const totalScore = Math.round(peScore + pbScore);

  // Calculate percentile (inverted - lower P/E = higher percentile)
  const invertedPercentile = 100 - Math.round(calculatePercentile(pe, peerPe));
  const percentile = Math.max(0, Math.min(100, invertedPercentile));

  // Generate contextual explanation
  const peDiff = ((pe - avgPe) / avgPe) * 100;
  let peRelative: string;
  
  if (Math.abs(peDiff) < 5) {
    peRelative = 'in line with';
  } else if (peDiff < 0) {
    peRelative = `${Math.abs(peDiff).toFixed(0)}% below`;
  } else {
    peRelative = `${peDiff.toFixed(0)}% above`;
  }

  const detail = `P/E: ${pe.toFixed(1)}x (${peRelative} industry ${avgPe.toFixed(1)}x)${peg ? `, PEG: ${peg.toFixed(2)}` : ''}, P/B: ${pb.toFixed(1)}x`;
  
  let valuationAssessment: string;
  if (totalScore >= 16) valuationAssessment = 'Excellent value';
  else if (totalScore >= 14) valuationAssessment = 'Attractive valuation';
  else if (totalScore >= 11) valuationAssessment = 'Fair valuation';
  else if (totalScore >= 8) valuationAssessment = 'Slightly expensive';
  else valuationAssessment = 'Premium valuation';

  const tooltip = `${percentile}th percentile. ${valuationAssessment} - ${peRatio < 1 ? 'trading below' : peRatio <= 1.15 ? 'near' : 'above'} ${benchmarks.industry} average`;

  return { score: totalScore, detail, tooltip, percentile };
}

/**
 * QUALITY SCORE (0-20 points) - REFINED FRAMEWORK
 * 
 * Comprehensive 4-component quality analysis:
 * 1. Balance Sheet Strength (5 pts) - D/E, liquidity, interest coverage
 * 2. Earnings Stability (5 pts) - EPS consistency, volatility, positive streak
 * 3. Cash Flow Quality (5 pts) - FCF margin, cash conversion ratio
 * 4. Capital Efficiency (5 pts) - ROIC, ROA, historical stability
 * 
 * Designed to prevent mega-caps with strong fundamentals from scoring below 10/20.
 */
function calculateQualityScore(
  financials: FinnhubBasicFinancials | null,
  peerMetrics: PeerMetrics[],
  benchmarks: IndustryBenchmarks
): { score: number; detail: string; tooltip: string; percentile: number } {
  if (!financials?.metric) {
    return {
      score: 10,
      detail: 'Limited quality data available',
      tooltip: 'Measures financial strength, earnings consistency, and capital efficiency relative to peers',
      percentile: 50,
    };
  }

  const metric = financials.metric;
  
  // ===== 1. BALANCE SHEET STRENGTH (0-5 points) =====
  // Uses D/E ratio, current ratio, with special handling for mega-caps
  
  const debtToEquity = metric.debtEquityAnnual ?? 999;
  const currentRatio = metric.currentRatioAnnual ?? 1.0;
  // Interest coverage not available in Finnhub basic financials
  // Use low D/E as proxy for strong balance sheet
  const hasStrongBalanceSheet = debtToEquity < 0.5; // Low debt = likely good coverage
  
  // Extract peer balance sheet metrics
  const peerDebtEquity = peerMetrics.map(p => p.debtEquity).filter(v => v !== undefined && v < 500) as number[];
  const peerCurrentRatio = peerMetrics.map(p => p.currentRatio).filter(v => v !== undefined) as number[];
  
  const avgDebtEquity = peerDebtEquity.length > 0 
    ? peerDebtEquity.reduce((a, b) => a + b, 0) / peerDebtEquity.length 
    : 1.0;
  const stdDevDebtEquity = peerDebtEquity.length > 0
    ? Math.sqrt(peerDebtEquity.reduce((sum, v) => sum + Math.pow(v - avgDebtEquity, 2), 0) / peerDebtEquity.length)
    : 0.5;
  
  // D/E scoring with balance sheet strength safeguard (3 points max)
  let debtScore = 0;
  if (hasStrongBalanceSheet) {
    // If D/E < 0.5 (very low debt), assume strong financial position
    // Cap the penalty for D/E ratios below 2x
    if (debtToEquity < 2.0) {
      debtScore = 3; // Perfect score if D/E < 2x and low overall debt
    } else {
      // Still penalize excessive leverage
      const debtZScore = -calculateZScore(debtToEquity, avgDebtEquity, stdDevDebtEquity || 0.5);
      debtScore = Math.max(1.5, zScoreToPoints(debtZScore, 3)); // Floor at 1.5
    }
  } else {
    // Normal D/E scoring (inverted - lower is better)
    const debtZScore = -calculateZScore(debtToEquity, avgDebtEquity, stdDevDebtEquity || 0.5);
    debtScore = zScoreToPoints(debtZScore, 3);
  }
  
  // Current ratio scoring (2 points max) - weighted less for mega-caps
  const avgCurrentRatio = peerCurrentRatio.length > 0
    ? peerCurrentRatio.reduce((a, b) => a + b, 0) / peerCurrentRatio.length
    : 1.5;
  const stdDevCurrentRatio = peerCurrentRatio.length > 0
    ? Math.sqrt(peerCurrentRatio.reduce((sum, v) => sum + Math.pow(v - avgCurrentRatio, 2), 0) / peerCurrentRatio.length)
    : 0.5;
  const currentRatioZScore = calculateZScore(currentRatio, avgCurrentRatio, stdDevCurrentRatio || 0.5);
  const liquidityScore = zScoreToPoints(currentRatioZScore, 2);
  
  const balanceSheetScore = debtScore + liquidityScore; // 0-5 points
  
  // ===== 2. EARNINGS STABILITY (0-5 points) =====
  // Uses EPS volatility and consistency over time
  
  // Note: Finnhub doesn't provide 5-year EPS history in basic financials
  // We'll estimate stability using available growth metrics as proxy
  const epsGrowth = metric.epsGrowthAnnual ?? 0;
  const epsGrowthQuarterly = metric.epsGrowthQuarterlyYoy ?? epsGrowth;
  
  let earningsStabilityScore = 2.5; // Default neutral
  
  // Bonus for consistent positive EPS (proxy using growth and margins)
  // Since EPS actual values aren't in basic financials, use profitability as proxy
  const netMargin = metric.netProfitMarginAnnual ?? 0;
  const hasPositiveEarnings = netMargin > 0 && epsGrowth > -50; // Not massively negative
  
  if (hasPositiveEarnings) {
    // Positive earnings = bonus
    earningsStabilityScore += 1.5;
    
    // Additional bonus if growth is consistent (quarterly vs annual similar)
    const growthConsistency = Math.abs(epsGrowth - epsGrowthQuarterly);
    if (growthConsistency < 10) {
      earningsStabilityScore += 1; // Consistent growth = +1 bonus
    }
  } else {
    // Negative earnings = penalty
    earningsStabilityScore = Math.max(0, earningsStabilityScore - 1.5);
  }
  
  earningsStabilityScore = Math.min(5, Math.max(0, earningsStabilityScore)); // Clamp 0-5
  
  // ===== 3. CASH FLOW QUALITY (0-5 points) =====
  // Since FCF data isn't in basic financials, use profitability margins as proxy
  // Companies with high operating margins typically generate strong cash flow
  
  const operatingMargin = metric.operatingMarginAnnual ?? 0;
  const netProfitMargin = metric.netProfitMarginAnnual ?? 0;
  
  let cashFlowScore = 2.5; // Default neutral
  
  // Use operating margin as FCF proxy (companies with high operating margins usually have strong FCF)
  if (operatingMargin > 20 && netProfitMargin > 10) {
    // Very high margins = excellent cash generation potential
    cashFlowScore = 5;
  } else if (operatingMargin > 15 && netProfitMargin > 8) {
    // Strong margins = strong cash flow
    cashFlowScore = 4;
  } else if (operatingMargin > 10 && netProfitMargin > 5) {
    // Good margins = adequate cash flow
    cashFlowScore = 3.5;
  } else if (operatingMargin > 5 && netProfitMargin > 2) {
    // Modest margins = modest cash flow
    cashFlowScore = 2;
  } else if (operatingMargin < 0 || netProfitMargin < 0) {
    // Negative margins = cash flow concerns
    cashFlowScore = 0.5;
  }
  
  // ===== 4. CAPITAL EFFICIENCY (0-5 points) =====
  // Uses ROIC (or ROE as proxy) and ROA
  
  const roa = metric.roaRfy ?? 0;
  const roe = metric.roeRfy ?? 0;
  // ROIC not in basic financials, use ROE as proxy (highly correlated)
  const roic = roe;
  
  let capitalEfficiencyScore = 0;
  
  // ROIC scoring (3 points)
  if (roic > 15) {
    capitalEfficiencyScore += 3; // Excellent
  } else if (roic > 10) {
    capitalEfficiencyScore += 2.5; // Strong
  } else if (roic > 5) {
    capitalEfficiencyScore += 1.5; // Adequate
  } else if (roic > 0) {
    capitalEfficiencyScore += 0.5; // Weak
  }
  // ROIC < 0 = 0 points
  
  // ROA scoring (2 points) - relative to industry
  const peerRoa = peerMetrics.map(p => p.roa).filter(v => v !== undefined) as number[];
  const avgRoa = peerRoa.length > 0
    ? peerRoa.reduce((a, b) => a + b, 0) / peerRoa.length
    : benchmarks.avgRoe * 0.5;
  const stdDevRoa = peerRoa.length > 0
    ? Math.sqrt(peerRoa.reduce((sum, v) => sum + Math.pow(v - avgRoa, 2), 0) / peerRoa.length)
    : 2;
  const roaZScore = calculateZScore(roa, avgRoa, stdDevRoa);
  const roaScore = zScoreToPoints(roaZScore, 2);
  
  capitalEfficiencyScore += roaScore;
  capitalEfficiencyScore = Math.min(5, capitalEfficiencyScore); // Cap at 5
  
  // ===== TOTAL QUALITY SCORE =====
  const totalScore = Math.round(
    balanceSheetScore + 
    earningsStabilityScore + 
    cashFlowScore + 
    capitalEfficiencyScore
  );
  
  // MEGA-CAP SAFEGUARD: If company has strong FCF, ROIC > 10%, and positive earnings,
  // ensure minimum score of 10/20 (average) even with elevated debt
  const isMegaCap = (cashFlowScore >= 4 && capitalEfficiencyScore >= 3.5 && earningsStabilityScore >= 3.5);
  const finalScore = isMegaCap ? Math.max(10, totalScore) : totalScore;
  
  // Calculate composite percentile
  const compositeQuality = (
    balanceSheetScore * 20 + 
    earningsStabilityScore * 20 + 
    cashFlowScore * 20 + 
    capitalEfficiencyScore * 20
  );
  
  const peerCompositeQuality = peerMetrics.map(p => {
    // Simplified peer quality composite
    const pDebt = p.debtEquity ?? 1;
    const pCurrent = p.currentRatio ?? 1.5;
    const pRoa = p.roa ?? 0;
    return ((pDebt < 2 ? 50 : 30) + (pCurrent * 10) + (pRoa * 5));
  });
  
  const percentile = Math.round(calculatePercentile(compositeQuality, peerCompositeQuality));

  // Generate contextual explanation
  const qualityLevel = finalScore >= 16 ? 'exceptional quality' 
    : finalScore >= 13 ? 'strong quality'
    : finalScore >= 10 ? 'adequate quality'
    : finalScore >= 7 ? 'below average quality'
    : 'quality concerns';
  
  const detail = `Balance sheet: ${balanceSheetScore.toFixed(1)}/5, Earnings stability: ${earningsStabilityScore.toFixed(1)}/5, Cash flow: ${cashFlowScore.toFixed(1)}/5, Capital efficiency: ${capitalEfficiencyScore.toFixed(1)}/5`;
  
  const tooltip = `${percentile}th percentile. ${qualityLevel.charAt(0).toUpperCase() + qualityLevel.slice(1)} - Measures financial strength, earnings consistency, and capital efficiency relative to ${benchmarks.peerCount} peers`;

  return { score: finalScore, detail, tooltip, percentile };
}

/**
 * ANALYST SCORE (0-20 points)
 * 
 * Combines analyst recommendations and price target vs current price.
 */
function calculateAnalystScore(
  quote: FinnhubQuote,
  recommendations: FinnhubRecommendationTrend[],
  priceTarget: FinnhubPriceTarget | null
): { score: number; detail: string; tooltip: string; percentile: number } {
  let score = 10; // Default neutral score
  let detail = 'Limited analyst coverage';
  let tooltip = 'Insufficient analyst data';
  let percentile = 50;

  // Analyst recommendations (0-15 points)
  if (recommendations.length > 0) {
    const latest = recommendations[0];
    const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;

    if (total > 0) {
      const bullishPct = ((latest.strongBuy + latest.buy) / total) * 100;
      const bearishPct = ((latest.sell + latest.strongSell) / total) * 100;

      // Map bullish percentage to 0-15 points with NON-LINEAR curve
      // Rewards strong consensus (>80%) and penalizes bearish consensus (<30%)
      let recPoints = 0;
      if (bullishPct >= 85) {
        recPoints = 14 + (bullishPct - 85) / 15; // 14-15 points for 85-100%
      } else if (bullishPct >= 70) {
        recPoints = 11 + (bullishPct - 70) / 5; // 11-14 points for 70-85%
      } else if (bullishPct >= 55) {
        recPoints = 8 + (bullishPct - 55) / 5; // 8-11 points for 55-70%
      } else if (bullishPct >= 40) {
        recPoints = 5 + (bullishPct - 40) / 5; // 5-8 points for 40-55%
      } else if (bullishPct >= 25) {
        recPoints = 2.5 + (bullishPct - 25) / 6; // 2.5-5 points for 25-40%
      } else {
        recPoints = (bullishPct / 25) * 2.5; // 0-2.5 points for 0-25%
      }

      // Price target upside (0-5 points) - MORE AGGRESSIVE
      let targetPoints = 1; // Default neutral (reduced from 2.5)
      if (priceTarget?.targetMean) {
        const upside = ((priceTarget.targetMean - quote.c) / quote.c) * 100;
        
        if (upside > 30) targetPoints = 5; // Huge upside
        else if (upside > 20) targetPoints = 4.5; // Large upside
        else if (upside > 10) targetPoints = 3.5; // Good upside
        else if (upside > 5) targetPoints = 2.5; // Modest upside
        else if (upside > 0) targetPoints = 1.5; // Small upside
        else if (upside > -5) targetPoints = 0.5; // Small downside
        else targetPoints = 0; // Downside risk

        detail = `${bullishPct.toFixed(0)}% bullish (${latest.strongBuy + latest.buy}/${total}), ${upside.toFixed(1)}% to target`;
      } else {
        detail = `${bullishPct.toFixed(0)}% bullish consensus (${latest.strongBuy + latest.buy}/${total} analysts)`;
      }

      score = Math.round(recPoints + targetPoints);
      percentile = Math.round(bullishPct);
      
      tooltip = bearishPct > 30
        ? `${bearishPct.toFixed(0)}% bearish - analyst concerns present`
        : bullishPct > 70
        ? 'Strong bullish consensus - high analyst confidence'
        : 'Mixed analyst sentiment';
    }
  }

  return { score, detail, tooltip, percentile };
}

/**
 * Main function: Calculate comprehensive, context-aware stock score
 */
export function calculateIntelligentStockScore(
  symbol: string,
  quote: FinnhubQuote,
  financials: FinnhubBasicFinancials | null,
  recommendations: FinnhubRecommendationTrend[],
  priceTarget: FinnhubPriceTarget | null,
  peerMetrics: PeerMetrics[],
  industry: string
): { score: number; breakdown: ScoreBreakdown; benchmarks: IndustryBenchmarks } {
  
  // Calculate industry benchmarks
  const benchmarks = calculateIndustryBenchmarks(peerMetrics, industry);

  // Calculate each component score
  const growth = calculateGrowthScore(financials, peerMetrics, benchmarks);
  const profitability = calculateProfitabilityScore(financials, peerMetrics, benchmarks);
  const valuation = calculateValuationScore(financials, peerMetrics, benchmarks);
  const quality = calculateQualityScore(financials, peerMetrics, benchmarks);
  const analyst = calculateAnalystScore(quote, recommendations, priceTarget);

  // Calculate base total score
  let totalScore = growth.score + profitability.score + valuation.score + quality.score + analyst.score;

  // COMPOUND EXCELLENCE MULTIPLIER
  // Companies that excel in multiple areas get a bonus boost
  // This pushes truly exceptional companies from 70-75 range into 80-95 range
  const scores = [growth.score, profitability.score, valuation.score, quality.score, analyst.score];
  const strongScores = scores.filter(s => s >= 15).length; // Count metrics scoring 15+ (75th percentile)
  const excellentScores = scores.filter(s => s >= 17).length; // Count metrics scoring 17+ (85th percentile)
  
  let multiplierBonus = 0;
  
  if (excellentScores >= 4) {
    // 4-5 excellent scores = elite company, add +15 bonus
    multiplierBonus = 15;
  } else if (excellentScores >= 3) {
    // 3 excellent scores = very strong company, add +12 bonus
    multiplierBonus = 12;
  } else if (strongScores >= 4) {
    // 4-5 strong scores = strong company, add +8 bonus
    multiplierBonus = 8;
  } else if (strongScores >= 3) {
    // 3 strong scores = above average company, add +5 bonus
    multiplierBonus = 5;
  }
  
  // Also penalize companies with multiple weak areas
  const weakScores = scores.filter(s => s <= 5).length; // Count metrics scoring ≤5 (25th percentile)
  
  if (weakScores >= 3) {
    // 3+ weak areas = serious concerns, subtract -10
    multiplierBonus -= 10;
  } else if (weakScores >= 2) {
    // 2 weak areas = concerning, subtract -5
    multiplierBonus -= 5;
  }
  
  totalScore = Math.max(0, Math.min(100, totalScore + multiplierBonus));

  const breakdown: ScoreBreakdown = {
    growthScore: growth.score,
    profitabilityScore: profitability.score,
    valuationScore: valuation.score,
    qualityScore: quality.score,
    analystScore: analyst.score,
    description: `Context-aware analysis vs ${benchmarks.peerCount} ${industry} peers using z-score normalization${multiplierBonus !== 0 ? ` (${multiplierBonus > 0 ? '+' : ''}${multiplierBonus} compound ${multiplierBonus > 0 ? 'excellence' : 'concern'} adjustment)` : ''}`,
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

  return {
    score: Math.round(totalScore),
    breakdown,
    benchmarks,
  };
}
