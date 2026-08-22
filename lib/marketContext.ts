/**
 * Market context engine.
 *
 * The five factors describe a company in isolation and against its peers. This
 * module supplies the third leg: how the company sits against the BROADER
 * MARKET and its own risk profile. A 20% gain means something very different
 * in a year the index rose 25% than in one it fell 10%, and the previous
 * engine had no way to tell those apart.
 *
 * Everything here is derived from data the app already fetches, plus one
 * cached call for an S&P 500 proxy. No additional API keys, no new vendors.
 *
 * Sources for each measure:
 *   relative strength  Finnhub `priceRelativeToS&P500{4,13,26,52}Week`
 *   volatility         `3MonthADReturnStd` (annualised daily-return stdev)
 *   beta               `beta`
 *   drawdown           current price vs `52WeekHigh`
 *   market regime      SPY metric payload, cached 30 minutes
 *
 * NOTE ON SCOPE: this is market and risk context, not macroeconomics. True
 * macro series - CPI, fed funds, the yield curve, unemployment - are not
 * available from Finnhub's free tier. Adding FRED (free, one key) would slot
 * in here cleanly; see docs/MARKET_CONTEXT.md.
 */

import type { FinnhubBasicFinancials, FinnhubQuote } from '@/types/stock';
import { finnhub } from './finnhub';

/** Ticker used as the S&P 500 proxy for regime detection. */
const MARKET_PROXY = 'SPY';

export interface MarketRegime {
  proxy: string;
  /** Trailing 12-month index return, %. */
  return52W?: number;
  /** Trailing 3-month index return, %. */
  return13W?: number;
  /** Annualised index volatility, %. */
  volatility?: number;
  /** How far the index sits below its 52-week high, % (0 = at the high). */
  drawdownFromHigh?: number;
  /** Plain-language characterisation of the current tape. */
  label: string;
  description: string;
}

export interface RelativeStrength {
  window: '4W' | '13W' | '26W' | '52W';
  /** Excess return versus the S&P 500 in percentage points. */
  excessReturn: number;
}

export interface RiskProfile {
  beta?: number;
  /** Annualised volatility, %. */
  volatility?: number;
  /**
   * Return per unit of volatility over 12 months. Not a Sharpe ratio - there
   * is no risk-free rate subtracted - so it is labelled as what it is.
   */
  returnPerUnitRisk?: number;
  /** Current drawdown from the 52-week high, %. */
  drawdownFromHigh?: number;
  /** Position within the 52-week range, 0 = at low, 100 = at high. */
  rangePosition?: number;
  label: string;
}

/**
 * A one-standard-deviation price range twelve months out, derived from
 * realised volatility.
 *
 * This is explicitly NOT a forecast and must not be presented as one. It is
 * the range implied by how much the stock has actually been moving, which is
 * useful for sizing expectations. Analyst price targets would be the natural
 * alternative anchor, but that Finnhub endpoint is premium-only.
 */
export interface ScenarioRange {
  current: number;
  bear: number;
  base: number;
  bull: number;
  /** Volatility used, annualised %. */
  volatility: number;
  basis: string;
}

export interface MarketContext {
  regime: MarketRegime;
  relativeStrength: RelativeStrength[];
  risk: RiskProfile;
  scenarios?: ScenarioRange;
  /** Short, specific observations for display. */
  insights: string[];
}

/** Fetch and characterise the broad-market regime. Cheap and cached. */
export async function fetchMarketRegime(): Promise<MarketRegime> {
  // Both calls are cached and shared across every visitor, so the whole
  // market-context block costs the app roughly one upstream fetch per TTL
  // window regardless of traffic.
  const [metricRes, quote] = await Promise.all([
    finnhub.metric(MARKET_PROXY),
    finnhub.quote(MARKET_PROXY).catch(() => null),
  ]);

  const m = metricRes.data?.metric;

  if (!metricRes.ok || !m) {
    return {
      proxy: MARKET_PROXY,
      label: 'Unknown',
      description: 'Broad-market data was unavailable, so results are not market-adjusted.',
    };
  }

  const return52W = m['52WeekPriceReturnDaily'];
  const return13W = m['13WeekPriceReturnDaily'];
  const volatility = m['3MonthADReturnStd'];
  const high = m['52WeekHigh'];

  // Measured from the actual index level. Left undefined when the quote is
  // unavailable rather than estimated from the midpoint of the 52-week range,
  // which would be a fabricated number wearing a real one's clothes.
  const level = quote?.c;
  const drawdownFromHigh =
    level && high && high > 0 ? Math.max(0, ((high - level) / high) * 100) : undefined;

  const { label, description } = characteriseRegime(return52W, return13W, volatility);
  return { proxy: MARKET_PROXY, return52W, return13W, volatility, drawdownFromHigh, label, description };
}

function characteriseRegime(
  return52W?: number,
  return13W?: number,
  volatility?: number
): { label: string; description: string } {
  if (return52W === undefined) {
    return { label: 'Unknown', description: 'Insufficient index data to characterise the market.' };
  }

  const highVol = (volatility ?? 0) > 20;
  const recentWeak = (return13W ?? 0) < 0;

  if (return52W > 15 && !recentWeak) {
    return {
      label: highVol ? 'Strong but volatile' : 'Broadly strong',
      description: highVol
        ? `The index is up ${return52W.toFixed(1)}% over twelve months but moving sharply (${volatility?.toFixed(0)}% annualised volatility). Gains have come with real drawdown risk.`
        : `The index is up ${return52W.toFixed(1)}% over twelve months with contained volatility. A rising tide is lifting most sectors, so relative strength matters more than absolute gains.`,
    };
  }

  if (return52W > 15 && recentWeak) {
    return {
      label: 'Cooling after strength',
      description: `Up ${return52W.toFixed(1)}% over the year but ${Math.abs(return13W ?? 0).toFixed(1)}% lower over the last quarter. Momentum has turned even though the twelve-month picture still looks healthy.`,
    };
  }

  if (return52W < -5) {
    return {
      label: 'Risk-off',
      description: `The index is down ${Math.abs(return52W).toFixed(1)}% over twelve months. In this tape, holding value counts for more than posting gains, and defensive balance sheets are rewarded.`,
    };
  }

  return {
    label: 'Range-bound',
    description: `The index has moved ${return52W >= 0 ? 'up' : 'down'} ${Math.abs(return52W).toFixed(1)}% over twelve months - broadly directionless. Company-specific factors dominate in flat markets.`,
  };
}

/** Excess return versus the S&P 500 across every window Finnhub supplies. */
export function extractRelativeStrength(financials: FinnhubBasicFinancials | null): RelativeStrength[] {
  const m = financials?.metric;
  if (!m) return [];

  const windows: Array<{ window: RelativeStrength['window']; value?: number }> = [
    { window: '4W', value: m['priceRelativeToS&P5004Week'] },
    { window: '13W', value: m['priceRelativeToS&P50013Week'] },
    { window: '26W', value: m['priceRelativeToS&P50026Week'] },
    { window: '52W', value: m['priceRelativeToS&P50052Week'] },
  ];

  return windows
    .filter((w): w is { window: RelativeStrength['window']; value: number } =>
      w.value !== undefined && Number.isFinite(w.value)
    )
    .map((w) => ({ window: w.window, excessReturn: w.value }));
}

/** Volatility, beta, drawdown and return-per-unit-risk. */
export function buildRiskProfile(
  quote: FinnhubQuote,
  financials: FinnhubBasicFinancials | null
): RiskProfile {
  const m = financials?.metric;
  const beta = m?.beta;
  const volatility = m?.['3MonthADReturnStd'];
  const return52W = m?.['52WeekPriceReturnDaily'];
  const high = m?.['52WeekHigh'];
  const low = m?.['52WeekLow'];
  const price = quote?.c;

  const returnPerUnitRisk =
    return52W !== undefined && volatility && volatility > 0
      ? return52W / volatility
      : undefined;

  const drawdownFromHigh =
    price && high && high > 0 ? Math.max(0, ((high - price) / high) * 100) : undefined;

  const rangePosition =
    price && high && low && high > low
      ? Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100))
      : undefined;

  return {
    beta,
    volatility,
    returnPerUnitRisk,
    drawdownFromHigh,
    rangePosition,
    label: describeRisk(beta, volatility),
  };
}

function describeRisk(beta?: number, volatility?: number): string {
  if (beta === undefined && volatility === undefined) return 'Risk profile unavailable';

  const betaPart =
    beta === undefined
      ? ''
      : beta > 1.3
        ? `amplifies market moves (beta ${beta.toFixed(2)})`
        : beta < 0.8
          ? `dampens market moves (beta ${beta.toFixed(2)})`
          : `tracks the market closely (beta ${beta.toFixed(2)})`;

  const volPart =
    volatility === undefined
      ? ''
      : volatility > 40
        ? `very high volatility at ${volatility.toFixed(0)}%`
        : volatility > 25
          ? `elevated volatility at ${volatility.toFixed(0)}%`
          : `moderate volatility at ${volatility.toFixed(0)}%`;

  return [betaPart, volPart].filter(Boolean).join(', ');
}

/**
 * One-standard-deviation twelve-month price range from realised volatility.
 * Returns undefined when volatility is unavailable rather than inventing one.
 */
export function buildScenarios(
  quote: FinnhubQuote,
  financials: FinnhubBasicFinancials | null
): ScenarioRange | undefined {
  const price = quote?.c;
  const volatility = financials?.metric?.['3MonthADReturnStd'];
  if (!price || price <= 0 || !volatility || volatility <= 0) return undefined;

  const sigma = volatility / 100;
  return {
    current: price,
    bear: price * (1 - sigma),
    base: price,
    bull: price * (1 + sigma),
    volatility,
    basis:
      'One standard deviation over twelve months, from realised volatility. A statistical range, not a forecast or a target.',
  };
}

/**
 * Turn the raw context into specific, readable observations.
 * Each line states a number and what it implies - no filler.
 */
export function buildInsights(
  regime: MarketRegime,
  relative: RelativeStrength[],
  risk: RiskProfile,
  financials: FinnhubBasicFinancials | null
): string[] {
  const insights: string[] = [];

  const rel52 = relative.find((r) => r.window === '52W');
  const rel4 = relative.find((r) => r.window === '4W');

  if (rel52) {
    const verb = rel52.excessReturn >= 0 ? 'outpaced' : 'lagged';
    insights.push(
      `Has ${verb} the S&P 500 by ${Math.abs(rel52.excessReturn).toFixed(1)} percentage points over twelve months.`
    );
  }

  // A divergence between the long and short window is worth calling out.
  if (rel52 && rel4 && Math.sign(rel52.excessReturn) !== Math.sign(rel4.excessReturn)) {
    insights.push(
      rel4.excessReturn < 0
        ? `Leadership has faded recently: ahead over the year but ${Math.abs(rel4.excessReturn).toFixed(1)} points behind the index over the last month.`
        : `Turning up: behind over the year but ${rel4.excessReturn.toFixed(1)} points ahead of the index over the last month.`
    );
  }

  if (risk.returnPerUnitRisk !== undefined) {
    insights.push(
      risk.returnPerUnitRisk > 1
        ? `Returned ${risk.returnPerUnitRisk.toFixed(2)}% for each 1% of volatility - efficient risk-taking over the past year.`
        : risk.returnPerUnitRisk < 0
          ? `Lost ground while still carrying ${risk.volatility?.toFixed(0)}% volatility - risk without reward over the past year.`
          : `Returned ${risk.returnPerUnitRisk.toFixed(2)}% per 1% of volatility - modest compensation for the risk carried.`
    );
  }

  if (risk.drawdownFromHigh !== undefined) {
    if (risk.drawdownFromHigh < 3) {
      insights.push('Trading within 3% of its 52-week high.');
    } else if (risk.drawdownFromHigh > 25) {
      insights.push(
        `Sits ${risk.drawdownFromHigh.toFixed(0)}% below its 52-week high - a meaningful drawdown that may reflect either an opportunity or a deteriorating story.`
      );
    }
  }

  const m = financials?.metric;
  if (m?.beta !== undefined && regime.return52W !== undefined && m.beta > 1.2) {
    insights.push(
      `With a beta of ${m.beta.toFixed(2)}, this name amplifies index moves in both directions - relevant in a market the model reads as "${regime.label.toLowerCase()}".`
    );
  }

  return insights;
}

/** Assemble the full context block. One extra cached upstream call. */
export async function buildMarketContext(
  quote: FinnhubQuote,
  financials: FinnhubBasicFinancials | null
): Promise<MarketContext> {
  const regime = await fetchMarketRegime();
  const relativeStrength = extractRelativeStrength(financials);
  const risk = buildRiskProfile(quote, financials);
  const scenarios = buildScenarios(quote, financials);
  const insights = buildInsights(regime, relativeStrength, risk, financials);

  return { regime, relativeStrength, risk, scenarios, insights };
}
