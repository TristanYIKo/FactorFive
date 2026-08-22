# FactorFive

Five-factor equity analysis, benchmarked against size-matched industry peers and
the market a company actually trades in.

**Live:** [factor-five.vercel.app](https://factor-five.vercel.app/)

---

## What it does

Enter a ticker and get a 0–100 score built from five factors of 20 points each:

| Factor | Measures |
|---|---|
| **Growth** | Revenue and EPS expansion |
| **Profitability** | Return on equity, net and operating margin |
| **Valuation** | P/E and P/B — what you pay per unit of earnings and book |
| **Quality** | Leverage, liquidity, asset efficiency |
| **Analyst** | Consensus positioning across covering analysts |

Alongside it: peer distributions with quartiles, relative strength versus the
S&P 500 across four windows, a risk profile (beta, realised volatility, return
per unit of risk, drawdown), a volatility-derived twelve-month range, news
sentiment, and a rolling market calendar.

### Every score shows its work

The headline number never appears without the evidence behind it. Peer count,
cohort quality and a confidence rating sit directly beside it, and each factor
states the company's figure against the peer median it was measured on.

When the data is thin, the app says so rather than guessing. That is a
deliberate design property, not a detail — see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Running locally

```bash
npm install
```

Create `.env.local` with your own keys — the file is gitignored:

```
FINNHUB_KEY=your_finnhub_key
NEWS_API_KEY=your_newsapi_key
FRED_API_KEY=your_fred_key
```

Get them free from [finnhub.io](https://finnhub.io/dashboard),
[newsapi.org](https://newsapi.org/account) and
[fredaccount.stlouisfed.org](https://fredaccount.stlouisfed.org/apikeys). FRED
supplies the market calendar's economic release dates; without it the calendar
shows only holidays and options expirations. Then:

```bash
npm run dev
```

Check the keys loaded without printing them:

```bash
curl -s localhost:3000/api/health
```

## Benchmarking

With a production build running (`npm run build && npm start`):

```bash
node test-api-performance.js --concurrency 5
```

Reports latency and classifies each response as `sound`, `thin-flagged`,
`DISHONEST` or `FAIL`. Exits non-zero only on the last two — thin data on a
free-tier quota is expected; thin data presented confidently is a bug.

## A note on the free tier

Finnhub's free plan allows **60 requests per minute**, and a fully cold symbol
costs about 15. So a cold cache fills roughly four symbols per minute. Warm
requests are essentially free (measured p50 of 43ms for five concurrent), and
popular tickers stay warm. Cold bursts degrade gracefully and say so.

`/stock/price-target` is premium-only, so the Analyst factor's price-target
component always falls back to neutral on a free key.

## Tech

Next.js 15 (App Router, React 19 server components), TypeScript, Tailwind v4.
Charts are hand-rolled inline SVG — no charting dependency. Data from
[Finnhub](https://finnhub.io/) and [NewsAPI](https://newsapi.org/).

## Disclaimer

For research and education. Not investment advice, and not a recommendation to
buy or sell any security.
