# 🔍 Earnings Date Verification Guide

## 🚨 **Problem: Wrong Earnings Dates Being Displayed**

Your app is showing incorrect earnings dates because:

1. **Finnhub returns earnings in wrong order** (later dates first)
2. **Finnhub free tier may have outdated/estimated data**
3. **Need to verify the sorting logic is actually being applied**

---

## ✅ **How to Check What's Wrong**

### **Step 1: Visit the Debug Endpoint**

Once your Vercel deployment completes, visit:

```
https://your-app.vercel.app/api/debug-earnings?symbol=AAPL
```

Replace `AAPL` with any symbol you want to test.

**What it shows:**
- **Raw Data**: Exactly what Finnhub returns (unsorted)
- **After Sorting**: Data sorted by date (ascending)
- **After Filtering**: Only future dates
- **Selected**: The final earnings date your app will show

**Example output:**
```json
{
  "symbol": "AAPL",
  "rawData": {
    "earnings": [
      { "date": "2026-01-28", "daysFromNow": 104 },  // ❌ WRONG ORDER
      { "date": "2025-10-30", "daysFromNow": 14 }    // ✅ Should be first
    ]
  },
  "afterSorting": {
    "earnings": [
      { "date": "2025-10-30", "daysFromNow": 14 },   // ✅ CORRECT ORDER
      { "date": "2026-01-28", "daysFromNow": 104 }
    ]
  },
  "selected": {
    "date": "2025-10-30",  // ✅ This should be shown
    "quarter": "Q4 2025"
  }
}
```

---

### **Step 2: Test Locally with Scripts**

I've created two test scripts you can run locally:

#### **Test 1: Check Finnhub API Directly**

```bash
node test-earnings-api.js AAPL
```

**What it does:**
- Calls Finnhub API directly (bypasses your app)
- Shows raw response from Finnhub
- Validates dates (past vs future)
- Shows days until earnings

**Use this to:**
- Verify Finnhub has correct data
- See what order Finnhub returns data
- Check if dates are reasonable

#### **Test 2: Check Your App API**

```bash
# Make sure dev server is running first
npm run dev

# In another terminal:
node test-earnings-sorting.js AAPL
```

**What it does:**
- Calls your app's `/api/stock` endpoint
- Shows which earnings date your app selected
- Validates if it's the nearest upcoming date

**Use this to:**
- Verify your sorting logic is working
- Confirm the right date is being selected
- Test before deploying to Vercel

---

## 🔧 **Test Results from My Investigation**

### **Apple (AAPL)**

**Finnhub returns:**
1. 2026-01-28 (Q1 2026) - 104 days away ❌ **WRONG (too far)**
2. 2025-10-30 (Q4 2025) - 14 days away ✅ **CORRECT**

**After sorting:**
1. 2025-10-30 ✅ (should be selected)
2. 2026-01-28

**Expected behavior:** App should show **Oct 30, 2025**

### **Microsoft (MSFT)**

**Finnhub returns:**
1. 2026-01-27 (Q2 2026) - 103 days away ❌
2. 2025-10-29 (Q1 2026) - 13 days away ✅

**After sorting:**
1. 2025-10-29 ✅ (should be selected)
2. 2026-01-27

**Expected behavior:** App should show **Oct 29, 2025**

---

## 📊 **Verify Against Official Sources**

Always cross-check with these authoritative sources:

### **1. Yahoo Finance** (Most Reliable Free Source)
https://finance.yahoo.com/calendar/earnings

Search for your symbol → See confirmed earnings date

### **2. Company Investor Relations Pages**

| Company | IR Page |
|---------|---------|
| Apple | https://investor.apple.com/investor-relations |
| Microsoft | https://www.microsoft.com/en-us/Investor/events |
| Amazon | https://ir.aboutamazon.com/events-and-presentations |
| Google/Alphabet | https://abc.xyz/investor/ |
| Tesla | https://ir.tesla.com/ |
| NVIDIA | https://investor.nvidia.com/events-and-presentations |

**How to find any company:**
- Google: `{Company Name} investor relations`
- Look for "Events" or "Earnings Calendar"

### **3. Financial News Sites**

- **Nasdaq**: https://www.nasdaq.com/market-activity/earnings
- **MarketWatch**: https://www.marketwatch.com/tools/earnings
- **Seeking Alpha**: https://seekingalpha.com/earnings/earnings-calendar

---

## 🐛 **Troubleshooting**

### **Issue: Debug endpoint shows correct date, but app shows wrong date**

**Possible causes:**
1. Browser cache - Hard refresh (Ctrl+Shift+R)
2. Vercel still deploying old version - Wait 2-3 minutes
3. Different symbol being tested

**Fix:**
- Clear browser cache
- Check Vercel deployment status
- Test with multiple symbols

### **Issue: Debug endpoint shows WRONG date selected**

**Possible causes:**
1. Sorting logic not working
2. Date comparison issue (timezone?)
3. Finnhub returning only wrong dates

**Fix:**
- Check `afterSorting` section - is it actually sorted?
- Check `daysFromNow` - are they positive numbers?
- If Finnhub data is bad, use manual overrides (see EARNINGS_QUICK_FIX.md)

### **Issue: No earnings data at all**

**Possible causes:**
1. Company hasn't announced next earnings yet
2. Finnhub doesn't have data for this symbol
3. Earnings date is beyond 120-day range

**Fix:**
- Check Yahoo Finance - do they have a date?
- If yes, use manual override (EARNINGS_QUICK_FIX.md)
- If no, company probably hasn't announced yet

---

## 🎯 **Testing Checklist**

When investigating wrong earnings dates:

- [ ] Run `node test-earnings-api.js {SYMBOL}`
- [ ] Check raw Finnhub response
- [ ] Note the order of dates returned
- [ ] Visit debug endpoint: `/api/debug-earnings?symbol={SYMBOL}`
- [ ] Check "selected" date in debug response
- [ ] Compare with Yahoo Finance
- [ ] Compare with company IR page
- [ ] Test on actual app ticker page
- [ ] Hard refresh browser (Ctrl+Shift+R)

---

## 📝 **Quick Reference Commands**

```bash
# Test Finnhub API directly
node test-earnings-api.js AAPL
node test-earnings-api.js MSFT
node test-earnings-api.js TSLA

# Test your app API (dev server must be running)
npm run dev  # In one terminal
node test-earnings-sorting.js AAPL  # In another terminal

# Deploy to Vercel
git add .
git commit -m "fix: earnings date improvements"
git push origin master

# Visit debug endpoint after deployment
https://your-app.vercel.app/api/debug-earnings?symbol=AAPL
```

---

## 🔗 **Related Documentation**

- **EARNINGS_DATA_ACCURACY.md** - Why earnings data can be wrong
- **EARNINGS_QUICK_FIX.md** - How to add manual overrides
- **test-earnings-api.js** - Script to test Finnhub directly
- **test-earnings-sorting.js** - Script to test app API
- **app/api/debug-earnings/route.ts** - Debug endpoint code

---

## 💡 **Quick Wins**

### **If you need accurate dates NOW:**

1. **Use manual overrides** (see EARNINGS_QUICK_FIX.md)
   - Create `lib/earningsOverrides.ts`
   - Add correct dates from company IR pages
   - Override logic will use your data instead of Finnhub

2. **Upgrade to premium data**
   - Financial Modeling Prep: $14/month
   - More accurate and timely than Finnhub free tier

3. **Add verification link**
   - Already done: "Verify on company IR page" disclaimer
   - Users can double-check themselves

---

## 🎯 **Expected Timeline for Fixes**

| Fix Type | Time to Implement | Accuracy Improvement |
|----------|-------------------|---------------------|
| **Debug & Verify** | 10 minutes | Identifies problem |
| **Manual Overrides (Top 20 stocks)** | 1 hour | 100% for overridden stocks |
| **Premium Data API** | 2 hours | 95-99% for all stocks |
| **Web Scraping** | 1 week | 100% but high maintenance |

---

## ✅ **Next Steps**

1. **Deploy latest changes** (already pushed to GitHub)
2. **Wait for Vercel to redeploy** (2-3 minutes)
3. **Visit debug endpoint**: `https://your-app.vercel.app/api/debug-earnings?symbol=AAPL`
4. **Share the JSON output** with me so I can see exactly what's happening
5. **Based on results**, we'll either:
   - Fix the sorting logic (if it's not working)
   - Add manual overrides (if Finnhub data is bad)
   - Upgrade to premium data (if you want accurate data for all stocks)

---

**Test the debug endpoint and share the results - I'll help you fix the specific issue!** 🚀
