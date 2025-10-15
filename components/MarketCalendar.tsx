'use client';

import { useState, useMemo } from 'react';
import { generateMarketCalendar, groupEventsByMonth, getEventsForDate, MarketEvent } from '@/lib/marketCalendar';

/**
 * Market Calendar Component
 * 
 * Displays upcoming market events in a calendar view including:
 * - FOMC meetings
 * - Economic data releases
 * - Earnings seasons
 * - Market holidays
 */
export default function MarketCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedEvent, setSelectedEvent] = useState<MarketEvent | null>(null);
  
  // Generate all events
  const allEvents = useMemo(() => generateMarketCalendar(), []);
  
  // Group events by month
  const eventsByMonth = useMemo(() => groupEventsByMonth(allEvents), [allEvents]);
  
  // Get events for current month view
  const currentMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthEvents = eventsByMonth.get(currentMonthKey) || [];
  
  // Calendar rendering helpers
  const getMonthDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startDayOfWeek };
  };
  
  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  
  const getCategoryColor = (category: MarketEvent['category']) => {
    switch (category) {
      case 'FOMC':
        return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700';
      case 'Economic Data':
        return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700';
      case 'Earnings Season':
        return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700';
      case 'Holiday':
        return 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700/30 dark:text-gray-300 dark:border-gray-600';
      case 'Other':
        return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700/30 dark:text-gray-300 dark:border-gray-600';
    }
  };
  
  const getImpactBadge = (impact: MarketEvent['impact']) => {
    switch (impact) {
      case 'High':
        return '🔴 High Impact';
      case 'Medium':
        return '🟡 Medium';
      case 'Low':
        return '🟢 Low';
      default:
        return '';
    }
  };
  
  const getEventRelevance = (event: MarketEvent): { why: string; whatToWatch: string; sectors: string } => {
    const category = event.category;
    const title = event.title.toLowerCase();
    
    if (category === 'FOMC') {
      return {
        why: 'The Federal Reserve\'s interest rate decisions directly impact borrowing costs, corporate profitability, and stock valuations. Rate hikes typically strengthen the dollar and can pressure growth stocks, while rate cuts boost market liquidity and risk appetite.',
        whatToWatch: 'Watch for the rate decision, dot plot projections, economic forecasts, and Fed Chair press conference. Market volatility typically spikes during the announcement and Q&A session.',
        sectors: 'Financials (banks benefit from higher rates), Technology (sensitive to rate changes), Real Estate (REITs affected by borrowing costs), Utilities (dividend stocks compete with bonds)'
      };
    }
    
    if (title.includes('cpi') || title.includes('consumer price')) {
      return {
        why: 'CPI measures inflation, which directly influences Fed policy decisions. Higher-than-expected inflation often triggers rate hikes, while cooling inflation can signal potential rate cuts. Markets closely watch this as it affects real returns and purchasing power.',
        whatToWatch: 'Core CPI (excludes food/energy), month-over-month and year-over-year changes, shelter costs, and services inflation. A surprise +0.3% or more can trigger significant market moves.',
        sectors: 'Consumer Staples (pricing power matters), Retailers (margin pressure), Energy (beneficiary of inflation), Materials (commodities linked to inflation)'
      };
    }
    
    if (title.includes('ppi') || title.includes('producer price')) {
      return {
        why: 'PPI is a leading indicator of consumer inflation, showing price pressures at the wholesale level before they reach consumers. Rising PPI can squeeze corporate margins or signal future CPI increases.',
        whatToWatch: 'Core PPI (excludes food/energy), input costs for manufacturers, and trends in goods vs services pricing. Large deviations from expectations can preview CPI surprises.',
        sectors: 'Industrials (input cost sensitivity), Consumer Discretionary (margin impact), Materials (commodity producers), Manufacturing (price pass-through ability)'
      };
    }
    
    if (title.includes('jobs') || title.includes('payroll') || title.includes('employment')) {
      return {
        why: 'Employment data reveals economic strength and labor market tightness. Strong job growth can pressure the Fed to keep rates higher, while weakness might signal recession. Wage growth directly impacts inflation expectations.',
        whatToWatch: 'Non-farm payrolls number, unemployment rate, average hourly earnings (wage inflation), labor force participation rate, and revisions to prior months.',
        sectors: 'Staffing & Recruitment, Retail (consumer spending), Housing (job security drives purchases), Cyclical stocks (economic sensitivity)'
      };
    }
    
    if (title.includes('gdp')) {
      return {
        why: 'GDP measures total economic output and growth. Strong GDP supports corporate earnings growth, while contraction signals recession. Markets use this to gauge economic health and earnings trajectory.',
        whatToWatch: 'GDP growth rate (annualized), consumer spending (70% of GDP), business investment, trade balance, and inventory changes. Anything below 2% or above 4% is noteworthy.',
        sectors: 'Broad market impact - Cyclicals (industrials, materials) most sensitive, Defensive stocks (utilities, healthcare) less affected'
      };
    }
    
    if (title.includes('retail sales')) {
      return {
        why: 'Consumer spending drives 70% of U.S. GDP. Strong retail sales signal economic confidence and support consumer discretionary stocks. Weakness can foreshadow economic slowdown.',
        whatToWatch: 'Headline retail sales, core retail sales (ex-autos), e-commerce trends, gasoline station sales (affected by prices), and restaurant/bar spending.',
        sectors: 'Retail & E-commerce, Consumer Discretionary, Payment Processors (Visa/Mastercard), Logistics & Delivery'
      };
    }
    
    if (title.includes('pce') || title.includes('personal consumption')) {
      return {
        why: 'PCE is the Fed\'s preferred inflation gauge, providing a broader measure than CPI. Core PCE directly influences Fed policy decisions and rate expectations.',
        whatToWatch: 'Core PCE (excludes food/energy), month-over-month changes, services inflation, and deviation from the Fed\'s 2% target. Personal income and spending data are also included.',
        sectors: 'Similar to CPI - broad market impact with special focus on rate-sensitive sectors like Technology, Real Estate, and Financials'
      };
    }
    
    if (title.includes('ism') || title.includes('manufacturing')) {
      return {
        why: 'ISM surveys gauge business activity and new orders. Readings above 50 indicate expansion, below 50 signal contraction. Forward-looking indicator for industrial production and GDP.',
        whatToWatch: 'Headline PMI number, new orders, employment component, prices paid (inflation indicator), and supplier deliveries. Watch the 50-level threshold closely.',
        sectors: 'Industrials, Manufacturing, Materials, Machinery & Equipment, Transportation'
      };
    }
    
    if (title.includes('housing') || title.includes('home sales')) {
      return {
        why: 'Housing market health impacts construction, consumer wealth (home equity), and spending. Highly sensitive to interest rates and economic confidence. Leading indicator for furniture, appliances, and related sectors.',
        whatToWatch: 'Sales volumes, median prices, inventory levels, months of supply, and pending home sales (forward indicator). Watch relationship with mortgage rates.',
        sectors: 'Homebuilders, Building Materials, Furniture & Appliances, Home Improvement (HD, LOW), Mortgage REITs'
      };
    }
    
    if (title.includes('earnings season')) {
      return {
        why: 'Quarterly earnings reveal corporate profitability, guidance, and management outlook. Earnings drive stock prices and set market tone. Strong earnings can offset macro concerns.',
        whatToWatch: 'Earnings beats/misses vs expectations, revenue growth, guidance for next quarter, margin trends, and sector-specific commentary. Tech earnings often set market direction.',
        sectors: 'All sectors report, but Technology (largest weight), Financials (early reporters), Consumer Discretionary, and Healthcare typically drive market moves'
      };
    }
    
    if (category === 'Holiday') {
      return {
        why: 'Market holidays affect trading volume, liquidity, and price discovery. Days before/after holidays often see thin trading and increased volatility. Some holidays mark quarter-end positioning.',
        whatToWatch: 'Pre-holiday volume patterns, potential for gap moves on reopening, settlement deadlines, and reduced liquidity impacts.',
        sectors: 'Broad market impact - reduced volume affects all sectors, but low liquidity can amplify moves in smaller-cap stocks'
      };
    }
    
    // Default for other events
    return {
      why: 'This economic event provides important insight into market conditions and can influence investor sentiment, Federal Reserve policy decisions, and sector rotation strategies.',
      whatToWatch: 'Monitor the headline number versus economist expectations, forward guidance, and any surprising data points that could shift market expectations.',
      sectors: 'Impact varies by specific event - generally affects rate-sensitive sectors (Technology, Real Estate) and economically-sensitive sectors (Industrials, Consumer Discretionary)'
    };
  };
  
  const { daysInMonth, startDayOfWeek } = getMonthDays();
  
  // Get events for a specific day
  const getEventsForDay = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return getEventsForDate(currentMonthEvents, date);
  };
  
  // Get upcoming events (next 15)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return allEvents
      .filter((event) => event.date >= now)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 15);
  }, [allEvents]);

  return (
    <div className="space-y-6">
      {/* Header with View Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            📅 Market Calendar
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track important economic events, Fed meetings, and earnings seasons
          </p>
        </div>
        
        {/* View Mode Toggle */}
        <div className="flex gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              viewMode === 'calendar'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            📆 Calendar
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              viewMode === 'list'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            📋 List
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500"></div>
          <span className="text-gray-600 dark:text-gray-400">FOMC</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Economic Data</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-purple-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Earnings</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Holiday</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Other</span>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <>
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={previousMonth}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              ← Previous
            </button>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={nextMonth}
              className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Next →
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="px-2 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7">
              {/* Empty cells for days before month starts */}
              {Array.from({ length: startDayOfWeek }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="min-h-24 p-2 border-b border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                />
              ))}

              {/* Days of the month */}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const dayEvents = getEventsForDay(day);
                const isToday =
                  new Date().getDate() === day &&
                  new Date().getMonth() === currentMonth.getMonth() &&
                  new Date().getFullYear() === currentMonth.getFullYear();

                return (
                  <div
                    key={day}
                    className="min-h-24 p-2 border-b border-r border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div
                      className={`text-sm font-semibold mb-1 ${
                        isToday
                          ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className={`text-xs px-1 py-0.5 rounded border truncate cursor-pointer hover:scale-105 transition-transform ${getCategoryColor(
                            event.category
                          )}`}
                          title={`${event.title} - Click for details`}
                          onClick={() => setSelectedEvent(event)}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        /* List View */
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Upcoming Events (Next 15)
          </h3>
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className={`p-4 rounded-lg border-l-4 ${getCategoryColor(event.category)} bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                onClick={() => setSelectedEvent(event)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {event.title}
                      </h4>
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {event.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {event.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium">
                        📅 {event.date.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      {event.time && <span>🕐 {event.time}</span>}
                      <span className="font-medium">{getImpactBadge(event.impact)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
          <div className="text-2xl font-bold text-red-700 dark:text-red-300">
            {allEvents.filter((e) => e.category === 'FOMC').length}
          </div>
          <div className="text-xs text-red-600 dark:text-red-400">FOMC Meetings</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {allEvents.filter((e) => e.category === 'Economic Data').length}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400">Economic Reports</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {allEvents.filter((e) => e.category === 'Earnings Season').length}
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-400">Earnings Events</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            {allEvents.filter((e) => e.category === 'Holiday').length}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Market Holidays</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">
            {allEvents.filter((e) => e.impact === 'High').length}
          </div>
          <div className="text-xs text-green-600 dark:text-green-400">High Impact Events</div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`p-6 border-b-4 ${getCategoryColor(selectedEvent.category)}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {selectedEvent.category}
                    </span>
                    <span className="text-xs font-medium">
                      {getImpactBadge(selectedEvent.impact)}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {selectedEvent.title}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">
                      📅 {selectedEvent.date.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    {selectedEvent.time && <span>🕐 {selectedEvent.time}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold leading-none"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Description */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  📋 What is this?
                </h4>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {selectedEvent.description}
                </p>
              </div>

              {/* Why It Matters */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                  💡 Why It Matters
                </h4>
                <p className="text-blue-800 dark:text-blue-200 leading-relaxed">
                  {getEventRelevance(selectedEvent).why}
                </p>
              </div>

              {/* What to Watch */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <h4 className="text-lg font-semibold text-purple-900 dark:text-purple-300 mb-2 flex items-center gap-2">
                  👀 What to Watch For
                </h4>
                <p className="text-purple-800 dark:text-purple-200 leading-relaxed">
                  {getEventRelevance(selectedEvent).whatToWatch}
                </p>
              </div>

              {/* Affected Sectors */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <h4 className="text-lg font-semibold text-green-900 dark:text-green-300 mb-2 flex items-center gap-2">
                  📊 Affected Sectors & Stocks
                </h4>
                <p className="text-green-800 dark:text-green-200 leading-relaxed">
                  {getEventRelevance(selectedEvent).sectors}
                </p>
              </div>

              {/* Trading Tips */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                <h4 className="text-lg font-semibold text-yellow-900 dark:text-yellow-300 mb-2 flex items-center gap-2">
                  ⚠️ Trading Considerations
                </h4>
                <p className="text-yellow-800 dark:text-yellow-200 leading-relaxed">
                  {selectedEvent.impact === 'High' 
                    ? 'High volatility expected around this event. Consider reducing position sizes, using stop losses, or avoiding new positions until after the release. Options traders should be aware of elevated IV (implied volatility).'
                    : selectedEvent.impact === 'Medium'
                    ? 'Moderate market impact expected. Monitor related sectors for potential moves. Good opportunity for sector rotation strategies.'
                    : 'Low immediate market impact, but still valuable for understanding economic trends. Good for longer-term strategic positioning.'}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
