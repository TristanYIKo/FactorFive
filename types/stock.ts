// Type definitions for Finnhub API responses and Stock Score data

// Type-only import; erased at compile time, so the cycle with lib/marketContext
// (which imports the Finnhub types from here) costs nothing at runtime.
import type { MarketContext } from '@/lib/marketContext';

// Finnhub Quote endpoint response
export interface FinnhubQuote {
  c: number; // Current price
  d: number; // Change
  dp: number; // Percent change
  h: number; // High price of the day
  l: number; // Low price of the day
  o: number; // Open price of the day
  pc: number; // Previous close price
  t: number; // Timestamp
}

// Finnhub Company Profile endpoint response
export interface FinnhubProfile {
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
  logo: string;
  finnhubIndustry: string;
}

// Finnhub News Article
export interface FinnhubNewsArticle {
  category: string;
  datetime: number; // Unix timestamp
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

// Finnhub Earnings Calendar response
export interface FinnhubEarnings {
  earningsCalendar: EarningsEvent[];
}

export interface EarningsEvent {
  date: string; // YYYY-MM-DD
  epsActual?: number | null;
  epsEstimate?: number | null;
  hour: string; // "bmo" (before market open), "amc" (after market close), etc.
  quarter: number;
  revenueActual?: number | null;
  revenueEstimate?: number | null;
  symbol: string;
  year: number;
}

// Peer comparison data for relative analysis
export interface PeerMetrics {
  symbol: string;
  /** Market cap in millions USD, used to keep comparisons size-appropriate. */
  marketCap?: number;
  revenueGrowth?: number;
  epsGrowth?: number;
  roe?: number;
  roa?: number;
  netMargin?: number;
  operatingMargin?: number;
  pe?: number;
  pb?: number;
  debtEquity?: number;
  currentRatio?: number;
  momentum1M?: number;
  momentum3M?: number;
}

// Industry benchmark statistics
/** Median, interquartile range and dispersion for one peer metric. */
export interface MetricDistribution {
  median: number;
  p25: number;
  p75: number;
  mad: number;
  count: number;
}

/**
 * Industry benchmarks built from peer fundamentals.
 *
 * These are MEDIANS, not means. Finnhub's peer lists include unvetted
 * micro-caps whose percentage metrics swing by hundreds of percent, and an
 * arithmetic mean over that produced benchmarks like "average Technology
 * revenue growth: 149%". Medians with winsorized tails survive it.
 *
 * `reliable` is false when too few peers resolved to compute anything
 * meaningful; consumers must not present benchmarks as authoritative when it
 * is false.
 */
export interface IndustryBenchmarks {
  industry: string;
  peerCount: number;
  reliable: boolean;
  distributions: {
    revenueGrowth: MetricDistribution | null;
    epsGrowth: MetricDistribution | null;
    roe: MetricDistribution | null;
    netMargin: MetricDistribution | null;
    operatingMargin: MetricDistribution | null;
    pe: MetricDistribution | null;
    pb: MetricDistribution | null;
    debtEquity: MetricDistribution | null;
    momentum3M: MetricDistribution | null;
  };
}

// Enhanced score breakdown with relative context
export interface ScoreBreakdown {
  growthScore: number; // 0-20
  profitabilityScore: number; // 0-20
  valuationScore: number; // 0-20
  qualityScore: number; // 0-20 (replaces momentum)
  analystScore: number; // 0-20
  description: string;
  details: {
    growth: string;
    profitability: string;
    valuation: string;
    quality: string; // replaces momentum
    analyst: string;
  };
  // Contextual explanations for each score
  tooltips: {
    growth: string;
    profitability: string;
    valuation: string;
    quality: string; // replaces momentum
    analyst: string;
  };
  /**
   * Confidence in the headline score, driven by how much real data backed it.
   * 'low' means the number is indicative only - typically too few peers
   * resolved, or fundamentals were missing.
   */
  confidence: 'high' | 'medium' | 'low';
  /** Plain-language note on anything the score could not account for. */
  caveats: string[];
  // Peer comparison context
  peerContext: {
    industry: string;
    peerCount: number;
    /** null where there was not enough peer data to rank against. */
    percentileRanks: {
      growth: number | null; // 0-100
      profitability: number | null;
      valuation: number | null;
      quality: number | null;
      analyst: number | null;
    };
  };
}

// Combined Stock Data returned by our API
export interface StockData {
  symbol: string;
  profile: FinnhubProfile;
  quote: FinnhubQuote;
  news: FinnhubNewsArticle[];
  newsAPIArticles?: NewsAPIArticle[]; // Top 20 from NewsAPI
  sentiment?: SentimentAnalysis; // News sentiment analysis
  earnings: EarningsEvent | null; // Next upcoming earnings
  financials: FinnhubBasicFinancials | null;
  recommendations: FinnhubRecommendationTrend[];
  priceTarget: FinnhubPriceTarget | null;
  stockScore: number; // 0-100
  scoreBreakdown: ScoreBreakdown;
  industryBenchmarks?: IndustryBenchmarks;
  dataQuality?: DataQuality;
  marketContext?: MarketContext;
  /** Most recent reported quarters, newest first. */
  earningsHistory?: EarningsSurprise[];
}

/**
 * What the score was actually computed from.
 *
 * Exists because the app used to fail silently: when peer fetches were rate
 * limited the engine still emitted a confident number built on an empty peer
 * set. The UI now has enough information to say so.
 */
export interface DataQuality {
  peersResolved: number;
  peersRequested: number;
  /** False when too few peers resolved for the benchmark to mean anything. */
  benchmarksReliable: boolean;
  /** How size-comparable the peer cohort is, e.g. "closely size-matched". */
  peerCohort?: string;
  degradedReason?: string;
  newsAvailable: boolean;
  financialsAvailable: boolean;
  generatedAt: string;
  elapsedMs: number;
}

/**
 * One reported quarter from /stock/earnings, which carries the actual figure
 * alongside the estimate and the surprise. Verified available on the free tier.
 */
export interface EarningsSurprise {
  symbol: string;
  period: string; // YYYY-MM-DD, quarter end
  year: number;
  quarter: number;
  estimate: number | null;
  actual: number | null;
  surprise: number | null;
  surprisePercent: number | null;
}

// Finnhub Basic Financials (annual and quarterly metrics)
export interface FinnhubBasicFinancials {
  metric: {
    // Valuation metrics
    peNormalizedAnnual?: number; // P/E ratio
    pbAnnual?: number; // Price to Book
    psAnnual?: number; // Price to Sales
    pegAnnual?: number; // PEG ratio
    
    // Profitability metrics
    roaRfy?: number; // Return on Assets (%)
    roeRfy?: number; // Return on Equity (%)
    netProfitMarginAnnual?: number; // Net Profit Margin (%)
    operatingMarginAnnual?: number; // Operating Margin (%)
    
    // Growth metrics
    revenueGrowthAnnual?: number; // Revenue growth (%)
    epsGrowthAnnual?: number; // EPS growth (%)
    revenueGrowthQuarterlyYoy?: number; // Quarterly YoY revenue growth (%)
    epsGrowthQuarterlyYoy?: number; // Quarterly YoY EPS growth (%)
    
    // Financial health
    currentRatioAnnual?: number; // Current ratio
    debtEquityAnnual?: number; // Debt to Equity
    quickRatioAnnual?: number; // Quick ratio
    
    // Momentum - real price returns supplied by Finnhub's metric endpoint.
    // The scoring engine previously used quote.dp (today's percent change) as a
    // stand-in for both 1M and 3M momentum; these are the actual series.
    '5DayPriceReturnDaily'?: number;
    '13WeekPriceReturnDaily'?: number; // ~3 month
    '26WeekPriceReturnDaily'?: number; // ~6 month
    '52WeekPriceReturnDaily'?: number; // ~12 month
    monthToDatePriceReturnDaily?: number;
    yearToDatePriceReturnDaily?: number;
    '52WeekHigh'?: number;
    '52WeekLow'?: number;
    '52WeekHighDate'?: string;
    '52WeekLowDate'?: string;

    // Market-relative strength: excess return versus the S&P 500 over each
    // window, in percentage points. Positive means the stock beat the index.
    'priceRelativeToS&P5004Week'?: number;
    'priceRelativeToS&P50013Week'?: number;
    'priceRelativeToS&P50026Week'?: number;
    'priceRelativeToS&P50052Week'?: number;

    // Risk
    beta?: number;
    '3MonthADReturnStd'?: number; // annualised daily-return volatility, %

    // Size. Used to keep peer comparisons within a sane market-cap cohort,
    // which is why it is read from the metric payload rather than costing a
    // separate profile call per peer.
    marketCapitalization?: number; // millions USD
    enterpriseValue?: number;
  };
  series?: {
    annual?: Record<string, any>;
    quarterly?: Record<string, any>;
  };
}

// Finnhub Recommendation Trends (analyst ratings)
export interface FinnhubRecommendationTrend {
  buy: number;
  hold: number;
  period: string; // Date YYYY-MM-DD
  sell: number;
  strongBuy: number;
  strongSell: number;
  symbol: string;
}

// Finnhub Price Target (analyst consensus)
export interface FinnhubPriceTarget {
  lastUpdated: string;
  symbol: string;
  targetHigh: number;
  targetLow: number;
  targetMean: number;
  targetMedian: number;
}

// NewsAPI Article
export interface NewsAPIArticle {
  title: string;
  description: string | null;
  url: string;
  publishedAt: string; // ISO date string
  source: {
    id: string | null;
    name: string;
  };
  urlToImage?: string | null;
  content?: string | null;
}

// Sentiment analysis result
export interface SentimentAnalysis {
  newsScore: number; // 0-20 points
  averageSentiment: number; // -1 to +1
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  totalArticles: number;
}

// API Error response
export interface ApiError {
  error: string;
  details?: string;
}

/**
 * Market and risk context, computed in lib/marketContext.ts.
 * Re-exported here so views import a single types module.
 */
export type {
  MarketContext,
  MarketRegime,
  RelativeStrength,
  RiskProfile,
  ScenarioRange,
} from '@/lib/marketContext';
