# 📊 FactorFive - Intelligent Stock Analysis📈 Stock Score



A sophisticated, real-time stock analysis platform built with Next.js, TypeScript, and Tailwind CSS.A free, real-time stock analysis web app built with Next.js and Tailwind CSS — available here:

👉 https://factor-five.vercel.app/

**Live Demo:** 👉 [factor-five.vercel.app](https://factor-five.vercel.app/)

**What It Does**

## 🎯 What It Does

Stock Score lets you instantly analyze any stock by entering its ticker symbol (like AAPL or TSLA).

FactorFive provides institutional-grade stock analysis using a proprietary 5-factor model that evaluates companies across multiple dimensions:You’ll see key data pulled in real-time from the Finnhub API, including:



### The 5 FactorsLive Price & Daily Change

1. **📈 Growth** - Revenue growth, earnings growth, and expansion trajectory

2. **💰 Profitability** - Operating margins, net margins, ROE, and ROACompany Information (name, logo, market cap, industry)

3. **💵 Valuation** - P/E ratio, P/B ratio, and relative market pricing

4. **⚖️ Quality** - Balance sheet strength, earnings stability, cash flow, and capital efficiencyUpcoming Earnings Dates

5. **🎯 Analyst Consensus** - Professional recommendations and price targets

Recent News Headlines

Each factor is scored 0-20 points using non-linear sigmoid transformations and peer comparison, with a compound excellence multiplier for top performers.

A Custom “Stock Score” (0–100) based on price movement and news volume

## ✨ Features

🚀 How to Use

### Stock Analysis

- **Real-time data** from Finnhub API (quotes, financials, recommendations)Go to https://factor-five.vercel.app/

- **Intelligent scoring** with aggressive separation (85-100 elite, 50-64 average, 0-35 poor)

- **Peer comparison** across industry benchmarksType in a stock ticker (for example, AAPL, TSLA, MSFT)

- **News sentiment analysis** from NewsAPI with relevance filtering

- **Detailed metrics breakdown** showing all underlying data pointsPress Enter or click Analyze Stock



### Market CalendarInstantly view:

- **FOMC meetings** and Fed rate decisions- The company’s profile and current performance

- **Economic data releases** (CPI, PPI, Jobs Report, GDP, Retail Sales)- Latest news articles

- **Earnings seasons** and market holidays- Upcoming earnings events

- **Interactive event details** - click any event for comprehensive explanations of market relevance- A visual Stock Score showing overall momentum

- **Calendar and list views** with impact indicators


### User Experience
- **Responsive design** - works on desktop, tablet, and mobile
- **Dark mode support** throughout
- **Fast loading** with optimized API calls
- **Smart caching** to reduce API usage
- **Error handling** with graceful fallbacks

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- [Finnhub API key](https://finnhub.io/) (free tier available)
- [NewsAPI key](https://newsapi.org/) (free tier available)

### Installation

```bash
# Clone the repository
git clone https://github.com/TristanYIKo/FactorFive.git
cd FactorFive

# Install dependencies
npm install

# Set up environment variables
# Create a .env.local file in the root directory:
FINNHUB_KEY=your_finnhub_api_key_here
NEWS_API_KEY=your_news_api_key_here

# Run the development server
npm run dev

# Open http://localhost:3000
```

### Usage

1. Navigate to the homepage
2. Enter any stock ticker (e.g., AAPL, MSFT, TSLA, NVDA)
3. Press Enter or click "Analyze Stock"
4. View comprehensive analysis including:
   - FactorFive Score (0-100)
   - Individual factor breakdowns
   - Peer comparison metrics
   - News sentiment
   - Analyst recommendations
5. Scroll down for Market Calendar with upcoming economic events
6. Click any calendar event for detailed explanations

## 📚 Documentation

- **[FIVE_FACTOR_MODEL.md](./FIVE_FACTOR_MODEL.md)** - Complete explanation of the scoring algorithm
- **[ECONOMIC_INDICATORS_GUIDE.md](./ECONOMIC_INDICATORS_GUIDE.md)** - Reference for understanding economic data
- **[MARKET_CALENDAR_DOCS.md](./MARKET_CALENDAR_DOCS.md)** - Market calendar feature documentation
- **[docs-archive/](./docs-archive/)** - Historical development notes and deployment summaries

## 🛠️ Tech Stack

- **Framework:** Next.js 15.5.4 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **APIs:** Finnhub (stock data), NewsAPI (news)
- **Deployment:** Vercel (serverless)
- **Hosting:** [factor-five.vercel.app](https://factor-five.vercel.app/)

## 📊 Scoring Methodology

FactorFive uses advanced statistical methods:

- **Z-score normalization** for peer comparison
- **Sigmoid transformation** (steepness 2.5) for non-linear scoring
- **Power amplification** (+15% boost for above-average, -15% penalty for below-average)
- **Compound excellence multiplier** (+15 bonus when 4-5 factors score ≥17/20)
- **Mega-cap safeguards** to prevent undervaluing strong large-cap companies
- **Industry benchmarks** for context-aware evaluation

See [FIVE_FACTOR_MODEL.md](./FIVE_FACTOR_MODEL.md) for detailed formulas and examples.

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome! Feel free to:
- Open issues for bugs or feature requests
- Submit pull requests for improvements
- Share your thoughts on the scoring methodology

## 📄 License

MIT License - feel free to use this code for learning or personal projects.

## 🙏 Acknowledgments

- Market data provided by [Finnhub](https://finnhub.io/)
- News data from [NewsAPI](https://newsapi.org/)
- Built with [Next.js](https://nextjs.org/) and [Tailwind CSS](https://tailwindcss.com/)

---

**Repository:** [github.com/TristanYIKo/FactorFive](https://github.com/TristanYIKo/FactorFive)
