// Type definitions for Finnhub API responses and Stock Score data

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
export interface IndustryBenchmarks {
  industry: string;
  peerCount: number;
  avgRevenueGrowth: number;
  avgEpsGrowth: number;
  avgRoe: number;
  avgNetMargin: number;
  avgOperatingMargin: number;
  avgPe: number;
  avgPb: number;
  avgMomentum1M: number;
  avgMomentum3M: number;
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
  // Peer comparison context
  peerContext: {
    industry: string;
    peerCount: number;
    percentileRanks: {
      growth: number; // 0-100
      profitability: number;
      valuation: number;
      quality: number; // replaces momentum
      analyst: number;
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
    
    // Momentum
    '52WeekHigh'?: number;
    '52WeekLow'?: number;
    beta?: number;
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
