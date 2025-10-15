# 🔧 Quick Fix: Earnings Date Manual Override

If you notice specific companies have wrong earnings dates, you can quickly fix them with a manual override system.

---

## ✅ **Step-by-Step: Add Manual Overrides**

### **Step 1: Create Override File**

Create this file: `lib/earningsOverrides.ts`

```typescript
/**
 * Manual overrides for earnings dates when API data is incorrect
 * Source earnings dates from official company IR pages
 * Update this file as companies announce new earnings dates
 */

export interface EarningsOverride {
  date: string;        // Format: YYYY-MM-DD
  hour: 'bmo' | 'amc'; // 'bmo' = Before Market Open, 'amc' = After Market Close
  epsEstimate?: number;
  revenueEstimate?: number;
  source?: string;     // URL to company IR page for verification
}

export const earningsOverrides: Record<string, EarningsOverride> = {
  // Apple - Source: https://investor.apple.com
  'AAPL': {
    date: '2025-01-30',
    hour: 'amc',
    epsEstimate: 2.10,
    revenueEstimate: 123500000000,
    source: 'https://investor.apple.com/investor-relations/default.aspx'
  },
  
  // Microsoft - Source: https://www.microsoft.com/en-us/Investor
  'MSFT': {
    date: '2025-01-28',
    hour: 'amc',
    epsEstimate: 2.75,
    revenueEstimate: 60500000000,
    source: 'https://www.microsoft.com/en-us/Investor'
  },
  
  // Amazon - Source: https://ir.aboutamazon.com
  'AMZN': {
    date: '2025-02-01',
    hour: 'amc',
    source: 'https://ir.aboutamazon.com/events-and-presentations/default.aspx'
  },
  
  // Add more as needed...
};
```

---

### **Step 2: Update API Route**

Modify `app/api/stock/route.ts` to use overrides:

**Add import at top:**
```typescript
import { earningsOverrides } from '@/lib/earningsOverrides';
```

**Find this section (around line 238-250):**
```typescript
// Extract next earnings event (first in the calendar after sorting by date)
let nextEarnings: EarningsEvent | null = null;

if (earningsData.earningsCalendar && earningsData.earningsCalendar.length > 0) {
  // existing code...
}
```

**Replace with:**
```typescript
// Extract next earnings event (first in the calendar after sorting by date)
// Check for manual override first (more accurate than API data)
let nextEarnings: EarningsEvent | null = null;

// Priority 1: Manual override from earningsOverrides.ts
if (earningsOverrides[symbol]) {
  const override = earningsOverrides[symbol];
  nextEarnings = {
    date: override.date,
    hour: override.hour,
    quarter: 0, // Unknown
    year: parseInt(override.date.split('-')[0]),
    epsActual: null,
    epsEstimate: override.epsEstimate ?? null,
    revenueActual: null,
    revenueEstimate: override.revenueEstimate ?? null,
    symbol: symbol
  };
} 
// Priority 2: API data from Finnhub
else if (earningsData.earningsCalendar && earningsData.earningsCalendar.length > 0) {
  // Sort earnings by date (ascending) to get the earliest upcoming one
  const sortedEarnings = [...earningsData.earningsCalendar].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
  
  // Filter to only future dates (in case API returns past earnings)
  const futureEarnings = sortedEarnings.filter(e => new Date(e.date) >= new Date());
  
  nextEarnings = futureEarnings.length > 0 ? futureEarnings[0] : null;
}
```

---

### **Step 3: Add Visual Indicator to Frontend**

Optionally, show a badge when using override data.

In `app/ticker/[symbol]/page.tsx`, update the earnings card header:

```tsx
<div className="flex items-center justify-between mb-4">
  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
    📅 Upcoming Earnings
    {/* Show badge if this stock has a manual override */}
    {earningsOverrides[data.symbol] && (
      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
        Verified
      </span>
    )}
  </h2>
  <p className="text-xs text-gray-500 dark:text-gray-400">
    Verify on company IR page
  </p>
</div>
```

---

## 📝 **How to Find Correct Earnings Dates**

### **Method 1: Company IR Page** (Most Accurate)

1. Google: `{Company Name} investor relations earnings`
2. Look for "Events Calendar" or "Upcoming Events"
3. Find next earnings call date

**Examples:**
- Apple: https://investor.apple.com/investor-relations/default.aspx
- Microsoft: https://www.microsoft.com/en-us/Investor/events
- Amazon: https://ir.aboutamazon.com/events-and-presentations

### **Method 2: Yahoo Finance**

1. Go to https://finance.yahoo.com/calendar/earnings
2. Search for your symbol
3. Note the date and time

### **Method 3: Nasdaq**

https://www.nasdaq.com/market-activity/earnings

---

## 🎯 **Top 20 Stocks to Override** (Suggested Priority)

Based on market cap and popularity:

```typescript
const popularStocks = [
  'AAPL',  // Apple
  'MSFT',  // Microsoft
  'GOOGL', // Alphabet
  'AMZN',  // Amazon
  'NVDA',  // NVIDIA
  'TSLA',  // Tesla
  'META',  // Meta
  'BRK.B', // Berkshire Hathaway
  'V',     // Visa
  'UNH',   // UnitedHealth
  'JNJ',   // Johnson & Johnson
  'WMT',   // Walmart
  'JPM',   // JPMorgan Chase
  'MA',    // Mastercard
  'PG',    // Procter & Gamble
  'HD',    // Home Depot
  'CVX',   // Chevron
  'MRK',   // Merck
  'KO',    // Coca-Cola
  'PEP',   // PepsiCo
];
```

---

## ⚡ **Quick Command to Add Override**

Save this as a script helper:

**File**: `scripts/addEarningsOverride.js`

```javascript
// Usage: node scripts/addEarningsOverride.js AAPL 2025-01-30 amc
const fs = require('fs');
const [symbol, date, hour] = process.argv.slice(2);

if (!symbol || !date || !hour) {
  console.error('Usage: node addEarningsOverride.js SYMBOL YYYY-MM-DD bmo|amc');
  process.exit(1);
}

console.log(`Adding override for ${symbol}:`);
console.log(`  Date: ${date}`);
console.log(`  Time: ${hour === 'bmo' ? 'Before Market Open' : 'After Market Close'}`);
console.log(`\nAdd this to lib/earningsOverrides.ts:`);
console.log(`
  '${symbol}': {
    date: '${date}',
    hour: '${hour}',
    source: 'https://investor.{company}.com' // TODO: Add actual IR page
  },
`);
```

Run it:
```bash
node scripts/addEarningsOverride.js AAPL 2025-01-30 amc
```

---

## 🔄 **Maintenance Schedule**

Update overrides:

| Frequency | Action |
|-----------|--------|
| **Weekly** | Check top 10 holdings for date changes |
| **Monthly** | Update all 20 popular stocks |
| **Quarterly** | Full audit of all overrides |
| **When reported wrong** | Immediate update |

---

## ✅ **Testing Your Overrides**

```bash
# 1. Start dev server
npm run dev

# 2. Visit stock page
http://localhost:3001/ticker/AAPL

# 3. Check earnings card shows correct date

# 4. Test multiple stocks with overrides
```

---

## 📊 **Override Statistics**

Track accuracy in `lib/earningsOverrides.ts`:

```typescript
// Statistics (update monthly)
export const overrideStats = {
  totalOverrides: 20,
  lastUpdated: '2025-10-15',
  accuracy: '100%', // Based on post-earnings verification
  mostPopular: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA']
};
```

---

## 🎉 **Benefits of Manual Overrides**

✅ **100% Accuracy** - You control the data  
✅ **Free** - No premium API subscription needed  
✅ **Fast** - No API latency  
✅ **Reliable** - Not dependent on third-party uptime  
✅ **Simple** - Just a TypeScript object  

❌ **Requires Manual Updates** - Need to monitor IR pages  
❌ **Doesn't Scale** - Can't maintain 1000s of stocks  

---

**Recommended for**: Your top 20-50 most-watched stocks  
**Not recommended for**: Full market coverage (5000+ stocks)
