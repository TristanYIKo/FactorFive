# Stock Score - Next.js Web Application

A modern stock analysis web application built with Next.js, TypeScript, and Tailwind CSS that provides real-time stock data using the Finnhub API.

## Features

- 🔍 **Real-time Stock Data**: Live price quotes with daily change percentages
- 📊 **Company Profiles**: Comprehensive company information including logo, industry, and market cap
- 📰 **Recent News**: Latest 14 days of news headlines with sources and timestamps
- 📅 **Earnings Calendar**: Upcoming earnings dates with EPS and revenue estimates
- 🎯 **Stock Score**: Computed score (0-100) based on price change and news volume
- 🎨 **Beautiful UI**: Modern, responsive design with dark mode support
- ⚡ **Fast & Efficient**: Server-side API calls keep secrets secure and responses fast

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **API**: Finnhub API
- **Deployment**: Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Finnhub API key (get one free at https://finnhub.io)

### Installation

1. Clone the repository (or use your existing project)

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the project root with your Finnhub API key:
```env
FINNHUB_KEY=your_finnhub_api_key_here
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Enter a stock ticker symbol (e.g., AAPL, TSLA, MSFT) on the home page
2. Click "Analyze Stock" or press Enter
3. View comprehensive stock information including:
   - Current price and daily change
   - Company profile with logo
   - Stock score with visual progress bar
   - Upcoming earnings date and estimates
   - Recent news articles from the past 14 days

### Example Tickers to Try

- **AAPL** - Apple Inc.
- **TSLA** - Tesla Inc.
- **MSFT** - Microsoft Corporation
- **GOOGL** - Alphabet Inc.
- **AMZN** - Amazon.com Inc.
- **NVDA** - NVIDIA Corporation

## Project Structure

```
my-next-app/
├── app/
│   ├── api/
│   │   └── stock/
│   │       └── route.ts          # Server-side API endpoint
│   ├── ticker/
│   │   └── [symbol]/
│   │       ├── page.tsx           # Dynamic ticker page
│   │       ├── loading.tsx        # Loading state
│   │       └── error.tsx          # Error boundary
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Home page with ticker input
│   └── globals.css                # Global styles
├── types/
│   └── stock.ts                   # TypeScript type definitions
├── .env.local                     # Environment variables (not committed)
└── package.json
```

## API Endpoints Used

The application uses the following Finnhub API endpoints:

- **`/quote`** - Current price and daily change
- **`/stock/profile2`** - Company profile (name, logo, industry, market cap)
- **`/company-news`** - Company news from the last 14 days
- **`/calendar/earnings`** - Upcoming earnings dates with estimates

All API calls are made server-side in `/api/stock?symbol=XYZ` to keep the API key secure.

## Stock Score Algorithm

The current Stock Score is a transparent placeholder metric (0-100) calculated using:

- **60% Weight**: Daily percent change (normalized to ±10%)
- **40% Weight**: News volume (number of articles in past 14 days)

### Future Enhancements

The code includes comments indicating where additional data providers can be integrated:

- **NewsAPI**: Additional news sources and sentiment analysis
- **Financial Modeling Prep (FMP)**: More financial metrics and ratios
- **Reddit API**: Social media sentiment analysis
- **Technical Indicators**: RSI, MACD, moving averages
- **Analyst Ratings**: Price targets and recommendations

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `FINNHUB_KEY` | Your Finnhub API key (required) | `abc123...` |
| `NEXT_PUBLIC_BASE_URL` | Base URL for the app (optional) | `http://localhost:3000` |

**Important**: Never commit `.env.local` to version control. The API key must remain secret.

## Development

### Cache Strategy

All fetch calls use `{ cache: "no-store" }` to avoid stale data during development. For production, consider implementing appropriate caching strategies.

### Error Handling

The app includes comprehensive error handling:

- Loading states with skeleton UI
- Error boundaries for graceful error display
- API error responses with helpful messages
- Image fallbacks for missing logos

### Type Safety

All API responses are fully typed using TypeScript interfaces defined in `types/stock.ts`.

## Deploy on Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add your `FINNHUB_KEY` environment variable in Vercel settings
4. Deploy

The app will automatically use Vercel's edge network for fast global delivery.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Finnhub API Documentation](https://finnhub.io/docs/api) - learn about Finnhub API endpoints.

## License

MIT
