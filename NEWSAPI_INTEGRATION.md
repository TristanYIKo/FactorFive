# NewsAPI Integration & Sentiment Analysis

## Overview

FactorFive now integrates **NewsAPI** to provide real-time news sentiment analysis alongside Finnhub's company news. This enhancement adds a **News Sentiment Score (0-20 points)** based on keyword analysis of recent headlines.

---

## Architecture

### Data Flow

```
User requests ticker (e.g., AAPL)
    ↓
/api/stock endpoint
    ↓
Parallel fetch:
├─ Finnhub API (company profile) → Get company name
├─ NewsAPI (using company name) → Get 20 recent articles
└─ Sentiment analysis → Analyze keywords
    ↓
Return combined data with sentiment score
    ↓
Frontend displays:
├─ News Sentiment Score (0-20)
├─ 5 latest headlines
└─ Sentiment breakdown (positive/neutral/negative)
```

---

## Backend Implementation

### 1. Environment Variables (`.env.local`)

```bash
# NewsAPI Key - Keep this secret, never commit to version control
NEWS_API_KEY=e5798523eb224748b6639968ec8e7673
```

**Security**: ✅ Stored server-side only, never exposed to client

---

### 2. TypeScript Types (`types/stock.ts`)

#### New Interfaces

```typescript
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

// Sentiment Analysis Result
export interface SentimentAnalysis {
  newsScore: number; // 0-20 points
  averageSentiment: number; // -1 to +1
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  totalArticles: number;
}
```

#### Updated StockData Interface

```typescript
export interface StockData {
  // ...existing fields
  newsAPIArticles?: NewsAPIArticle[]; // Top 20 from NewsAPI
  sentiment?: SentimentAnalysis; // News sentiment analysis
}
```

---

### 3. Sentiment Analysis Library (`lib/sentiment.ts`)

#### Keyword-Based Scoring

**Positive Keywords** (+1 point):
- growth, beats, record, strong, profit, innovation
- surge, soar, rally, upgrade, bullish, gains
- positive, success, breakthrough, outperform, exceeds

**Negative Keywords** (-1 point):
- lawsuit, miss, decline, investigation, drop, warning
- falls, plunge, crash, downgrade, bearish, loss
- negative, concern, worry, underperform, weak

#### Scoring Algorithm

```typescript
For each article:
  1. Analyze title (weight: 1.0)
  2. Analyze description (weight: 0.5)
  3. Combine: articleSentiment = titleScore + (descScore * 0.5)
  4. Categorize: positive (+), neutral (0), or negative (-)

Average all articles: avgSentiment (-1 to +1)

Convert to 0-20 scale:
  newsScore = ((avgSentiment + 1) / 2) * 20
```

**Example**:
```
20 articles analyzed:
- 12 positive keywords found
- 3 negative keywords found
- 5 neutral articles

Average sentiment: +0.45
News Score: ((0.45 + 1) / 2) * 20 = 14.5/20 → "Positive"
```

#### Helper Functions

```typescript
analyzeNewsSentiment(articles) → SentimentAnalysis
getSentimentLabel(score) → "Very Positive" | "Positive" | "Neutral" | ...
getSentimentColor(score) → Tailwind color class
getSentimentBgColor(score) → Tailwind background class
```

---

### 4. API Routes

#### `/api/news` (Standalone)

**Purpose**: Fetch news and sentiment for a specific ticker

**Endpoint**: `GET /api/news?symbol=AAPL`

**Flow**:
1. Resolve ticker → company name (via Finnhub)
2. Fetch 20 articles from NewsAPI
3. Analyze sentiment
4. Return articles + sentiment

**Response**:
```json
{
  "symbol": "AAPL",
  "companyName": "Apple Inc",
  "articles": [...],
  "sentiment": {
    "newsScore": 15,
    "averageSentiment": 0.5,
    "positiveCount": 12,
    "negativeCount": 3,
    "neutralCount": 5,
    "totalArticles": 20
  },
  "totalResults": 1250,
  "fetchedAt": "2025-10-12T10:30:00Z"
}
```

#### `/api/stock` (Extended)

**Purpose**: Main stock endpoint now includes NewsAPI data

**Endpoint**: `GET /api/stock?symbol=AAPL`

**Updated Flow**:
```typescript
1. Parallel fetch Finnhub endpoints (quote, profile, etc.)
2. Get company name from profile
3. Fetch NewsAPI articles (20 recent)
4. Analyze sentiment
5. Return combined data with sentiment
```

**Key Code**:
```typescript
// Fetch NewsAPI after getting company name
if (NEWS_API_KEY && profile.name) {
  const newsAPIUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
    profile.name
  )}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`;

  const newsAPIResponse = await fetch(newsAPIUrl, { cache: 'no-store' });
  newsAPIArticles = newsAPIData.articles || [];
  
  if (newsAPIArticles.length > 0) {
    sentiment = analyzeNewsSentiment(newsAPIArticles);
  }
}
```

**Graceful Degradation**: If NewsAPI fails, app continues with Finnhub data only

---

## Frontend Implementation

### 1. News Sentiment Card

**Location**: Above news headlines on ticker page

**Features**:
- **Progress bar** showing score out of 20
- **Color-coded** (green = positive, gray = neutral, red = negative)
- **Emoji indicator** (😊, 🙂, 😐, 😟, 😞)
- **Article breakdown**: Positive/Neutral/Negative counts

**Visual**:
```
┌─────────────────────────────────────────┐
│ 📊 News Sentiment Analysis              │
├─────────────────────────────────────────┤
│ Overall Sentiment Score                 │
│ [████████████░░░░░░░░] 15/20           │
│ 🙂 Positive                             │
│                                         │
│ Article Breakdown:                      │
│ Positive:  12                           │
│ Neutral:    5                           │
│ Negative:   3                           │
│ Total:     20                           │
└─────────────────────────────────────────┘
```

### 2. Latest News Headlines (NewsAPI)

**Location**: Below sentiment card

**Features**:
- **Top 5 articles** from NewsAPI
- **Image thumbnails** (if available)
- **Title + description**
- **Source name** and **publish time**
- **Click to open** article in new tab

**Visual**:
```
┌─────────────────────────────────────────┐
│ 📰 Latest News Headlines                │
├─────────────────────────────────────────┤
│ [IMG] Apple reports record quarterly... │
│       Positive earnings beat analyst... │
│       Reuters • Oct 12, 2025, 10:30 AM  │
├─────────────────────────────────────────┤
│ [IMG] iPhone 16 sales exceed expecta... │
│       Strong demand in Asian markets... │
│       Bloomberg • Oct 12, 2025, 9:15 AM │
└─────────────────────────────────────────┘
```

### 3. Finnhub Company News

**Location**: Below NewsAPI headlines

**Features**:
- **All articles** from last 14 days (Finnhub)
- **Scrollable** (max height 600px)
- **Same card layout** as NewsAPI
- **Labeled** as "Company News - Last 14 Days"

---

## Sentiment Score Interpretation

| Score Range | Label | Emoji | Color | Meaning |
|-------------|-------|-------|-------|---------|
| 16-20 | Very Positive | 😊 | Green | Strong bullish sentiment |
| 12-15 | Positive | 🙂 | Light Green | Moderately bullish |
| 8-11 | Neutral | 😐 | Gray | No clear sentiment |
| 4-7 | Negative | 😟 | Orange/Red | Moderately bearish |
| 0-3 | Very Negative | 😞 | Red | Strong bearish sentiment |

---

## Example Scenarios

### Scenario 1: Positive News Cycle (Apple)

**Input**: 20 recent articles about Apple
- 15 contain positive keywords ("growth", "record", "beats")
- 2 contain negative keywords ("concern", "drop")
- 3 are neutral

**Calculation**:
```
Total sentiment: +15 (positive) - 2 (negative) = +13
Average: 13 / 20 = +0.65
News Score: ((0.65 + 1) / 2) * 20 = 16.5/20
```

**Result**: ✅ 17/20 - "Very Positive" (green)

---

### Scenario 2: Negative News Cycle (Tesla Investigation)

**Input**: 20 recent articles
- 3 contain positive keywords
- 12 contain negative keywords ("lawsuit", "investigation", "decline")
- 5 are neutral

**Calculation**:
```
Total sentiment: +3 - 12 = -9
Average: -9 / 20 = -0.45
News Score: ((-0.45 + 1) / 2) * 20 = 5.5/20
```

**Result**: ❌ 6/20 - "Negative" (red)

---

### Scenario 3: Mixed/Neutral News (Microsoft)

**Input**: 20 recent articles
- 5 positive
- 4 negative
- 11 neutral

**Calculation**:
```
Total sentiment: +5 - 4 = +1
Average: 1 / 20 = +0.05
News Score: ((0.05 + 1) / 2) * 20 = 10.5/20
```

**Result**: ⚪ 11/20 - "Neutral" (gray)

---

## API Rate Limits & Caching

### NewsAPI Limits
- **Free tier**: 100 requests/day
- **Developer tier**: 1,000 requests/day
- **Business tier**: Unlimited

### Current Strategy
- ✅ `cache: "no-store"` ensures fresh data
- ⚠️ Each stock lookup = 1 NewsAPI call
- 💡 **Future**: Implement caching to reduce API calls

### Recommended Caching Strategy (Future)
```typescript
// Cache news for 15 minutes per ticker
const cacheKey = `news_${symbol}_${Math.floor(Date.now() / 900000)}`;
```

---

## Error Handling

### Graceful Degradation

```typescript
if (NEWS_API_KEY && profile.name) {
  try {
    // Fetch NewsAPI
  } catch (error) {
    console.warn('Failed to fetch NewsAPI, continuing without it');
    // ✅ App still works with Finnhub data only
  }
}
```

**Scenarios Handled**:
- ❌ NewsAPI key not configured → Skip NewsAPI, use Finnhub only
- ❌ NewsAPI rate limit exceeded → Graceful fail, show Finnhub news
- ❌ Company name not found → Skip NewsAPI fetch
- ❌ No articles returned → Show 0 articles, no sentiment card
- ❌ Network error → Log warning, continue with partial data

---

## Testing Checklist

### Backend Tests

```bash
# Test standalone news endpoint
curl "http://localhost:3000/api/news?symbol=AAPL"

# Test integrated stock endpoint
curl "http://localhost:3000/api/stock?symbol=AAPL"

# Test with invalid symbol
curl "http://localhost:3000/api/news?symbol=INVALID123"

# Test sentiment analysis
# Check lib/sentiment.ts with test articles
```

### Frontend Tests

1. ✅ Navigate to ticker page (e.g., `/ticker/AAPL`)
2. ✅ Verify sentiment card appears with score
3. ✅ Verify 5 NewsAPI headlines display
4. ✅ Verify Finnhub news still shows
5. ✅ Test with ticker that has no news
6. ✅ Test sentiment color changes (positive/neutral/negative)
7. ✅ Click article links → Opens in new tab

---

## Future Enhancements

### Phase 2: Advanced Sentiment
- **NLP Analysis**: Use sentiment analysis libraries (e.g., `sentiment`, `natural`)
- **Entity Recognition**: Identify specific topics (earnings, lawsuits, products)
- **Trend Analysis**: Track sentiment changes over time
- **Stock correlation**: Compare sentiment vs price movements

### Phase 3: Additional Sources
- **Twitter/X API**: Social media sentiment
- **Reddit API**: r/wallstreetbets and investing subreddits
- **Financial Modeling Prep**: More detailed news and analysis
- **Seeking Alpha**: Analyst articles and comments

### Phase 4: Caching & Performance
- **Redis caching**: Store news for 15-30 minutes
- **Background jobs**: Pre-fetch news for popular tickers
- **CDN**: Cache static article images
- **Rate limiting**: Client-side throttling to conserve API calls

---

## Cost Analysis

### NewsAPI Pricing

| Tier | Requests/Day | Cost | FactorFive Usage |
|------|--------------|------|------------------|
| **Developer** | 100 | Free | ✅ Low traffic sites |
| **Developer** | 1,000 | $49/mo | ✅ Medium traffic |
| **Business** | Unlimited | $299/mo | Growing sites |

### Current Usage Estimate
- Average: **1 API call per stock lookup**
- 100 lookups/day = **Free tier** ✅
- 1,000 lookups/day = **$49/month**

---

## Security Considerations

✅ **API Key Security**:
- Stored in `.env.local` (not committed to Git)
- Only accessed server-side
- Never exposed to client

✅ **CORS**:
- NewsAPI called from server (Next.js API route)
- Client never makes direct cross-origin requests

✅ **Input Validation**:
- Ticker symbols validated
- Company names URL-encoded
- Error handling for malformed requests

✅ **Rate Limiting** (Future):
- Implement IP-based rate limiting
- Cache to reduce API calls
- Queue requests during high traffic

---

## Monitoring & Logging

### Current Logging

```typescript
console.warn('Failed to fetch NewsAPI data, continuing without it');
```

### Recommended Logging (Future)

```typescript
// Track API usage
logger.info('NewsAPI request', { symbol, articles: newsAPIArticles.length });

// Track errors
logger.error('NewsAPI error', { symbol, error: error.message });

// Track sentiment scores
logger.info('Sentiment analysis', { symbol, score: sentiment.newsScore });
```

---

## Conclusion

FactorFive now provides **intelligent news sentiment analysis** powered by NewsAPI. The system:

✅ Fetches 20 recent articles per ticker  
✅ Analyzes sentiment using keyword detection  
✅ Displays News Sentiment Score (0-20 points)  
✅ Shows 5 most recent headlines with sources  
✅ Gracefully handles errors and missing data  
✅ Maintains performance with concurrent API calls  
✅ Keeps API keys secure server-side  

The sentiment score provides users with **at-a-glance insight** into recent news coverage, complementing the existing 5-factor technical analysis.
