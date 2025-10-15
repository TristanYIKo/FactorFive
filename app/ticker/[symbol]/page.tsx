'use client';

import { useEffect, useState, use, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { StockData, ApiError } from '@/types/stock';
import { formatMarketCap, formatCurrency } from '@/lib/formatters';
import { filterAndSortNewsByRelevance } from '@/lib/newsFilter';

/**
 * FactorFive Ticker Page - /ticker/[symbol]
 * 
 * Displays comprehensive stock information:
 * - Profile header with logo and company name
 * - Price and percent change panel
 * - Upcoming earnings card with date and estimates
 * - Chronological news list with source and published time
 * - Visual progress bar showing computed FactorFive Score
 * 
 * Includes graceful loading and error states
 */
export default function TickerPage({ params }: { params: Promise<{ symbol: string }> }) {
  const router = useRouter();
  const { symbol } = use(params);
  const [data, setData] = useState<StockData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTicker, setSearchTicker] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchStockData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/stock?symbol=${symbol.toUpperCase()}`);
        
        if (!response.ok) {
          const errorData: ApiError = await response.json();
          throw new Error(errorData.error || 'Failed to fetch stock data');
        }

        const stockData: StockData = await response.json();
        setData(stockData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchStockData();
  }, [symbol]);

  // Handle search form submission
  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newSymbol = searchTicker.trim().toUpperCase();
    if (newSymbol && newSymbol !== symbol.toUpperCase()) {
      router.push(`/ticker/${newSymbol}`);
      setSearchTicker('');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-48 mb-6"></div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6">
              <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-64 mb-4"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
              <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-4/5"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Error Loading Stock Data
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || 'Unable to load stock information'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Success state - Display stock data
  const isPositive = data.quote.dp >= 0;
  const priceChangeColor = isPositive ? 'text-green-600' : 'text-red-600';
  const priceChangeBgColor = isPositive ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Top Navigation Bar with Search */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-2 transition-colors"
          >
            ← Back to Home
          </button>
          
          {/* Quick Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-auto">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value)}
              placeholder="Search another ticker..."
              className="px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all outline-none w-full sm:w-48"
              maxLength={10}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 whitespace-nowrap"
            >
              Go
            </button>
          </form>
        </div>

        {/* Profile Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            {data.profile.logo && (
              <img
                src={data.profile.logo}
                alt={`${data.profile.name} logo`}
                className="w-16 h-16 rounded-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {data.profile.name}
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                {data.symbol} • {data.profile.exchange}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Industry</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {data.profile.finnhubIndustry || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Market Cap</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {formatMarketCap(data.profile.marketCapitalization)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Country</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {data.profile.country || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Currency</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {data.profile.currency}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Price Panel */}
          <div className={`lg:col-span-1 ${priceChangeBgColor} rounded-xl shadow-lg p-6`}>
            <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              Current Price
            </h2>
            <p className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              ${data.quote.c.toFixed(2)}
            </p>
            <div className={`${priceChangeColor} font-semibold text-lg`}>
              {isPositive ? '▲' : '▼'} ${Math.abs(data.quote.d).toFixed(2)} ({data.quote.dp.toFixed(2)}%)
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Open</span>
                <span className="font-medium text-gray-900 dark:text-white">${data.quote.o.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">High</span>
                <span className="font-medium text-gray-900 dark:text-white">${data.quote.h.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Low</span>
                <span className="font-medium text-gray-900 dark:text-white">${data.quote.l.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Prev Close</span>
                <span className="font-medium text-gray-900 dark:text-white">${data.quote.pc.toFixed(2)}</span>
              </div>
            </div>
          </div>

    {/* FactorFive Score Panel */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              FactorFive Analysis
            </h2>
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {data.stockScore}/100
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {data.stockScore >= 70 ? '🟢 Strong Buy' : data.stockScore >= 55 ? '🟢 Buy' : data.stockScore >= 40 ? '🟡 Hold' : data.stockScore >= 25 ? '🔴 Sell' : '🔴 Strong Sell'}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    data.stockScore >= 70
                      ? 'bg-green-500'
                      : data.stockScore >= 40
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${data.stockScore}%` }}
                ></div>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {data.scoreBreakdown.description}
              </p>
              
              {/* Detailed Score Breakdown with Tooltips */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                <div 
                  className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-3 border border-blue-200 dark:border-blue-700 cursor-help relative group"
                  title={data.scoreBreakdown.tooltips.growth}
                >
                  <p className="text-blue-600 dark:text-blue-400 text-xs font-medium mb-1">
                    Growth
                    <span className="ml-1 text-[10px] bg-blue-200 dark:bg-blue-800 px-1 rounded">
                      {data.scoreBreakdown.peerContext.percentileRanks.growth}%ile
                    </span>
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white text-lg">
                    {data.scoreBreakdown.growthScore}<span className="text-sm text-gray-500">/20</span>
                  </p>
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                    {data.scoreBreakdown.tooltips.growth}
                  </div>
                </div>
                <div 
                  className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-3 border border-green-200 dark:border-green-700 cursor-help relative group"
                  title={data.scoreBreakdown.tooltips.profitability}
                >
                  <p className="text-green-600 dark:text-green-400 text-xs font-medium mb-1">
                    Profit
                    <span className="ml-1 text-[10px] bg-green-200 dark:bg-green-800 px-1 rounded">
                      {data.scoreBreakdown.peerContext.percentileRanks.profitability}%ile
                    </span>
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white text-lg">
                    {data.scoreBreakdown.profitabilityScore}<span className="text-sm text-gray-500">/20</span>
                  </p>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                    {data.scoreBreakdown.tooltips.profitability}
                  </div>
                </div>
                <div 
                  className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-3 border border-purple-200 dark:border-purple-700 cursor-help relative group"
                  title={data.scoreBreakdown.tooltips.valuation}
                >
                  <p className="text-purple-600 dark:text-purple-400 text-xs font-medium mb-1">
                    Value
                    <span className="ml-1 text-[10px] bg-purple-200 dark:bg-purple-800 px-1 rounded">
                      {data.scoreBreakdown.peerContext.percentileRanks.valuation}%ile
                    </span>
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white text-lg">
                    {data.scoreBreakdown.valuationScore}<span className="text-sm text-gray-500">/20</span>
                  </p>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                    {data.scoreBreakdown.tooltips.valuation}
                  </div>
                </div>
                <div 
                  className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-3 border border-orange-200 dark:border-orange-700 cursor-help relative group"
                  title={data.scoreBreakdown.tooltips.momentum}
                >
                  <p className="text-orange-600 dark:text-orange-400 text-xs font-medium mb-1">
                    Momentum
                    <span className="ml-1 text-[10px] bg-orange-200 dark:bg-orange-800 px-1 rounded">
                      {data.scoreBreakdown.peerContext.percentileRanks.momentum}%ile
                    </span>
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white text-lg">
                    {data.scoreBreakdown.momentumScore}<span className="text-sm text-gray-500">/20</span>
                  </p>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                    {data.scoreBreakdown.tooltips.momentum}
                  </div>
                </div>
                <div 
                  className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700 cursor-help relative group"
                  title={data.scoreBreakdown.tooltips.analyst}
                >
                  <p className="text-indigo-600 dark:text-indigo-400 text-xs font-medium mb-1">
                    Analyst
                    <span className="ml-1 text-[10px] bg-indigo-200 dark:bg-indigo-800 px-1 rounded">
                      {data.scoreBreakdown.peerContext.percentileRanks.analyst}%ile
                    </span>
                  </p>
                  <p className="font-bold text-gray-900 dark:text-white text-lg">
                    {data.scoreBreakdown.analystScore}<span className="text-sm text-gray-500">/20</span>
                  </p>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                    {data.scoreBreakdown.tooltips.analyst}
                  </div>
                </div>
              </div>
              
              {/* Industry Context Badge */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    📊 Compared to <strong>{data.scoreBreakdown.peerContext.peerCount}</strong> peers in <strong>{data.scoreBreakdown.peerContext.industry}</strong>
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 italic">
                    Scores use z-score normalization
                  </span>
                </div>
              </div>

              {/* Detailed Explanations */}
              <div className="mt-4 space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <details className="group">
                  <summary className="cursor-pointer text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                    📊 View Detailed Metrics
                  </summary>
                  <div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-400 pl-4">
                    <p><strong className="text-blue-600 dark:text-blue-400">Growth:</strong> {data.scoreBreakdown.details.growth}</p>
                    <p><strong className="text-green-600 dark:text-green-400">Profitability:</strong> {data.scoreBreakdown.details.profitability}</p>
                    <p><strong className="text-purple-600 dark:text-purple-400">Valuation:</strong> {data.scoreBreakdown.details.valuation}</p>
                    <p><strong className="text-orange-600 dark:text-orange-400">Momentum:</strong> {data.scoreBreakdown.details.momentum}</p>
                    <p><strong className="text-indigo-600 dark:text-indigo-400">Analyst:</strong> {data.scoreBreakdown.details.analyst}</p>
                  </div>
                </details>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 pt-2 italic">
                * Context-aware scoring using relative analysis vs industry peers. Scores reflect percentile rankings, not absolute thresholds.
              </p>
            </div>
          </div>
        </div>

        {/* Analyst Recommendations & Price Target */}
        {(data.recommendations.length > 0 || data.priceTarget) && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              🎯 Analyst Consensus
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recommendations */}
              {data.recommendations.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Recommendations</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Strong Buy</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${(data.recommendations[0].strongBuy / (data.recommendations[0].strongBuy + data.recommendations[0].buy + data.recommendations[0].hold + data.recommendations[0].sell + data.recommendations[0].strongSell)) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white w-6">{data.recommendations[0].strongBuy}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Buy</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-green-400 h-2 rounded-full" 
                            style={{ width: `${(data.recommendations[0].buy / (data.recommendations[0].strongBuy + data.recommendations[0].buy + data.recommendations[0].hold + data.recommendations[0].sell + data.recommendations[0].strongSell)) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white w-6">{data.recommendations[0].buy}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Hold</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-yellow-500 h-2 rounded-full" 
                            style={{ width: `${(data.recommendations[0].hold / (data.recommendations[0].strongBuy + data.recommendations[0].buy + data.recommendations[0].hold + data.recommendations[0].sell + data.recommendations[0].strongSell)) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white w-6">{data.recommendations[0].hold}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Sell</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-red-400 h-2 rounded-full" 
                            style={{ width: `${(data.recommendations[0].sell / (data.recommendations[0].strongBuy + data.recommendations[0].buy + data.recommendations[0].hold + data.recommendations[0].sell + data.recommendations[0].strongSell)) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white w-6">{data.recommendations[0].sell}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Strong Sell</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-red-600 h-2 rounded-full" 
                            style={{ width: `${(data.recommendations[0].strongSell / (data.recommendations[0].strongBuy + data.recommendations[0].buy + data.recommendations[0].hold + data.recommendations[0].sell + data.recommendations[0].strongSell)) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white w-6">{data.recommendations[0].strongSell}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Price Targets */}
              {data.priceTarget && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Price Targets</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">High</span>
                        <span className="text-sm font-bold text-green-600 dark:text-green-400">
                          ${data.priceTarget.targetHigh.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Mean</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          ${data.priceTarget.targetMean.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Median</span>
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          ${data.priceTarget.targetMedian.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Low</span>
                        <span className="text-sm font-bold text-red-600 dark:text-red-400">
                          ${data.priceTarget.targetLow.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Upside Potential</span>
                        <span className={`text-lg font-bold ${
                          ((data.priceTarget.targetMean - data.quote.c) / data.quote.c * 100) > 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {((data.priceTarget.targetMean - data.quote.c) / data.quote.c * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Earnings Card */}
        {data.earnings && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              📅 Upcoming Earnings
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Date</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {new Date(data.earnings.date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {data.earnings.hour === 'bmo' ? 'Before Market Open' : 
                   data.earnings.hour === 'amc' ? 'After Market Close' : 
                   data.earnings.hour}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">EPS Estimate</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {data.earnings.epsEstimate !== null && data.earnings.epsEstimate !== undefined
                    ? `$${data.earnings.epsEstimate.toFixed(2)}`
                    : 'N/A'}
                </p>
                {data.earnings.epsActual !== null && data.earnings.epsActual !== undefined && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Actual: ${data.earnings.epsActual.toFixed(2)}
                  </p>
                )}
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Revenue Estimate</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {data.earnings.revenueEstimate !== null && data.earnings.revenueEstimate !== undefined
                    ? formatCurrency(data.earnings.revenueEstimate)
                    : 'N/A'}
                </p>
                {data.earnings.revenueActual !== null && data.earnings.revenueActual !== undefined && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Actual: {formatCurrency(data.earnings.revenueActual)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* News Sentiment Section */}
        {data.sentiment && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              📈 News Sentiment Analysis
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Overall Sentiment Score</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          data.sentiment.newsScore >= 16
                            ? 'bg-green-500'
                            : data.sentiment.newsScore >= 12
                            ? 'bg-green-400'
                            : data.sentiment.newsScore >= 8
                            ? 'bg-gray-400'
                            : data.sentiment.newsScore >= 4
                            ? 'bg-red-400'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${(data.sentiment.newsScore / 20) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    {data.sentiment.newsScore}<span className="text-lg text-gray-500">/20</span>
                  </span>
                </div>
                <p className={`mt-2 text-sm font-medium ${
                  data.sentiment.newsScore >= 16
                    ? 'text-green-600 dark:text-green-400'
                    : data.sentiment.newsScore >= 12
                    ? 'text-green-500'
                    : data.sentiment.newsScore >= 8
                    ? 'text-gray-600 dark:text-gray-400'
                    : data.sentiment.newsScore >= 4
                    ? 'text-red-500'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {data.sentiment.newsScore >= 16 ? '😊 Very Positive' :
                   data.sentiment.newsScore >= 12 ? '🙂 Positive' :
                   data.sentiment.newsScore >= 8 ? '😐 Neutral' :
                   data.sentiment.newsScore >= 4 ? '😟 Negative' : '😞 Very Negative'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Article Breakdown</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-green-600 dark:text-green-400">Positive</span>
                    <span className="font-bold text-gray-900 dark:text-white">{data.sentiment.positiveCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Neutral</span>
                    <span className="font-bold text-gray-900 dark:text-white">{data.sentiment.neutralCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-red-600 dark:text-red-400">Negative</span>
                    <span className="font-bold text-gray-900 dark:text-white">{data.sentiment.negativeCount}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Analyzed</span>
                      <span className="font-bold text-gray-900 dark:text-white">{data.sentiment.totalArticles}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Latest News Headlines (NewsAPI) - Filtered for Relevance */}
        {data.newsAPIArticles && data.newsAPIArticles.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              📰 Latest News Headlines
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Showing most relevant news for {data.profile.name}
            </p>
            <div className="space-y-4">
              {filterAndSortNewsByRelevance(
                data.newsAPIArticles,
                data.profile.name,
                data.symbol,
                3 // Minimum relevance score (filters out spam and generic news)
              ).slice(0, 8).map((article, index) => (
                <a
                  key={index}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <div className="flex gap-4">
                    {article.urlToImage && (
                      <img
                        src={article.urlToImage}
                        alt=""
                        className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
                        {article.title}
                      </h3>
                      {article.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                          {article.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium">{article.source.name}</span>
                        <span>•</span>
                        <span>
                          {new Date(article.publishedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 italic">
              * Powered by NewsAPI • Sentiment analysis based on keyword detection
            </p>
          </div>
        )}

        {/* Finnhub News Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            📰 Company News - Last 14 Days ({data.news.length})
          </h2>
          {data.news.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No recent news available</p>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {data.news.map((article) => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  <div className="flex gap-4">
                    {article.image && (
                      <img
                        src={article.image}
                        alt=""
                        className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
                        {article.headline}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                        {article.summary}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium">{article.source}</span>
                        <span>•</span>
                        <span>
                          {new Date(article.datetime * 1000).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 italic">
            * Powered by Finnhub API
          </p>
        </div>
      </div>
    </div>
  );
}
