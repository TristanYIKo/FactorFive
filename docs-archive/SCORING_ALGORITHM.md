# Stock Score Algorithm - Enhanced Version

## Overview
The Stock Score has been completely redesigned to provide meaningful analysis based on fundamental metrics rather than just daily price changes and news volume.

## New Algorithm (0-100 Points)

### 1. Growth Score (20 points) ⬆️
**Higher growth = Higher score**

#### Revenue Growth (10 points)
- Excellent (>20%): 10 pts
- Good (10-20%): 7 pts
- Moderate (5-10%): 5 pts
- Low (0-5%): 3 pts
- Negative (<0%): 0 pts

#### EPS Growth (10 points)
- Excellent (>25%): 10 pts
- Good (15-25%): 7 pts
- Moderate (5-15%): 5 pts
- Low (0-5%): 3 pts
- Negative (<0%): 0 pts

**Why it matters**: Companies with strong revenue and earnings growth typically outperform the market. Consistent growth indicates a competitive advantage and market demand.

---

### 2. Profitability Score (20 points) 💰
**Higher profitability = Higher score**

#### Return on Equity - ROE (8 points)
- Excellent (>20%): 8 pts
- Good (15-20%): 6 pts
- Average (10-15%): 4 pts
- Below Average (5-10%): 2 pts
- Poor (<5%): 0 pts

#### Net Profit Margin (6 points)
- Excellent (>20%): 6 pts
- Good (10-20%): 4 pts
- Average (5-10%): 2 pts
- Poor (<5%): 0 pts

#### Operating Margin (6 points)
- Excellent (>25%): 6 pts
- Good (15-25%): 4 pts
- Average (5-15%): 2 pts
- Poor (<5%): 0 pts

**Why it matters**: Profitable companies have better financial stability, can reinvest in growth, and provide returns to shareholders. High margins indicate pricing power and operational efficiency.

---

### 3. Valuation Score (20 points) 💎
**Lower valuation = Better value = Higher score**

#### P/E Ratio (8 points)
- Excellent (<15): 8 pts
- Good (15-20): 6 pts
- Fair (20-30): 4 pts
- High (30-50): 2 pts
- Very High (>50): 0 pts

#### P/B Ratio (6 points)
- Excellent (<2): 6 pts
- Good (2-3): 4 pts
- Fair (3-5): 2 pts
- High (>5): 0 pts

#### PEG Ratio (6 points)
- Excellent (<1): 6 pts - *Growth at a reasonable price*
- Good (1-1.5): 4 pts
- Fair (1.5-2): 2 pts
- Expensive (>2): 0 pts

**Why it matters**: Valuation metrics help identify whether a stock is overpriced or underpriced relative to its fundamentals. Lower valuations often mean better long-term returns.

---

### 4. Momentum Score (20 points) 🚀
**Positive momentum = Higher score**

#### Daily Performance (7 points)
- Strong Up (>3%): 7 pts
- Up (1-3%): 5 pts
- Slightly Up (0-1%): 3 pts
- Slightly Down (-1-0%): 1 pt
- Down (<-1%): 0 pts

#### 52-Week Position (7 points)
- Near High (>80%): 7 pts
- Strong (60-80%): 5 pts
- Mid-range (40-60%): 3 pts
- Weak (20-40%): 1 pt
- Near Low (<20%): 0 pts

#### Price vs Target (6 points)
- High Upside (>20%): 6 pts
- Good Upside (10-20%): 4 pts
- Some Upside (0-10%): 2 pts
- At/Above Target (≤0%): 0 pts

**Why it matters**: Momentum indicators help identify stocks with positive price trends and strong investor sentiment. Stocks near 52-week highs often continue upward.

---

### 5. Analyst Score (20 points) 👔
**Positive analyst sentiment = Higher score**

#### Bullish Consensus (15 points)
- Very Bullish (>70% buy ratings): 15 pts
- Bullish (50-70%): 10 pts
- Moderate (30-50%): 5 pts
- Bearish (<30%): 0 pts

#### Low Bearish Sentiment (5 points)
- Very Low (<10% sell ratings): 5 pts
- Low (10-20%): 3 pts
- Moderate/High (>20%): 0 pts

**Why it matters**: Analyst recommendations aggregate professional research and can influence institutional buying. Strong consensus often precedes price appreciation.

---

## Score Interpretation

| Score Range | Rating | Interpretation |
|-------------|--------|----------------|
| 70-100 | 🟢 Strong Buy | Excellent fundamentals across multiple metrics |
| 55-69 | 🟢 Buy | Good fundamentals with some strong areas |
| 40-54 | 🟡 Hold | Mixed signals, average performance |
| 25-39 | 🔴 Sell | Weak fundamentals in multiple areas |
| 0-24 | 🔴 Strong Sell | Poor fundamentals, significant concerns |

---

## Data Sources (Finnhub API)

### New Endpoints Added:
1. **`/stock/metric`** - Comprehensive financial metrics
   - Growth rates (revenue, EPS)
   - Profitability metrics (ROE, margins)
   - Valuation ratios (P/E, P/B, PEG)
   - 52-week high/low, beta

2. **`/stock/recommendation`** - Analyst ratings
   - Strong Buy, Buy, Hold, Sell, Strong Sell counts
   - Historical trends

3. **`/stock/price-target`** - Analyst price targets
   - Mean, median, high, low targets
   - Upside/downside potential

### Existing Endpoints:
- `/quote` - Real-time price
- `/stock/profile2` - Company info
- `/company-news` - Recent news
- `/calendar/earnings` - Earnings dates

---

## Frontend Improvements

### Enhanced Score Display
- **Visual breakdown** of 5 components with individual scores
- **Color-coded cards** for each metric category
- **Expandable details** showing exact values
- **Progress bars** for analyst recommendations
- **Price target comparison** with upside calculation

### New Sections
1. **Analyst Consensus Panel**
   - Visual representation of buy/sell ratings
   - Price target range with upside potential
   
2. **Enhanced Score Card**
   - 5 separate metric scores (Growth, Profit, Value, Momentum, Analyst)
   - Detailed metric values on expand
   - Clear rating labels (Strong Buy, Buy, Hold, Sell, Strong Sell)

---

## Example Comparisons

### Growth Stock (e.g., NVDA)
- High Growth Score (18/20) - Strong revenue/EPS growth
- High Profitability (16/20) - Excellent margins
- Lower Valuation (8/20) - High P/E due to growth premium
- Strong Momentum (17/20) - Near 52W high
- Strong Analyst (18/20) - Consensus buy
- **Total: ~77/100 - Strong Buy**

### Value Stock (e.g., JPM)
- Moderate Growth (10/20) - Steady but slower growth
- High Profitability (17/20) - Consistent margins
- High Valuation (16/20) - Low P/E, good value
- Moderate Momentum (12/20) - Stable but not surging
- Good Analyst (14/20) - Mostly positive
- **Total: ~69/100 - Buy**

### Struggling Stock
- Low Growth (3/20) - Declining revenue
- Low Profitability (5/20) - Shrinking margins
- Moderate Valuation (10/20) - Cheap for a reason
- Low Momentum (4/20) - Near 52W low
- Weak Analyst (2/20) - Mostly sell ratings
- **Total: ~24/100 - Strong Sell**

---

## Future Enhancements

### Planned Features:
1. **Sentiment Analysis** - NLP on news headlines
2. **Technical Indicators** - RSI, MACD, moving averages
3. **Industry Comparison** - Relative scoring vs sector peers
4. **Social Media Sentiment** - Reddit/Twitter analysis
5. **Earnings History** - Beat rate and surprise trends
6. **Insider Trading** - Executive buying/selling activity
7. **Short Interest** - Short squeeze potential
8. **Options Flow** - Institutional positioning

### Additional Data Sources:
- NewsAPI for broader news coverage
- Financial Modeling Prep (FMP) for more metrics
- Reddit API for retail sentiment
- Twitter API for social sentiment

---

## Technical Implementation

### Type Safety
- Full TypeScript interfaces for all new data structures
- Strict null checking for optional metrics
- Proper error handling when data unavailable

### Performance
- Parallel API fetches (7 endpoints simultaneously)
- Graceful degradation when endpoints fail
- Caching strategy ready for production

### Code Quality
- Clear separation of scoring components
- Detailed comments explaining thresholds
- Easy to adjust weights and thresholds
- Scalable for additional factors

---

## Benefits Over Previous Version

| Aspect | Old Algorithm | New Algorithm |
|--------|--------------|---------------|
| Factors | 2 (price change, news) | 5 (growth, profit, value, momentum, analyst) |
| Score Range | 50-60 for most stocks | Full 0-100 range utilized |
| Meaningfulness | Surface-level | Fundamental analysis |
| Differentiation | Poor | Excellent |
| Actionability | Low | High |
| Data Sources | 4 endpoints | 7 endpoints |
| Metrics Used | ~5 data points | 20+ data points |

The new algorithm provides **actionable insights** based on **fundamental analysis**, making it a valuable tool for investment decisions rather than just a superficial metric.
