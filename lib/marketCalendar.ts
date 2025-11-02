/**
 * Market Calendar - Economic Events & Key Dates
 * 
 * This module provides data for major market-moving events including:
 * - Federal Reserve FOMC meetings
 * - Economic data releases (CPI, Jobs, GDP)
 * - Earnings seasons
 * - Market holidays
 * - Other major scheduled events
 */

export interface MarketEvent {
  id: string;
  date: Date;
  title: string;
  description: string;
  category: 'FOMC' | 'Economic Data' | 'Earnings Season' | 'Holiday' | 'Other';
  impact: 'High' | 'Medium' | 'Low';
  time?: string; // e.g., "2:00 PM ET"
  isRecurring?: boolean;
}

/**
 * Generate market calendar events for the current and upcoming months
 */
export function generateMarketCalendar(startDate: Date = new Date()): MarketEvent[] {
  const events: MarketEvent[] = [];
  
  // FOMC Meeting Dates 2025 (announced by Federal Reserve)
  const fomcDates2025 = [
    { date: new Date('2025-01-28'), endDate: new Date('2025-01-29') },
    { date: new Date('2025-03-18'), endDate: new Date('2025-03-19') },
    { date: new Date('2025-05-06'), endDate: new Date('2025-05-07') },
    { date: new Date('2025-06-17'), endDate: new Date('2025-06-18') },
    { date: new Date('2025-07-29'), endDate: new Date('2025-07-30') },
    { date: new Date('2025-09-16'), endDate: new Date('2025-09-17') },
    // November 4th meeting removed per user request
    { date: new Date('2025-12-09'), endDate: new Date('2025-12-10') }, // Changed from Dec 16-17 to Dec 9-10
  ];

  fomcDates2025.forEach((meeting, index) => {
    events.push({
      id: `fomc-2025-${index + 1}`,
      date: meeting.endDate, // Announcement is typically on the second day
      title: 'FOMC Meeting & Rate Decision',
      description: 'Federal Reserve announces interest rate decision and monetary policy statement. Press conference follows.',
      category: 'FOMC',
      impact: 'High',
      time: '2:00 PM ET',
      isRecurring: false,
    });
  });

  // Generate recurring monthly economic data releases
  const currentYear = startDate.getFullYear();
  const currentMonth = startDate.getMonth();
  
  // Generate for next 6 months
  for (let i = 0; i < 6; i++) {
    const month = (currentMonth + i) % 12;
    const year = currentYear + Math.floor((currentMonth + i) / 12);
    
    // CPI (Consumer Price Index) - typically mid-month around 13th
    events.push({
      id: `cpi-${year}-${month}`,
      date: getEstimatedDate(year, month, 13, 3), // 13th day, usually Tuesday-Thursday
      title: 'CPI Report (Consumer Price Index)',
      description: 'Bureau of Labor Statistics releases Consumer Price Index, measuring inflation and cost of living changes. Key indicator for Fed policy decisions.',
      category: 'Economic Data',
      impact: 'High',
      time: '8:30 AM ET',
      isRecurring: true,
    });

    // PPI (Producer Price Index) - typically 2-3 days before CPI, around 11th
    events.push({
      id: `ppi-${year}-${month}`,
      date: (year === 2025 && month === 10) ? new Date('2025-11-15') : getEstimatedDate(year, month, 11, 3), // November 2025 override to 14th
      title: 'PPI Report (Producer Price Index)',
      description: 'Bureau of Labor Statistics releases Producer Price Index, measuring wholesale inflation and input costs for businesses. Leading indicator for CPI.',
      category: 'Economic Data',
      impact: 'High',
      time: '8:30 AM ET',
      isRecurring: true,
    });

    // Non-Farm Payrolls (Jobs Report) - First Friday of the month
    const firstFriday = getFirstFridayOfMonth(year, month);
    events.push({
      id: `jobs-${year}-${month}`,
      date: firstFriday,
      title: 'Jobs Report (Non-Farm Payrolls)',
      description: 'Monthly employment data including new jobs created, unemployment rate, and wage growth. Major market mover.',
      category: 'Economic Data',
      impact: 'High',
      time: '8:30 AM ET',
      isRecurring: true,
    });

    // JOLTS (Job Openings and Labor Turnover Survey) - First Tuesday after NFP, ~5 weeks lag
    const joltsDate = new Date(firstFriday.getTime() + 7 * 24 * 60 * 60 * 1000); // Week after NFP
    const joltsTuesday = getNextTuesday(joltsDate);
    events.push({
      id: `jolts-${year}-${month}`,
      date: (year === 2025 && month === 10) ? new Date('2025-11-05') : joltsTuesday, // November 2025 override to 4th
      title: 'JOLTS Report (Job Openings)',
      description: 'Job Openings and Labor Turnover Survey showing labor market demand, hiring, quits, and layoffs. Fed watches closely.',
      category: 'Economic Data',
      impact: 'High',
      time: '10:00 AM ET',
      isRecurring: true,
    });

    // Retail Sales - Mid-month around 15th
    events.push({
      id: `retail-${year}-${month}`,
      date: getEstimatedDate(year, month, 15, 3),
      title: 'Retail Sales Report',
      description: 'Census Bureau data showing monthly retail sales and consumer spending trends. Key GDP component (70% of economy).',
      category: 'Economic Data',
      impact: 'High',
      time: '8:30 AM ET',
      isRecurring: true,
    });

    // PMI Manufacturing - First business day of the month
    events.push({
      id: `pmi-${year}-${month}`,
      date: getFirstBusinessDay(year, month),
      title: 'ISM Manufacturing PMI',
      description: 'Purchasing Managers Index showing manufacturing sector health and economic activity. Above 50 = expansion.',
      category: 'Economic Data',
      impact: 'Medium',
      time: '10:00 AM ET',
      isRecurring: true,
    });

    // Consumer Confidence - Last Tuesday of the month
    const lastTuesday = getLastTuesdayOfMonth(year, month);
    events.push({
      id: `confidence-${year}-${month}`,
      date: lastTuesday,
      title: 'Consumer Confidence Index',
      description: 'Conference Board survey measuring consumer sentiment about the economy and spending intentions.',
      category: 'Economic Data',
      impact: 'Medium',
      time: '10:00 AM ET',
      isRecurring: true,
    });

    // University of Michigan Consumer Sentiment - Mid and end of month (preliminary & final)
    events.push({
      id: `umich-prelim-${year}-${month}`,
      date: getSecondFridayOfMonth(year, month),
      title: 'U of Michigan Sentiment (Preliminary)',
      description: 'University of Michigan Consumer Sentiment Index - preliminary reading. Measures consumer confidence and inflation expectations.',
      category: 'Economic Data',
      impact: 'Medium',
      time: '10:00 AM ET',
      isRecurring: true,
    });

    events.push({
      id: `umich-final-${year}-${month}`,
      date: getLastFridayOfMonth(year, month),
      title: 'U of Michigan Sentiment (Final)',
      description: 'University of Michigan Consumer Sentiment Index - final reading. Includes 1-year and 5-year inflation expectations.',
      category: 'Economic Data',
      impact: 'Medium',
      time: '10:00 AM ET',
      isRecurring: true,
    });

    // Monthly Treasury Statement - typically 12th business day, around 16th-18th
    events.push({
      id: `treasury-${year}-${month}`,
      date: getEstimatedDate(year, month, 17, 3),
      title: 'Monthly Treasury Statement',
      description: 'U.S. Treasury report on federal government receipts, outlays, and budget deficit/surplus for the month.',
      category: 'Economic Data',
      impact: 'Low',
      time: '2:00 PM ET',
      isRecurring: true,
    });
  }

  // PCE Inflation (Personal Consumption Expenditures) - Last week of month, typically ~3 weeks after CPI
  // This is the Fed's preferred inflation gauge
  for (let i = 0; i < 6; i++) {
    const month = (currentMonth + i) % 12;
    const year = currentYear + Math.floor((currentMonth + i) / 12);
    
    // PCE typically comes out on the last Friday of the month
    const pceDate = getLastFridayOfMonth(year, month);
    // But adjust if it's too close to month end (usually 3-4 days before end)
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const pceDateDay = pceDate.getDate();
    
    // If last Friday is within 3 days of month end, use it; otherwise use 3rd or 4th Friday
    let finalPceDate = pceDate;
    if (lastDayOfMonth - pceDateDay < 3) {
      finalPceDate = new Date(pceDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Previous Friday
    }
    
    events.push({
      id: `pce-${year}-${month}`,
      date: finalPceDate,
      title: 'PCE Inflation Report',
      description: 'Personal Consumption Expenditures Price Index - the Federal Reserve\'s preferred inflation measure. More comprehensive than CPI.',
      category: 'Economic Data',
      impact: 'High',
      time: '8:30 AM ET',
      isRecurring: true,
    });
  }

  // GDP Releases (Quarterly) - Last week of Jan, Apr, Jul, Oct
  const gdpMonths = [0, 3, 6, 9]; // January, April, July, October
  gdpMonths.forEach((month) => {
    const year = currentYear + (month < currentMonth ? 1 : 0);
    if (year === currentYear || year === currentYear + 1) {
      const gdpDate = getEstimatedDate(year, month, 26, 4); // Last week, typically Thursday
      events.push({
        id: `gdp-${year}-q${Math.floor(month / 3) + 1}`,
        date: gdpDate,
        title: `Q${Math.floor(month / 3) + 1} GDP Report`,
        description: 'Quarterly Gross Domestic Product data showing economic growth rate and overall economy health.',
        category: 'Economic Data',
        impact: 'High',
        time: '8:30 AM ET',
        isRecurring: true,
      });
    }
  });

  // Earnings Seasons (approximate periods)
  const earningsSeasons = [
    { start: new Date('2025-01-13'), end: new Date('2025-02-14'), quarter: 'Q4 2024' },
    { start: new Date('2025-04-14'), end: new Date('2025-05-16'), quarter: 'Q1 2025' },
    { start: new Date('2025-07-14'), end: new Date('2025-08-15'), quarter: 'Q2 2025' },
    { start: new Date('2025-10-13'), end: new Date('2025-11-14'), quarter: 'Q3 2025' },
  ];

  earningsSeasons.forEach((season, index) => {
    events.push({
      id: `earnings-start-${index}`,
      date: season.start,
      title: `${season.quarter} Earnings Season Begins`,
      description: `Major companies start reporting ${season.quarter} earnings. Expect increased volatility and trading volume.`,
      category: 'Earnings Season',
      impact: 'High',
      isRecurring: false,
    });

    events.push({
      id: `earnings-peak-${index}`,
      date: new Date(season.start.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks after start
      title: `${season.quarter} Earnings Season Peak`,
      description: `Majority of S&P 500 companies reporting this week. High market volatility expected.`,
      category: 'Earnings Season',
      impact: 'High',
      isRecurring: false,
    });
  });

  // Major Market Holidays 2025
  const holidays2025 = [
    { date: new Date('2025-01-01'), name: "New Year's Day" },
    { date: new Date('2025-01-20'), name: 'Martin Luther King Jr. Day' },
    { date: new Date('2025-02-17'), name: "Presidents' Day" },
    { date: new Date('2025-04-18'), name: 'Good Friday' },
    { date: new Date('2025-05-26'), name: 'Memorial Day' },
    { date: new Date('2025-06-19'), name: 'Juneteenth' },
    { date: new Date('2025-07-04'), name: 'Independence Day' },
    { date: new Date('2025-09-01'), name: 'Labor Day' },
    { date: new Date('2025-11-27'), name: 'Thanksgiving Day' },
    { date: new Date('2025-12-25'), name: 'Christmas Day' },
  ];

  holidays2025.forEach((holiday) => {
    events.push({
      id: `holiday-${holiday.name.toLowerCase().replace(/\s+/g, '-')}`,
      date: holiday.date,
      title: `Market Closed: ${holiday.name}`,
      description: 'U.S. stock markets (NYSE, NASDAQ) closed for holiday. No trading.',
      category: 'Holiday',
      impact: 'Low',
      isRecurring: false,
    });
  });

  // Other Important Events
  const otherEvents = [
    {
      date: new Date('2025-02-04'),
      title: 'Treasury Refunding Announcement',
      description: 'U.S. Treasury announces quarterly borrowing plans and auction sizes.',
      impact: 'Medium' as const,
    },
    {
      date: new Date('2025-03-31'),
      title: 'End of Q1 2025',
      description: 'Quarter end - Expect portfolio rebalancing and window dressing activity.',
      impact: 'Medium' as const,
    },
    {
      date: new Date('2025-06-30'),
      title: 'End of Q2 2025 / Mid-Year',
      description: 'Mid-year mark - Major portfolio rebalancing and fund flows.',
      impact: 'Medium' as const,
    },
    {
      date: new Date('2025-09-30'),
      title: 'End of Q3 2025',
      description: 'Quarter end - Portfolio rebalancing activity expected.',
      impact: 'Medium' as const,
    },
    {
      date: new Date('2025-12-31'),
      title: 'End of Year 2025',
      description: 'Year-end trading - Tax-loss harvesting and portfolio rebalancing.',
      impact: 'High' as const,
    },
  ];

  otherEvents.forEach((event, index) => {
    events.push({
      id: `other-${index}`,
      date: event.date,
      title: event.title,
      description: event.description,
      category: 'Other',
      impact: event.impact,
      isRecurring: false,
    });
  });

  // Filter events to show only upcoming (from startDate onwards)
  const filteredEvents = events.filter((event) => event.date >= startDate);

  // Sort by date
  return filteredEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Helper functions for date calculations

function getFirstFridayOfMonth(year: number, month: number): Date {
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  return new Date(year, month, 1 + daysUntilFriday);
}

function getSecondFridayOfMonth(year: number, month: number): Date {
  const firstFriday = getFirstFridayOfMonth(year, month);
  return new Date(firstFriday.getTime() + 7 * 24 * 60 * 60 * 1000);
}

function getLastFridayOfMonth(year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0);
  const dayOfWeek = lastDay.getDay();
  const daysBackToFriday = (dayOfWeek - 5 + 7) % 7;
  return new Date(year, month + 1, 0 - daysBackToFriday);
}

function getNextTuesday(date: Date): Date {
  const dayOfWeek = date.getDay();
  const daysUntilTuesday = (2 - dayOfWeek + 7) % 7;
  return new Date(date.getTime() + daysUntilTuesday * 24 * 60 * 60 * 1000);
}

function getFirstBusinessDay(year: number, month: number): Date {
  let day = new Date(year, month, 1);
  while (day.getDay() === 0 || day.getDay() === 6) {
    day = new Date(day.getTime() + 24 * 60 * 60 * 1000);
  }
  return day;
}

function getLastTuesdayOfMonth(year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0);
  const dayOfWeek = lastDay.getDay();
  const daysBackToTuesday = (dayOfWeek - 2 + 7) % 7;
  return new Date(year, month + 1, 0 - daysBackToTuesday);
}

function getEstimatedDate(year: number, month: number, targetDay: number, targetDayOfWeek: number): Date {
  // targetDayOfWeek: 0=Sunday, 1=Monday, ..., 5=Friday
  let date = new Date(year, month, targetDay);
  const dayOfWeek = date.getDay();
  
  // If it falls on weekend, move to next weekday
  if (dayOfWeek === 0) {
    date = new Date(date.getTime() + 24 * 60 * 60 * 1000); // Sunday -> Monday
  } else if (dayOfWeek === 6) {
    date = new Date(date.getTime() + 2 * 24 * 60 * 60 * 1000); // Saturday -> Monday
  }
  
  return date;
}

/**
 * Group events by month for calendar display
 */
export function groupEventsByMonth(events: MarketEvent[]): Map<string, MarketEvent[]> {
  const grouped = new Map<string, MarketEvent[]>();
  
  events.forEach((event) => {
    const monthKey = `${event.date.getFullYear()}-${String(event.date.getMonth() + 1).padStart(2, '0')}`;
    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, []);
    }
    grouped.get(monthKey)!.push(event);
  });
  
  return grouped;
}

/**
 * Get events for a specific date
 */
export function getEventsForDate(events: MarketEvent[], date: Date): MarketEvent[] {
  return events.filter((event) => {
    const eventDate = new Date(event.date);
    return (
      eventDate.getFullYear() === date.getFullYear() &&
      eventDate.getMonth() === date.getMonth() &&
      eventDate.getDate() === date.getDate()
    );
  });
}

/**
 * Get next N upcoming events
 */
export function getUpcomingEvents(events: MarketEvent[], count: number = 10): MarketEvent[] {
  const now = new Date();
  return events
    .filter((event) => event.date >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, count);
}
