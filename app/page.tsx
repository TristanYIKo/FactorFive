'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * FactorFive - Home Page
 * 
 * Landing page with a ticker input that navigates to /ticker/[symbol]
 * User enters a stock symbol (e.g., AAPL, TSLA, MSFT) and submits
 */
// Popular and recommended tickers grouped by category
const RECOMMENDED_TICKERS = {
  'Mega Cap Tech': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META'],
  'EV & Auto': ['TSLA', 'F', 'GM', 'RIVN'],
  'Finance': ['JPM', 'BAC', 'GS', 'V', 'MA'],
  'Healthcare': ['JNJ', 'UNH', 'PFE', 'MRNA'],
  'Entertainment': ['DIS', 'NFLX', 'SPOT'],
  'Semiconductors': ['AMD', 'INTC', 'TSM', 'QCOM'],
  'Retail': ['WMT', 'TGT', 'COST', 'HD'],
  'Energy': ['XOM', 'CVX', 'BP'],
};

export default function Home() {
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredTickers, setFilteredTickers] = useState<Array<{ symbol: string; category: string }>>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter tickers based on input
  useEffect(() => {
    if (ticker.length === 0) {
      setFilteredTickers([]);
      setShowDropdown(false);
      return;
    }

    const input = ticker.toUpperCase();
    const matches: Array<{ symbol: string; category: string }> = [];

    // Search through all tickers
    Object.entries(RECOMMENDED_TICKERS).forEach(([category, symbols]) => {
      symbols.forEach((symbol) => {
        if (symbol.startsWith(input) || symbol.includes(input)) {
          matches.push({ symbol, category });
        }
      });
    });

    // Limit to 8 results (not too many)
    setFilteredTickers(matches.slice(0, 8));
    setShowDropdown(matches.length > 0);
  }, [ticker]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const symbol = ticker.trim().toUpperCase();
    if (symbol) {
      router.push(`/ticker/${symbol}`);
      setShowDropdown(false);
    }
  };

  const handleTickerSelect = (symbol: string) => {
    setTicker(symbol);
    setShowDropdown(false);
    router.push(`/ticker/${symbol}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">
            FactorFive
          </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-300">
            The intelligent 5-factor stock analysis engine
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Powered by Finnhub API
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 sm:p-12">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <label 
                htmlFor="ticker" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Enter Stock Ticker
              </label>
              <input
                ref={inputRef}
                id="ticker"
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                onFocus={() => ticker.length > 0 && filteredTickers.length > 0 && setShowDropdown(true)}
                placeholder="e.g., AAPL, TSLA, MSFT"
                className="w-full px-6 py-4 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all duration-200 outline-none"
                required
                maxLength={10}
                autoComplete="off"
                autoFocus
              />
              
              {/* Recommended Tickers Dropdown */}
              {showDropdown && filteredTickers.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl max-h-64 overflow-y-auto"
                >
                  {filteredTickers.map(({ symbol, category }) => (
                    <button
                      key={symbol}
                      type="button"
                      onClick={() => handleTickerSelect(symbol)}
                      className="w-full px-6 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900 dark:text-white text-lg">
                          {symbol}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {category}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] focus:ring-4 focus:ring-blue-300 shadow-lg"
            >
              Analyze Stock
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-3">
              Popular stocks to try:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'].map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => router.push(`/ticker/${symbol}`)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200"
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            Real-time data including price, daily change, company profile,
          </p>
          <p>
            upcoming earnings, and latest news from the past 14 days
          </p>
        </div>
      </div>
    </div>
  );
}
