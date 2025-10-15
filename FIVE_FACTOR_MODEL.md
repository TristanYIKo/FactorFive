# FactorFive: Refined 5-Factor Company Valuation Model

## Overview
FactorFive uses a sophisticated, multi-factor analysis system to evaluate stocks based on fundamental business quality rather than short-term price movements. Each factor contributes 0-20 points to a total score of 0-100.

---

## 🎯 The Five Factors

### 1. 📈 Growth (0-20 points)
**What it measures:** Revenue, EPS, and sales trends vs industry averages

**Sub-metrics:**
- **Revenue Growth** (10 points): Quarterly and annual revenue expansion
  - Formula: `(Current Revenue - Previous Revenue) / Previous Revenue * 100`
  - Comparison: Z-score vs industry peers
  - Why it matters: Indicates market share gains and business expansion
  
- **EPS Growth** (10 points): Earnings per share trajectory
  - Formula: `(Current EPS - Previous EPS) / Previous EPS * 100`
  - Comparison: Z-score vs peer EPS growth
  - Why it matters: Shows profitability improvement and shareholder value creation

**Scoring logic:**
```
Z-score > +1 std dev  → 16-20 points (excellent growth)
Z-score > 0           → 10-16 points (above average)
Z-score = 0           → 10 points (industry average)
Z-score < 0           → 3-10 points (below average)
Z-score < -1 std dev  → 0-3 points (declining)
```

**Example interpretations:**
- 18/20: "Revenue +25%, EPS +30% - significantly outpacing industry average of +8%"
- 10/20: "Revenue +8%, EPS +9% - in line with industry peers"
- 4/20: "Revenue +2%, EPS -5% - underperforming sector by 10%"

---

### 2. 💰 Profitability (0-20 points)
**What it measures:** Margins, ROE, ROA, and cash-flow efficiency

**Sub-metrics:**
- **ROE - Return on Equity** (8 points): Management efficiency
  - Formula: `Net Income / Shareholder Equity * 100`
  - Why it matters: Measures how well management uses shareholder capital
  - Good: >15% | Average: 8-15% | Poor: <8%
  
- **Net Profit Margin** (6 points): Bottom-line efficiency
  - Formula: `Net Income / Revenue * 100`
  - Why it matters: Shows pricing power and cost control
  - Tech: >20% | Retail: >5% | Airlines: >3%
  
- **Operating Margin** (6 points): Core business profitability
  - Formula: `Operating Income / Revenue * 100`
  - Why it matters: Excludes financial engineering, focuses on operations
  - Higher = stronger competitive position

**Scoring logic:**
Uses z-score transformation with industry-relative benchmarks. A tech company with 25% net margin may score 12/20 if industry average is 30%, while a retailer with 5% margin may score 15/20 if industry average is 3%.

**Example interpretations:**
- 17/20: "ROE 22% (avg 15%), Net margin 18% (avg 12%) - excellent profitability"
- 10/20: "ROE 12% (avg 11%), Net margin 8% (avg 7%) - adequate margins"
- 5/20: "ROE 4% (avg 10%), Net margin -2% (avg 5%) - profitability concerns"

---

### 3. 💎 Valuation (0-20 points)
**What it measures:** P/E, P/B, EV/EBITDA, and PEG ratios normalized by sector

**Sub-metrics:**
- **P/E Ratio** (0-12 points): Price relative to earnings
  - Formula: `Stock Price / Earnings Per Share`
  - Scoring: Lower than industry average = higher score
  - 0.6x industry avg (40% discount) = 12 points
  - 1.0x industry avg (fair value) = 8 points
  - 2.0x industry avg (100% premium) = 1.5 points
  
- **PEG Ratio Adjustment** (-4 to +5 points): Growth-adjusted valuation
  - Formula: `P/E Ratio / EPS Growth Rate`
  - PEG < 0.5 = +5 bonus (exceptional value)
  - PEG < 1.0 = +2.5 bonus (growth at discount)
  - PEG > 2.5 = -4 penalty (expensive even with growth)
  
- **P/B Ratio** (0-8 points): Price relative to book value
  - Formula: `Stock Price / Book Value Per Share`
  - Lower P/B vs industry = higher score
  - Important for asset-heavy industries (banks, real estate)

**Scoring logic:**
Valuation is **inverted** - lower multiples = higher scores. This rewards undervalued companies. The algorithm uses **relative** valuation (vs industry) rather than absolute thresholds.

**Example interpretations:**
- 18/20: "P/E 12x (industry 18x), PEG 0.8, P/B 2.1x - attractive value"
- 10/20: "P/E 22x (industry 20x), PEG 1.5, P/B 3.5x - fair valuation"
- 3/20: "P/E 65x (industry 25x), PEG 3.2, P/B 8x - premium valuation"

---

### 4. 🏆 Quality (0-20 points) **[NEW - Replaces Momentum]**
**What it measures:** Balance-sheet health, earnings stability, and free-cash-flow consistency

**Sub-metrics:**
- **Debt-to-Equity Ratio** (8 points): Financial leverage risk
  - Formula: `Total Debt / Total Equity`
  - Lower D/E = higher score (inverted z-score)
  - Why it matters: High debt increases bankruptcy risk and interest burden
  - Excellent: <0.3 | Good: 0.3-1.0 | Moderate: 1.0-2.0 | Risky: >2.0
  
- **Current Ratio** (6 points): Short-term liquidity
  - Formula: `Current Assets / Current Liabilities`
  - Higher ratio = higher score
  - Why it matters: Can the company pay its bills in the next 12 months?
  - Excellent: >2.5 | Strong: 1.5-2.5 | Adequate: 1.0-1.5 | Concern: <1.0
  
- **ROA - Return on Assets** (6 points): Asset utilization efficiency
  - Formula: `Net Income / Total Assets * 100`
  - Higher ROA = higher score
  - Why it matters: Measures how efficiently company uses its assets
  - Tech/Services: >10% | Industrials: >5% | Utilities: >2%

**Scoring logic:**
Quality uses **inverted z-score for debt** (lower is better) but normal z-scores for liquidity and ROA (higher is better). This creates a composite "financial health" score.

**Why Quality replaced Momentum:**
- **Momentum** (price trends) is speculative and short-term
- **Quality** (balance sheet) is fundamental and long-term
- Price momentum can be manipulated; balance sheets cannot
- Quality metrics predict long-term survival and dividend sustainability

**Example interpretations:**
- 17/20: "D/E 0.25x (minimal debt), Current ratio 3.2x (excellent liquidity), ROA 15%"
- 10/20: "D/E 1.2x (moderate debt), Current ratio 1.5x (adequate liquidity), ROA 7%"
- 4/20: "D/E 4.5x (high debt), Current ratio 0.8x (liquidity concerns), ROA 2%"

---

### 5. 🎯 Analyst Predictions (0-20 points)
**What it measures:** Target-price upside, consensus sentiment, and earnings revision trends

**Sub-metrics:**
- **Analyst Consensus** (0-15 points): Buy/sell recommendations
  - Formula: `(Strong Buy + Buy) / Total Ratings * 100`
  - 85%+ bullish = 14-15 points
  - 55-70% bullish = 8-11 points
  - <25% bullish = 0-2.5 points
  - Why it matters: Professional analysts have access to management and deep research
  
- **Price Target Upside** (0-5 points): Potential appreciation
  - Formula: `(Target Price - Current Price) / Current Price * 100`
  - >30% upside = 5 points
  - 10-20% upside = 3.5 points
  - 0-5% upside = 1.5 points
  - Negative = 0 points
  - Why it matters: Aggregated view of fair value across multiple analysts

**Scoring logic:**
Uses **non-linear tiered rewards** for strong consensus. A stock with 85% buy ratings scores much higher than one with 70% (14 vs 11 points), creating clear separation for high-confidence picks.

**Example interpretations:**
- 18/20: "90% bullish (27 buy, 3 hold), +35% upside to $180 target"
- 12/20: "65% bullish (13 buy, 7 hold), +12% upside to $95 target"
- 3/20: "20% bullish (4 buy, 16 sell), -8% downside to $45 target"

---

## 🧮 Compound Excellence Multiplier

After calculating the base 0-100 score, a **compound excellence bonus** is applied for companies that excel across multiple factors:

| Achievement | Bonus |
|-------------|-------|
| 4-5 metrics scoring ≥17/20 | **+15** (Elite company) |
| 3 metrics scoring ≥17/20 | **+12** (Very strong) |
| 4-5 metrics scoring ≥15/20 | **+8** (Strong) |
| 3 metrics scoring ≥15/20 | **+5** (Above average) |
| 2 metrics scoring ≤5/20 | **-5** (Multiple weaknesses) |
| 3+ metrics scoring ≤5/20 | **-10** (Serious concerns) |

**Example:**
- Company scores: [18, 17, 16, 15, 14] = 80 base
- Has 3 metrics ≥17 → +12 bonus
- **Final score: 92** (Elite tier)

This ensures truly exceptional companies (strong across all factors) are clearly separated from one-dimensional companies.

---

## 📊 Score Interpretation Guide

| Score Range | Rating | Interpretation |
|-------------|--------|----------------|
| **85-100** | 🌟 Elite | Best-in-class fundamentals. Strong buy for long-term investors. Top 5-10% of market. |
| **75-84** | ⭐ Excellent | Superior fundamentals. Buy candidate. Clear competitive advantages. Top 10-25%. |
| **65-74** | ✅ Good | Above-average quality. Worth considering. Some strengths, few weaknesses. Top 25-40%. |
| **50-64** | ➖ Average | Neutral. No clear edge. Meets benchmarks but doesn't excel. Middle 40%. |
| **35-49** | ⚠️ Below Avg | Some concerns. Trailing peers in multiple areas. Bottom 40-15%. |
| **20-34** | 🔻 Poor | Significant red flags. Weak fundamentals. Avoid unless turnaround story. Bottom 15-5%. |
| **0-19** | 🚫 Very Poor | Major issues. Multiple failing metrics. High risk. Bottom 5%. |

---

## 🔬 Methodology: Z-Score Normalization

### Why Z-Scores?
Traditional scoring uses **absolute thresholds** (e.g., "P/E < 15 is good"). This fails because:
- Tech companies naturally have higher P/E than utilities
- Small companies grow faster than large companies
- Industry dynamics vary wildly

FactorFive uses **relative z-scores** instead:

```
Z-score = (Company Metric - Industry Average) / Industry Std Deviation
```

**Example:**
- **Company A:** Tech with P/E of 30
- **Industry avg:** P/E of 35, std dev of 10
- **Z-score:** (30 - 35) / 10 = -0.5 (slightly below average)
- **Score:** ~12/20 (decent value for tech)

vs.

- **Company B:** Utility with P/E of 18
- **Industry avg:** P/E of 15, std dev of 3
- **Z-score:** (18 - 15) / 3 = +1.0 (expensive for utility)
- **Score:** ~7/20 (overvalued)

Even though Company A's absolute P/E (30) is higher than B's (18), Company A scores **higher** because it's cheaper **relative to tech peers**.

### Non-Linear Transformation
Z-scores are converted to points using a **sigmoid curve** (not linear):

```javascript
steepness = 2.5
sigmoid = 1 / (1 + e^(-steepness * z))
points = sigmoid * maxPoints

// With power amplification:
if (z > 0) points *= (1 + z * 0.15)  // Boost above-average
if (z < 0) points *= (1 - |z| * 0.15) // Penalize below-average
```

This creates **aggressive separation**:
- +1 std dev → 17.2/20 points (not 15/20)
- 0 std dev → 10/20 points (neutral)
- -1 std dev → 2.8/20 points (not 5/20)

**Result:** Top performers score much higher, poor performers score much lower.

---

## 🎨 UI Design Elements

### Card Color Coding
Each factor has a distinct color theme for instant recognition:

| Factor | Color | Hex | Rationale |
|--------|-------|-----|-----------|
| Growth | Blue | `#3B82F6` | Growth = sky = upward trajectory |
| Profitability | Green | `#10B981` | Profit = money = green |
| Valuation | Purple | `#8B5CF6` | Value = premium = royal purple |
| Quality | Cyan | `#06B6D4` | Quality = clarity = cyan/teal |
| Analyst | Indigo | `#6366F1` | Analysts = wisdom = deep blue |

### Tooltips
Each card has a **hover tooltip** explaining the methodology:

- **Growth:** "Evaluates revenue growth, EPS expansion, and sales trends compared to industry averages..."
- **Profitability:** "Measures operating and net margins, ROE (return on equity), and ROA. ROE reflects management efficiency..."
- **Valuation:** "Compares P/E, P/B, and PEG ratios normalized by sector. Lower ratios indicate better value..."
- **Quality:** "Evaluates balance-sheet health through debt/equity ratios, current ratio (liquidity), and ROA..."
- **Analyst:** "Aggregates professional analyst ratings, price target upside potential, and earnings revision trends..."

### Percentile Rankings
Each card shows the **industry percentile**:
- 90%ile = Better than 90% of peers
- 50%ile = Median company
- 10%ile = Bottom 10% of industry

This provides instant context for relative performance.

---

## 🔄 Migration from Momentum to Quality

### Why the Change?
The original FactorFive used **Momentum** (daily price change, 52-week position) as the 4th factor. This was replaced with **Quality** for several reasons:

1. **Fundamental vs Technical:** Momentum is a technical indicator; Quality is fundamental
2. **Long-term vs Short-term:** Quality predicts 5-year performance; momentum predicts days/weeks
3. **Manipulation:** Prices can be manipulated; balance sheets are audited
4. **Investment Philosophy:** FactorFive focuses on "buy and hold" value investing, not trading

### What Changed?
**Removed:**
- Daily price change % (momentum1M)
- 52-week high/low positioning
- Orange color theme

**Added:**
- Debt-to-equity ratio (financial leverage)
- Current ratio (liquidity)
- Return on assets (efficiency)
- Cyan/teal color theme

### Code Changes
```typescript
// OLD: calculateMomentumScore()
const dailyChange = quote.dp;
const position52Week = ((currentPrice - low52) / (high52 - low52)) * 100;
→ Scores 0-20 based on price trends

// NEW: calculateQualityScore()
const debtToEquity = metric.debtEquityAnnual ?? 999;
const currentRatio = metric.currentRatioAnnual ?? 1.0;
const roa = metric.roaRfy ?? 0;
→ Scores 0-20 based on balance-sheet health
```

---

## 📈 Expected Score Distribution

Based on aggressive non-linear scoring:

| Percentile | Score Range | % of Stocks | Example Companies |
|------------|-------------|-------------|-------------------|
| Top 5% | 85-100 | 5-10% | AAPL, MSFT, GOOGL at peak |
| Top 25% | 75-84 | 10-15% | NVDA, V, COST |
| Top 40% | 65-74 | 15-20% | JPM, UNH, MA |
| Middle 40% | 50-64 | 30-40% | F, T, KO |
| Bottom 40% | 35-49 | 15-20% | Cyclicals in downturns |
| Bottom 15% | 20-34 | 10-15% | Distressed companies |
| Bottom 5% | 0-19 | 5-10% | Bankruptcy risks |

---

## 🚀 Future Enhancements

Potential additions to the model:

1. **Free Cash Flow Score** (as 6th factor or part of Quality)
   - `(Operating Cash Flow - CapEx) / Revenue`
   
2. **Dividend Sustainability** (for income investors)
   - Payout ratio + dividend growth history
   
3. **Economic Moat Score** (competitive advantages)
   - Brand strength, network effects, switching costs
   
4. **ESG Score** (Environmental, Social, Governance)
   - Carbon footprint, board diversity, ethics
   
5. **Insider Buying** (confidence signal)
   - Net insider purchases / total shares

These would create a **FactorSix** or **FactorSeven** model for more comprehensive analysis.

---

## 📚 Resources & References

- **Z-Score Normalization:** Statistical method used in finance since 1960s
- **Sigmoid Function:** Commonly used in machine learning for classification
- **PEG Ratio:** Developed by Peter Lynch, legendary Fidelity manager
- **ROE Analysis:** Warren Buffett's preferred profitability metric
- **Quality Metrics:** Based on Benjamin Graham's "The Intelligent Investor"

---

## 🎯 Summary

FactorFive's refined 5-factor model provides a **comprehensive, quantitative framework** for evaluating stocks based on:
1. **Growth potential** (revenue & earnings expansion)
2. **Profitability** (margins & efficiency)
3. **Valuation** (price relative to fundamentals)
4. **Quality** (financial health & stability)
5. **Analyst sentiment** (professional consensus)

By using **z-score normalization**, **non-linear scoring**, and **compound excellence bonuses**, the model creates clear separation between investment-grade companies and mediocre performers.

The shift from Momentum to Quality reflects a focus on **long-term fundamental investing** rather than short-term technical trading.
