# Intelligent Stock Scoring Engine - Technical Documentation

## Overview

The Stock Score system has been completely redesigned to use **context-aware, relative analysis** instead of absolute thresholds. Scores are now calculated using statistical methods (z-scores and percentile rankings) that compare each stock to its industry peers, ensuring fair comparisons across different sectors and market conditions.

---

## Key Principles

### 1. **Relative vs Absolute Scoring**
- **Old System**: Used fixed thresholds (e.g., "P/E < 15 = good")
- **New System**: Compares metrics to industry averages and peer distributions

**Why this matters**: A P/E of 40 might be overvalued for a bank but perfectly reasonable for a high-growth SaaS company. Context matters.

### 2. **Z-Score Normalization**
Every metric is converted to a z-score that shows how many standard deviations it is from the industry mean:
- **Z-score = 0**: Average (50th percentile)
- **Z-score = +1**: One std dev above average (~84th percentile)
- **Z-score = +2**: Two std devs above average (~98th percentile)
- **Z-score = -1**: One std dev below average (~16th percentile)

This approach automatically adjusts for industry norms and volatility.

### 3. **Percentile Rankings**
Each component score includes a percentile ranking (0-100) showing where the stock stands relative to peers:
- **80th percentile** = Better than 80% of peers
- **50th percentile** = Median performance
- **20th percentile** = Below 80% of peers

---

## Scoring Components (20 points each = 100 total)

### 📈 Growth Score (0-20 points)

**What it measures**:
- Revenue growth rate (quarterly YoY or annual)
- EPS (Earnings Per Share) growth rate
- Compared to industry median and distribution

**How it's calculated**:
1. Fetch peer company growth rates from Finnhub
2. Calculate industry average and standard deviation
3. Compute z-scores for the company's growth rates
4. Convert z-scores to points (10 pts revenue + 10 pts EPS)

**Scoring logic**:
```
Z-score of +2 = 20 points (top performer)
Z-score of  0 = 10 points (average)
Z-score of -2 = 0 points (bottom performer)
```

**Example tooltip**:
> "78th percentile vs 10 peers. Strong growth relative to Software sector"

**Why relative scoring matters**:
- A 5% growth rate is excellent for a utility company but poor for a tech startup
- Industry context prevents unfair comparisons

---

### 💰 Profitability Score (0-20 points)

**What it measures**:
- Return on Equity (ROE)
- Net Profit Margin
- Operating Margin
- All relative to industry benchmarks

**Weighting**:
- ROE: 8 points (most important - shows capital efficiency)
- Net Margin: 6 points
- Operating Margin: 6 points

**Example**:
A retail company with 5% net margin might score high if peers average 2%, while a software company with 15% margin might score low if peers average 25%.

---

### 💎 Valuation Score (0-20 points)

**Revolutionary approach**: Does NOT blindly penalize high P/E ratios!

**What it measures**:
- P/E ratio relative to industry average
- P/B (Price-to-Book) ratio relative to industry
- **INVERTED scoring**: Lower valuation = higher score

**Key insight**:
```
Tech company: P/E of 35 vs industry avg 40 = Good value (high score)
Industrial:  P/E of 35 vs industry avg 12 = Overvalued (low score)
```

**Scoring logic**:
1. Calculate z-score for P/E vs peers
2. **Invert it** (negative z-score becomes positive)
3. Convert to points

**Example**: 
- Company P/E: 25
- Industry avg: 30
- Z-score: -0.5 (below average)
- **Inverted**: +0.5 (good value!)
- Score: ~12/20

---

### 🚀 Momentum Score (0-20 points)

**What it measures**:
- Daily price change relative to sector
- 52-week price position (how close to high vs low)
- Price vs analyst target (upside potential)

**Weighting**:
- Daily momentum (z-scored vs peers): 10 points
- 52-week position: 10 points

**Example**:
```
Daily change: +2.5% (sector avg: +0.5%)
Z-score: +1.5 → 8 points

52-week position: 85% → 8.5 points

Total: 16.5/20 = Strong momentum
```

---

### 👔 Analyst Score (0-20 points)

**What it measures**:
- Buy/Hold/Sell recommendation distribution
- Price target upside vs current price
- Analyst confidence and consensus

**Weighting**:
- Recommendation consensus: 15 points
- Price target upside: 5 points

**Example**:
```
Recommendations: 15 buy, 5 hold, 0 sell (75% bullish)
Points: (75/100) * 15 = 11.25

Target upside: 18% above current
Points: 4

Total: 15.25/20 = Strong analyst support
```

---

## Technical Implementation

### Data Flow

```
1. User requests ticker (e.g., AAPL)
   ↓
2. API fetches company data from Finnhub
   ↓
3. API fetches peer list (up to 10 similar companies)
   ↓
4. API fetches metrics for all peers in parallel
   ↓
5. Scoring engine calculates industry benchmarks
   ↓
6. Scoring engine computes z-scores for each metric
   ↓
7. Scoring engine converts z-scores to 0-20 point scores
   ↓
8. Scoring engine calculates percentile rankings
   ↓
9. API returns complete score breakdown with context
   ↓
10. Frontend displays scores with tooltips and explanations
```

### Finn hub Endpoints Used

**For target company**:
- `/quote` - Price data
- `/stock/profile2` - Company info & industry classification
- `/stock/metric` - Financial metrics (growth, profitability, valuation)
- `/stock/recommendation` - Analyst ratings
- `/stock/price-target` - Analyst targets
- `/company-news` - Recent news
- `/calendar/earnings` - Upcoming earnings

**For peer analysis**:
- `/stock/peers` - Get list of similar companies
- `/quote` (per peer) - Price data for momentum
- `/stock/metric` (per peer) - Financial metrics

### Performance Optimization

**Parallel fetching**: All peer data fetched simultaneously using `Promise.all()`

**Peer limiting**: Max 10 peers to balance accuracy with API call limits

**Error handling**: Graceful degradation if peer data unavailable (defaults to neutral scores)

---

## Frontend Display

### Score Cards
Each of the 5 components displays:
- **Score** (e.g., "16/20")
- **Percentile badge** (e.g., "82%ile")
- **Hover tooltip** with contextual explanation
- **Color coding**: Blue=Growth, Green=Profit, Purple=Value, Orange=Momentum, Indigo=Analyst

### Industry Context Banner
Shows:
- Number of peers compared
- Industry/sector name
- Methodology note ("z-score normalization")

### Detailed Metrics (Expandable)
Click to reveal exact values:
- Growth: "Revenue: 25.3% (industry avg 12.1%), EPS: 18.7% (avg 9.3%)"
- Profitability: "ROE: 22.1% (avg 15.2%), Net margin: 18.5% (avg 12.3%)"
- Valuation: "P/E: 28.5x (15% below industry 33.5x), P/B: 5.2x (avg 6.1x)"
- Momentum: "Daily: +1.8% (sector avg +0.3%), 52W position: 78%"
- Analyst: "78% bullish consensus, 16.5% upside to target"

---

## Score Interpretation

| Total Score | Rating | Interpretation |
|-------------|--------|----------------|
| 80-100 | 🟢 Strong Buy | Exceptional fundamentals across all metrics |
| 70-79 | 🟢 Buy | Strong performance in most areas |
| 55-69 | 🟡 Moderate Buy | Above average with some strong points |
| 40-54 | 🟡 Hold | Mixed signals, average overall |
| 25-39 | 🔴 Sell | Below average performance |
| 0-24 | 🔴 Strong Sell | Weak fundamentals, significant concerns |

**Important**: Scores reflect **relative performance** within an industry, not absolute quality. A 60 score in high-quality tech sector may represent a better investment than an 75 score in a struggling industry.

---

## Advantages Over Traditional Scoring

| Aspect | Traditional Approach | Intelligent System |
|--------|---------------------|-------------------|
| **Valuation** | "P/E > 30 = overvalued" | "P/E vs industry context" |
| **Growth** | "15% growth = good" | "Relative to peers & consistency" |
| **Fairness** | Same thresholds for all industries | Industry-specific benchmarks |
| **Market Cycles** | Fixed rules get outdated | Self-adjusting to conditions |
| **Differentiation** | Most stocks cluster around 50 | Full 0-100 range utilized |
| **Actionability** | Surface-level | Deep contextual insights |

---

## Example Comparisons

### Example 1: High-Growth Tech Stock (NVDA)
```
Revenue Growth: 80% YoY (industry avg: 15%)
→ Z-score: +3.5 → 20/20 points (top decile)

ROE: 48% (industry avg: 22%)
→ Z-score: +2.8 → 18/20 points

P/E: 65 (industry avg: 50)
→ Z-score: +1.2 → INVERTED → 8/20 points (expensive)

Momentum: +5% today (sector: +1%)
→ Z-score: +2.0 → 17/20 points

Analyst: 90% buy ratings
→ 18/20 points

Total: 81/100 - Strong Buy
```

### Example 2: Mature Value Stock (JPM)
```
Revenue Growth: 3% (industry avg: 4%)
→ Z-score: -0.5 → 8/20 points

ROE: 15% (industry avg: 12%)
→ Z-score: +1.0 → 15/20 points

P/E: 9 (industry avg: 12)
→ Z-score: -1.2 → INVERTED → +1.2 → 15/20 points (good value)

Momentum: -0.5% (sector: -0.3%)
→ Z-score: -0.3 → 9/20 points

Analyst: 60% buy ratings
→ 12/20 points

Total: 59/100 - Moderate Buy
```

### Example 3: Struggling Company
```
Revenue Growth: -5% (industry avg: 8%)
→ Z-score: -2.0 → 2/20 points

ROE: 2% (industry avg: 12%)
→ Z-score: -2.5 → 0/20 points

P/E: 45 (industry avg: 18)
→ Z-score: +2.5 → INVERTED → -2.5 → 0/20 points (very expensive)

Momentum: -3% (sector: +0.5%)
→ Z-score: -1.8 → 3/20 points

Analyst: 20% buy, 80% sell
→ 4/20 points

Total: 9/100 - Strong Sell
```

---

## Future Enhancements

### Phase 2 Improvements
1. **Historical Context**: Compare current metrics to company's own 3-5 year averages
2. **Trend Analysis**: Score improving/declining trends, not just snapshots
3. **Volatility Adjustment**: Penalize erratic performance vs steady growth
4. **Earnings Quality**: Factor in cash flow vs accounting earnings
5. **Industry Sub-Sectors**: More granular peer groups (e.g., "Cloud SaaS" vs "Enterprise Software")

### Phase 3 Data Sources
1. **NewsAPI**: Sentiment analysis from news headlines
2. **Reddit/Twitter APIs**: Retail investor sentiment
3. **SEC Filings**: Insider trading activity
4. **Options Data**: Institutional positioning and volatility expectations

### Phase 4 Advanced Features
1. **Machine Learning**: Train models on historical score→performance relationships
2. **Backtesting**: Show how scores predicted returns over past 1/3/5 years
3. **Portfolio Mode**: Score basket of stocks, suggest rebalancing
4. **Alerts**: Notify when scores change significantly

---

## Code Structure

### `/lib/scoring.ts`
Main scoring engine with modular functions:
- `calculateGrowthScore()`
- `calculateProfitabilityScore()`
- `calculateValuationScore()`
- `calculateMomentumScore()`
- `calculateAnalystScore()`
- `calculateZScore()` - Statistical helper
- `calculatePercentile()` - Ranking helper
- `zScoreToPoints()` - Conversion helper

### `/app/api/stock/route.ts`
API endpoint that:
1. Fetches target company data
2. Fetches peer company data (`fetchPeerMetrics`)
3. Calls scoring engine
4. Returns combined data with scores

### `/types/stock.ts`
TypeScript interfaces for type safety:
- `PeerMetrics` - Individual peer data
- `IndustryBenchmarks` - Aggregated statistics
- `ScoreBreakdown` - Complete score with context
- `StockData` - Full API response

### `/app/ticker/[symbol]/page.tsx`
Frontend that renders:
- Score cards with hover tooltips
- Percentile badges
- Industry context
- Expandable detailed metrics

---

## Conclusion

This intelligent scoring system represents a paradigm shift from arbitrary thresholds to data-driven, context-aware analysis. By using statistical methods and peer comparisons, it provides:

✅ **Fair comparisons** across industries  
✅ **Adaptive scoring** that adjusts to market conditions  
✅ **Transparent methodology** with clear explanations  
✅ **Actionable insights** backed by relative performance  

The system recognizes that "good" and "bad" are relative concepts that depend on industry norms, economic cycles, and competitive dynamics.
