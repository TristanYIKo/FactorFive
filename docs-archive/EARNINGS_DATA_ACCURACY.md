# 📅 Earnings Data Accuracy - Important Information

## Current Status

Your application displays **upcoming earnings dates** for stocks, but the data source (Finnhub Free Tier) has **limitations** that may result in inaccurate or missing earnings dates.

---

## ⚠️ Known Limitations

### **1. Finnhub Free Tier Restrictions**
- **Limited Historical Data**: Free tier may not have the most recent earnings calendar updates
- **Coverage Gaps**: Not all companies have earnings data available
- **Update Frequency**: Earnings dates may not be updated immediately when companies announce changes
- **Premium Data**: Accurate, real-time earnings calendars typically require premium data subscriptions

### **2. Why Earnings Dates Can Be Wrong**
- Companies often announce earnings dates with only 2-4 weeks notice
- Earnings dates can change due to various corporate reasons
- Free data providers may lag behind official company announcements
- Some companies don't publish earnings calendars far in advance

---

## ✅ Recent Improvements Made

### **Backend Changes (app/api/stock/route.ts)**

1. **Extended Date Range**: Changed from 90 to 120 days to catch quarterly earnings
2. **Date Sorting**: Added logic to sort earnings by date and filter out past dates
3. **Better Filtering**: Only show future earnings dates, skip historical ones

```typescript
// Sort earnings by date (ascending) to get the earliest upcoming one
const sortedEarnings = [...earningsData.earningsCalendar].sort((a, b) => {
  return new Date(a.date).getTime() - new Date(b.date).getTime();
});

// Filter to only future dates (in case API returns past earnings)
const futureEarnings = sortedEarnings.filter(e => new Date(e.date) >= new Date());
```

### **Frontend Changes (app/ticker/[symbol]/page.tsx)**

Added disclaimer: **"Verify on company IR page"** to the earnings card header

---

## 🎯 How to Verify Earnings Dates

### **Official Sources (Always Most Accurate)**

For each company, check their official Investor Relations page:

| Company | Earnings Calendar URL |
|---------|---------------------|
| Apple (AAPL) | https://investor.apple.com/investor-relations/default.aspx |
| Microsoft (MSFT) | https://www.microsoft.com/en-us/Investor |
| Amazon (AMZN) | https://ir.aboutamazon.com/events-and-presentations/default.aspx |
| Google (GOOGL) | https://abc.xyz/investor/ |
| Tesla (TSLA) | https://ir.tesla.com/ |
| NVIDIA (NVDA) | https://investor.nvidia.com/events-and-presentations/default.aspx |

**General Pattern**: Most companies use `investor.{company}.com` or `ir.{company}.com`

### **Reputable Third-Party Sources**

1. **Yahoo Finance**: https://finance.yahoo.com/calendar/earnings
2. **MarketWatch**: https://www.marketwatch.com/tools/earnings
3. **Nasdaq**: https://www.nasdaq.com/market-activity/earnings
4. **Seeking Alpha**: https://seekingalpha.com/earnings/earnings-calendar
5. **Earnings Whispers**: https://www.earningswhispers.com/calendar

---

## 🔧 How to Improve Earnings Data Accuracy

### **Option 1: Upgrade to Premium Data Provider** (Recommended)

**Financial Modeling Prep (FMP)** - Professional financial data
- **Cost**: ~$14-29/month
- **Accuracy**: Very high (institutional-grade data)
- **Coverage**: All major US stocks + international
- **API Endpoint**: `/v3/earning_calendar`

**Implementation:**
```typescript
// Add FMP API call
const fmpEarningsUrl = `https://financialmodelingprep.com/api/v3/earning_calendar?symbol=${symbol}&apikey=${FMP_API_KEY}`;
```

**Alpha Vantage** - Another good option
- **Cost**: $49/month for premium
- **Endpoint**: `EARNINGS_CALENDAR`

---

### **Option 2: Add Manual Override System**

Create a local database to override incorrect earnings dates:

**File**: `lib/earningsOverrides.ts`
```typescript
export const earningsOverrides: Record<string, { date: string; time: string }> = {
  'AAPL': { date: '2025-01-30', time: 'amc' },
  'MSFT': { date: '2025-01-28', time: 'amc' },
  'AMZN': { date: '2025-02-01', time: 'amc' },
  // Add more as needed
};
```

Then in `app/api/stock/route.ts`:
```typescript
import { earningsOverrides } from '@/lib/earningsOverrides';

// After fetching earnings from API
if (earningsOverrides[symbol]) {
  nextEarnings = {
    date: earningsOverrides[symbol].date,
    hour: earningsOverrides[symbol].time,
    // ... other fields
  };
}
```

---

### **Option 3: Scrape Company IR Pages** (Advanced)

Use a web scraper to pull earnings dates directly from company IR pages:

**Pros:**
- Most accurate (source of truth)
- Free (no API costs)

**Cons:**
- Each company has different HTML structure
- Requires maintenance when sites change
- Slower (HTTP requests + parsing)
- May violate ToS for some sites

**Libraries:**
- **Cheerio** (Node.js HTML parsing)
- **Puppeteer** (Headless browser)

---

### **Option 4: User-Submitted Corrections**

Add a feature for users to report incorrect earnings dates:

1. "Report incorrect date" button on earnings card
2. Store corrections in database
3. Display community-sourced dates with confidence indicator
4. Verify against multiple sources

---

## 📊 Current Implementation Details

### **API Call**
```typescript
// app/api/stock/route.ts line 140
const earningsUrl = `https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&from=${today}&to=${120DaysLater}&token=${FINNHUB_KEY}`;
```

### **Response Format**
```json
{
  "earningsCalendar": [
    {
      "date": "2025-01-30",
      "epsActual": null,
      "epsEstimate": 2.10,
      "hour": "amc",
      "quarter": 1,
      "revenueActual": null,
      "revenueEstimate": 123500000000,
      "symbol": "AAPL",
      "year": 2025
    }
  ]
}
```

### **Frontend Display**
Shows:
- Date (formatted: "January 30, 2025")
- Time ("Before Market Open" or "After Market Close")
- EPS Estimate
- Revenue Estimate
- Small disclaimer: "Verify on company IR page"

---

## 🚀 Recommended Action Plan

### **Immediate (No Cost)**
1. ✅ Extended date range to 120 days (DONE)
2. ✅ Added date sorting and filtering (DONE)
3. ✅ Added disclaimer to UI (DONE)
4. ⏳ Create `earningsOverrides.ts` for top 50 stocks you care about
5. ⏳ Update overrides monthly

### **Short-term (Low Cost)**
1. Sign up for **Financial Modeling Prep** starter plan ($14/month)
2. Add FMP as secondary data source
3. Fall back to Finnhub if FMP fails
4. Test accuracy improvements

### **Long-term (Best Quality)**
1. Upgrade to institutional-grade data provider
2. Consider **Polygon.io**, **IEX Cloud**, or **Quandl**
3. Add data quality metrics to dashboard
4. Implement automated data validation

---

## 📝 Testing Checklist

When testing earnings dates:

- [ ] Compare with Yahoo Finance earnings calendar
- [ ] Check company's official IR page
- [ ] Verify date is in the future (not past)
- [ ] Confirm time (BMO vs AMC)
- [ ] Check if earnings date was recently updated
- [ ] Test multiple companies (tech, finance, retail, etc.)

---

## 🔗 Additional Resources

- **SEC EDGAR**: https://www.sec.gov/edgar/searchedgar/companysearch.html
- **Company 8-K Filings**: Official earnings announcements
- **Bloomberg Earnings Calendar**: (Requires terminal access)
- **FactSet**: Institutional-grade earnings data

---

## 💡 Pro Tip

**Most Reliable Method**: Visit the company's IR page directly:
1. Google: `{Company Name} investor relations`
2. Look for "Events & Presentations" or "Earnings Calendar"
3. Companies legally must announce earnings dates accurately

---

**Last Updated**: October 15, 2025  
**Earnings Data Source**: Finnhub Free Tier (limitations noted above)  
**Recommended Upgrade**: Financial Modeling Prep or similar premium provider
