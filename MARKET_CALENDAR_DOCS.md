# 📅 Market Calendar Feature

## Overview

The Market Calendar is a comprehensive tracking system for major market-moving events that impact stock prices and trading decisions.

## Features

### 🗓️ **Two View Modes**

1. **Calendar View** - Visual monthly calendar showing events on specific dates
2. **List View** - Chronological list of upcoming 15 events with full details

### 📊 **Event Categories**

| Category | Description | Impact Level |
|----------|-------------|--------------|
| **FOMC** | Federal Reserve meetings & interest rate decisions | 🔴 High |
| **Economic Data** | CPI, Jobs Report, GDP, PMI, Retail Sales | 🔴 High / 🟡 Medium |
| **Earnings Season** | Quarterly earnings reporting periods | 🔴 High |
| **Market Holiday** | NYSE/NASDAQ closed days | 🟢 Low |
| **Other** | Quarter-ends, Treasury announcements | 🟡 Medium |

---

## 📅 What's Tracked

### **Federal Reserve (FOMC)**
- 8 scheduled meetings per year (2025 dates included)
- Interest rate decisions at 2:00 PM ET
- Press conferences with Fed Chair
- Policy statement releases

### **Monthly Economic Data**

#### **Inflation Indicators** 🔥
- **CPI Report** (13th of month, 8:30 AM ET) - Consumer Price Index - Main inflation gauge
- **PPI Report** (11th of month, 8:30 AM ET) - Producer Price Index - Wholesale inflation
- **PCE Inflation** (Last Friday, 8:30 AM ET) - Personal Consumption Expenditures - Fed's preferred measure

#### **Labor Market** 💼
- **Jobs Report** (1st Friday, 8:30 AM ET) - Non-farm payrolls, unemployment rate
- **JOLTS Report** (~Week after Jobs, 10:00 AM ET) - Job openings, quits, layoffs

#### **Consumer Spending & Sentiment** 🛍️
- **Retail Sales** (15th of month, 8:30 AM ET) - Consumer spending trends
- **Consumer Confidence Index** (Last Tuesday, 10:00 AM ET) - Conference Board survey
- **U of Michigan Sentiment - Preliminary** (2nd Friday, 10:00 AM ET) - Early read
- **U of Michigan Sentiment - Final** (Last Friday, 10:00 AM ET) - Final with inflation expectations

#### **Other Key Reports** 📊
- **ISM Manufacturing PMI** (1st business day, 10:00 AM ET) - Manufacturing health
- **Monthly Treasury Statement** (~17th of month, 2:00 PM ET) - Federal budget data

### **Quarterly Reports**
- **GDP** (Last week of Jan/Apr/Jul/Oct) - Economic growth
- **Earnings Seasons** (4 per year):
  - Q4 2024: Jan 13 - Feb 14, 2025
  - Q1 2025: Apr 14 - May 16, 2025
  - Q2 2025: Jul 14 - Aug 15, 2025
  - Q3 2025: Oct 13 - Nov 14, 2025

### **Market Holidays 2025**
- New Year's Day, MLK Day, Presidents' Day
- Good Friday, Memorial Day, Juneteenth
- Independence Day, Labor Day
- Thanksgiving, Christmas

### **Other Key Dates**
- Quarter-end rebalancing (Mar 31, Jun 30, Sep 30, Dec 31)
- Treasury refunding announcements
- Tax-loss harvesting periods

---

## 🎨 Color Coding

- **Red** 🔴 - FOMC meetings (highest impact)
- **Blue** 🔵 - Economic data releases
- **Purple** 🟣 - Earnings seasons
- **Gray** ⚫ - Market holidays
- **Green** 🟢 - Other events

---

## 📱 How to Use

### **On Home Page**
1. Click **"📅 Market Calendar"** tab at the top
2. Switch between **Calendar** and **List** views
3. Navigate months using **Previous/Next** buttons
4. Hover over events to see full details

### **Calendar View**
- Current day highlighted in blue
- Events shown as colored badges on each day
- Maximum 3 events displayed per day ("+X more" for additional)
- Click/hover events for full description

### **List View**
- Next 15 upcoming events in chronological order
- Full event details with date, time, and impact level
- Category badges for quick identification
- Impact indicators (🔴 High, 🟡 Medium, 🟢 Low)

---

## 📊 Statistics Dashboard

Bottom of the calendar shows:
- **FOMC Meetings** - Total Fed meetings
- **Economic Reports** - Number of data releases
- **Earnings Events** - Earnings season markers
- **Market Holidays** - Closed trading days
- **High Impact Events** - Critical market movers

---

## 💡 Why This Matters

### **For Day Traders**
- Avoid trading during high-volatility events
- Position ahead of major announcements
- Know when markets are closed

### **For Swing Traders**
- Plan entries/exits around FOMC meetings
- Anticipate earnings season volatility
- Monitor economic data trends

### **For Long-Term Investors**
- Track Fed policy direction (rate hikes/cuts)
- Understand economic cycle (CPI, GDP, Jobs)
- Plan tax strategies around year-end

---

## 🔧 Technical Details

### **Files Created**
1. `lib/marketCalendar.ts` - Data generation logic
   - `generateMarketCalendar()` - Creates all events
   - `groupEventsByMonth()` - Organizes by month
   - `getEventsForDate()` - Filters by specific date
   - `getUpcomingEvents()` - Next N events

2. `components/MarketCalendar.tsx` - React component
   - Calendar grid with 7-day weeks
   - List view with detailed cards
   - Month navigation
   - Statistics summary

3. `app/page.tsx` - Updated home page
   - Tab navigation (Stock Analysis / Market Calendar)
   - Integrated MarketCalendar component

### **Event Structure**
```typescript
interface MarketEvent {
  id: string;
  date: Date;
  title: string;
  description: string;
  category: 'FOMC' | 'Economic Data' | 'Earnings Season' | 'Holiday' | 'Other';
  impact: 'High' | 'Medium' | 'Low';
  time?: string; // e.g., "2:00 PM ET"
  isRecurring?: boolean;
}
```

---

## 📈 Example Events

### **FOMC Meeting (March 2025)**
```
📅 March 19, 2025 @ 2:00 PM ET
🔴 High Impact
Federal Reserve announces interest rate decision and monetary policy statement. 
Press conference follows.
```

### **CPI Report (Consumer Price Index)**
```
📅 13th of each month @ 8:30 AM ET
🔴 High Impact
Bureau of Labor Statistics releases Consumer Price Index, measuring inflation 
and cost of living changes. Key indicator for Fed policy decisions.
```

### **PPI Report (Producer Price Index)**
```
📅 11th of each month @ 8:30 AM ET
🔴 High Impact
Bureau of Labor Statistics releases Producer Price Index, measuring wholesale 
inflation and input costs. Leading indicator for CPI.
```

### **PCE Inflation Report**
```
📅 Last Friday of month @ 8:30 AM ET
🔴 High Impact
Personal Consumption Expenditures Price Index - the Federal Reserve's preferred 
inflation measure. More comprehensive than CPI.
```

### **Jobs Report (Non-Farm Payrolls)**
```
📅 First Friday of month @ 8:30 AM ET
🔴 High Impact
Monthly employment data including new jobs created, unemployment rate, 
and wage growth. Major market mover.
```

### **JOLTS Report (Job Openings)**
```
📅 ~Week after Jobs Report @ 10:00 AM ET
🔴 High Impact
Job Openings and Labor Turnover Survey showing labor market demand, hiring, 
quits, and layoffs. Fed watches closely.
```

### **Retail Sales Report**
```
📅 15th of each month @ 8:30 AM ET
🔴 High Impact
Census Bureau data showing monthly retail sales and consumer spending trends. 
Key GDP component (70% of economy).
```

### **University of Michigan Consumer Sentiment**
```
📅 2nd Friday (Preliminary) & Last Friday (Final) @ 10:00 AM ET
🟡 Medium Impact
Consumer confidence and inflation expectations. Final reading includes 
1-year and 5-year inflation outlook.
```

### **Monthly Treasury Statement**
```
📅 ~17th of each month @ 2:00 PM ET
🟢 Low Impact
U.S. Treasury report on federal government receipts, outlays, and 
budget deficit/surplus.
```

---

## 🎯 Future Enhancements (Ideas)

- [ ] Add filter by category/impact level
- [ ] Export calendar to iCal/Google Calendar
- [ ] Email/SMS reminders for events
- [ ] Historical event outcomes (actual vs expected)
- [ ] Company-specific earnings dates
- [ ] International market events (ECB, BOJ, etc.)
- [ ] Real-time event updates via API

---

## 📚 Data Sources

- **FOMC Schedule**: [Federal Reserve Website](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm)
- **Economic Calendar**: Bureau of Labor Statistics, Census Bureau
- **Market Holidays**: NYSE Official Calendar
- **Earnings Seasons**: Historical patterns (Mid-Jan, Apr, Jul, Oct)

---

## ✅ Benefits

✅ **Never miss** important market events  
✅ **Plan trades** around high-volatility periods  
✅ **Understand** why markets move on specific days  
✅ **Stay informed** about Fed policy direction  
✅ **Avoid surprises** from unexpected announcements  

---

**Your Market Calendar is now live at:** http://localhost:3001

Click the **📅 Market Calendar** tab to explore! 🚀
