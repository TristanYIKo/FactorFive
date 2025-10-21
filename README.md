# 📊 FactorFive — Intelligent Stock Analysis (Stock Score)

FactorFive is a modern stock analysis tool that instantly evaluates any ticker using a proprietary **five-factor model**.
It combines **live financial data**, **news sentiment**, and **peer benchmarks** to deliver a single, easy-to-understand **Stock Score (0–100)**.

**Live demo:** 👉 https://factor-five.vercel.app/

## ✨ Key Features

- **Real-time analysis** — up-to-date prices and performance metrics for any stock
- **Five-factor scoring** — evaluates **Growth**, **Profitability**, **Valuation**, **Quality**, and **Momentum** (each 0–20)
- **Peer comparison** — benchmarks companies against industry averages and peers
- **News sentiment analysis** — uses NewsAPI to derive a 0–20 sentiment score that feeds the stock score
- **Market insights** — earnings dates and important economic events
- **Responsive UI** — works on desktop, tablet, and mobile with dark mode support

## 🚀 Quick Start

1. **Prerequisites**
	- Node.js 18+ and npm
	- Finnhub API key (https://finnhub.io/)
	- NewsAPI key (https://newsapi.org/)

2. **Install & run**

```bash
# Clone the repository
git clone https://github.com/TristanYIKo/FactorFive.git
cd FactorFive

# Install dependencies
npm install

# Create a .env.local file in the project root with your keys
echo "FINNHUB_KEY=your_finnhub_api_key" > .env.local
echo "NEWS_API_KEY=your_news_api_key" >> .env.local

# Run the dev server
npm run dev

# Open http://localhost:3000
```

## 🧭 Usage

1. Open the site and enter any ticker symbol (e.g., **AAPL**, **MSFT**, **TSLA**).
2. Press Enter or click **Analyze Stock**.
3. The app shows an overall **FactorFive Score (0–100)** with a detailed breakdown and news sentiment.

## 🛠️ Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **APIs:** Finnhub (market & financial data), NewsAPI (news & sentiment)
- **Deployment:** Vercel

## 📊 Scoring Methodology (summary)

- **Z-score normalization** for peer comparison
- **Steep sigmoid** (steepness 2.5) and power amplification for aggressive separation
- **Compound excellence multiplier** (+bonus for multiple exceptional factor scores)
- **Mega-cap safeguards** to avoid undervaluing large companies

See the repo docs for full methodology.

## 🤝 Contributing

Contributions, issues, and suggestions are welcome. Please open an issue or PR.

## 📄 License

MIT

## 🙏 Acknowledgments

- Market data by **Finnhub**
- News data by **NewsAPI**
- Built with **Next.js** and **Tailwind CSS**
