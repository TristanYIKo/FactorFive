# FactorFive Branding & Features

## Name Change: "Stock Score" → "FactorFive"

The application has been rebranded from "Stock Score" to **FactorFive** to better reflect its intelligent 5-factor scoring methodology.

---

## Why "FactorFive"?

### The Five Factors
The scoring engine analyzes stocks across **5 distinct dimensions**:

1. **📈 Growth** - Revenue & EPS growth vs peers (0-20 points)
2. **💰 Profitability** - ROE, margins, efficiency (0-20 points)
3. **💎 Valuation** - P/E, P/B ratios vs industry (0-20 points)
4. **🚀 Momentum** - Price trends & analyst targets (0-20 points)
5. **👔 Analyst** - Professional recommendations (0-20 points)

**Total: 100 points** (5 factors × 20 points each)

### Brand Identity
- **Memorable**: Short, catchy name
- **Descriptive**: Clearly references the 5-factor methodology
- **Professional**: Sounds like a serious financial analysis tool
- **Unique**: Distinguishes from generic "stock score" apps

---

## User-Facing Changes

### Home Page
- **Title**: "FactorFive" (previously "Stock Score")
- **Subtitle**: "The intelligent 5-factor stock analysis engine"
- **Description**: Emphasizes the multi-factor approach

### Ticker Detail Page
- **Panel Title**: "FactorFive Analysis" (previously "Stock Score Analysis")
- **Comments**: Updated to reference "FactorFive Score"
- **All 5 factors clearly labeled** with color-coded cards

### Score Display
The score breakdown prominently shows all 5 factors:
```
Growth: 16/20 (📈 Blue)
Profitability: 14/20 (💰 Green)
Valuation: 12/20 (💎 Purple)
Momentum: 15/20 (🚀 Orange)
Analyst: 17/20 (👔 Indigo)
─────────────────────
Total: 74/100
```

---

## New Feature: Recommended Ticker Dropdown

### Overview
When users type in the ticker input field, a smart dropdown appears showing **popular and related tickers** they can click to analyze.

### Key Features

#### 🎯 Curated Selections
Tickers are organized by category:
- **Mega Cap Tech**: AAPL, MSFT, GOOGL, AMZN, NVDA, META
- **EV & Auto**: TSLA, F, GM, RIVN
- **Finance**: JPM, BAC, GS, V, MA
- **Healthcare**: JNJ, UNH, PFE, MRNA
- **Entertainment**: DIS, NFLX, SPOT
- **Semiconductors**: AMD, INTC, TSM, QCOM
- **Retail**: WMT, TGT, COST, HD
- **Energy**: XOM, CVX, BP

#### 🔍 Smart Filtering
- **Type "A"** → Shows AAPL, AMZN, AMD, etc.
- **Type "TS"** → Shows TSLA, TSM
- **Type "N"** → Shows NVDA, NFLX, etc.

#### 📊 Limited Results
- **Maximum 8 suggestions** shown at once (not overwhelming)
- Only shows **relevant matches** based on input
- Empty input = no dropdown (clean interface)

#### 🎨 Beautiful UI
- **Category tags** show which sector each ticker belongs to
- **Hover effects** for easy selection
- **Click to navigate** directly to ticker analysis
- **Dropdown auto-closes** when clicking outside

#### ⚡ UX Optimizations
- Appears **instantly** as you type (no API delay)
- **Keyboard accessible** (can press Enter to submit any ticker)
- **Mobile-friendly** responsive design
- **Dark mode support** matches app theme

---

## Usage Examples

### Example 1: Type "AA"
```
Dropdown shows:
┌──────────────────────────┐
│ AAPL    [Mega Cap Tech] │
│ AAL     [Airlines]       │  (if added)
└──────────────────────────┘
Click on AAPL → Navigate to /ticker/AAPL
```

### Example 2: Type "NVDA"
```
Exact match:
┌──────────────────────────────┐
│ NVDA    [Semiconductors]    │
└──────────────────────────────┘
Press Enter OR Click → Analyze NVDA
```

### Example 3: Type "RANDOM123"
```
No matches found → No dropdown
Press Enter → Submit form → Try to fetch RANDOM123
(Will show error if ticker doesn't exist)
```

---

## Technical Implementation

### Frontend (`app/page.tsx`)

#### State Management
```typescript
const [ticker, setTicker] = useState('');
const [showDropdown, setShowDropdown] = useState(false);
const [filteredTickers, setFilteredTickers] = useState<Array<...>>([]);
```

#### Filtering Logic
```typescript
useEffect(() => {
  const input = ticker.toUpperCase();
  const matches = [];
  
  Object.entries(RECOMMENDED_TICKERS).forEach(([category, symbols]) => {
    symbols.forEach((symbol) => {
      if (symbol.startsWith(input) || symbol.includes(input)) {
        matches.push({ symbol, category });
      }
    });
  });
  
  setFilteredTickers(matches.slice(0, 8)); // Limit to 8
}, [ticker]);
```

#### Click-Outside Detection
```typescript
useEffect(() => {
  const handleClickOutside = (event) => {
    if (!dropdownRef.current?.contains(event.target) && 
        !inputRef.current?.contains(event.target)) {
      setShowDropdown(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

#### Dropdown UI
```tsx
<div className="absolute z-10 w-full mt-2 bg-white ... rounded-xl shadow-2xl">
  {filteredTickers.map(({ symbol, category }) => (
    <button onClick={() => handleTickerSelect(symbol)}>
      <span>{symbol}</span>
      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
        {category}
      </span>
    </button>
  ))}
</div>
```

---

## Benefits

### For Users
✅ **Faster navigation** - No need to remember exact ticker symbols  
✅ **Discovery** - Find related stocks in the same sector  
✅ **Confidence** - Only suggests real, popular tickers  
✅ **No clutter** - Limited to 8 results, won't overwhelm  

### For Developers
✅ **No API calls** - All suggestions are client-side (fast & free)  
✅ **Easy to maintain** - Simple array of curated tickers  
✅ **Extensible** - Easy to add more categories or tickers  
✅ **Type-safe** - Full TypeScript support  

---

## Future Enhancements

### Potential Additions
1. **Sector Logos/Icons** - Visual indicators for each category
2. **Market Data Preview** - Show current price in dropdown
3. **Trending Badge** - Highlight hot stocks (e.g., "🔥 NVDA")
4. **Recent Searches** - Remember user's last 5 analyzed tickers
5. **Favorites** - Let users save tickers for quick access
6. **Search by Company Name** - "Apple" → Suggests AAPL
7. **ETFs Section** - Add popular ETFs (SPY, QQQ, etc.)
8. **International Stocks** - Add non-US tickers by region

### Advanced Features
- **API Integration**: Fetch real-time suggestions from Finnhub symbol search
- **Fuzzy Matching**: Allow typos (e.g., "APPEL" → suggests AAPL)
- **Keyboard Navigation**: Arrow keys to select dropdown items
- **Voice Input**: "Analyze Tesla" → Navigate to TSLA

---

## Branding Consistency Checklist

✅ Home page title changed to "FactorFive"  
✅ Home page subtitle emphasizes 5-factor methodology  
✅ Ticker page panel title changed to "FactorFive Analysis"  
✅ Comments updated with "FactorFive" references  
✅ All 5 factors visually distinct and labeled  
✅ Recommended ticker dropdown implemented  
✅ Curated ticker list (not too many, just popular/relevant)  
✅ Category tags for context  

### Still Uses "Stock Score" Internally
⚠️ Variable names (`stockScore`) remain for backward compatibility  
⚠️ Type definitions still reference `stockScore: number`  
⚠️ API response field: `stockScore` (doesn't need to change)  

**Why keep internal names?**
- Avoid breaking existing API contracts
- Maintain consistency with Finnhub terminology
- Easier for developers to understand data flow
- User never sees these internal names

---

## Conclusion

**FactorFive** is now a cohesive brand that clearly communicates the app's value proposition: **intelligent, multi-dimensional stock analysis using 5 key factors**.

The recommended ticker dropdown enhances UX by making it **easy to discover and analyze popular stocks** without needing to memorize ticker symbols.

Together, these changes transform the app from a generic "stock score" tool into a **professional-grade, user-friendly financial analysis platform**.
