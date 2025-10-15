# Number Formatting Examples

This document shows how different values will be displayed with the new dynamic formatting system.

## Market Cap Examples

### Large Cap Companies (Billions)
| Company | Raw Value (Millions) | Old Display | New Display |
|---------|---------------------|-------------|-------------|
| Apple | 2,500,000 | $2,500,000,000M | **$2.50T** |
| Microsoft | 2,300,000 | $2,300,000,000M | **$2.30T** |
| Amazon | 1,500,000 | $1,500,000,000M | **$1.50T** |
| Google | 1,800,000 | $1,800,000,000M | **$1.80T** |
| Tesla | 700,000 | $700,000,000M | **$700.00B** |

### Mid Cap Companies (Billions)
| Company | Raw Value (Millions) | Old Display | New Display |
|---------|---------------------|-------------|-------------|
| Spotify | 50,000 | $50,000,000M | **$50.00B** |
| Robinhood | 15,000 | $15,000,000M | **$15.00B** |
| DoorDash | 45,000 | $45,000,000M | **$45.00B** |

### Small Cap Companies (Millions)
| Company | Raw Value (Millions) | Old Display | New Display |
|---------|---------------------|-------------|-------------|
| Small Tech | 850 | $850,000M | **$850.00M** |
| Startup | 120 | $120,000M | **$120.00M** |
| Micro Cap | 45 | $45,000M | **$45.00M** |

---

## Revenue Examples (Earnings)

Revenue comes in actual dollar values from Finnhub API.

### Large Companies (Billions)
| Company | Raw Value | Old Display | New Display |
|---------|-----------|-------------|-------------|
| Apple | $394,328,000,000 | $394,328.00M | **$394.33B** |
| Amazon | $574,785,000,000 | $574,785.00M | **$574.79B** |
| Microsoft | $211,915,000,000 | $211,915.00M | **$211.92B** |
| Google | $307,394,000,000 | $307,394.00M | **$307.39B** |

### Mid-Size Companies (Billions)
| Company | Raw Value | Old Display | New Display |
|---------|-----------|-------------|-------------|
| Netflix | $33,723,000,000 | $33,723.00M | **$33.72B** |
| Spotify | $13,247,000,000 | $13,247.00M | **$13.25B** |

### Smaller Companies (Millions)
| Company | Raw Value | Old Display | New Display |
|---------|-----------|-------------|-------------|
| Small SaaS | $450,000,000 | $450.00M | **$450.00M** |
| Startup | $85,000,000 | $85.00M | **$85.00M** |

---

## Key Improvements

### 1. **Automatic Scaling**
- Values >= $1B automatically use "B" suffix
- Values >= $1M use "M" suffix
- No need to manually check thresholds

### 2. **Readability**
```
Before: $2,500,000,000M  (confusing - 2.5B millions?)
After:  $2.50T           (clear - 2.5 trillion)
```

### 3. **Consistency**
All large numbers throughout the app use the same formatting logic from `lib/formatters.ts`

### 4. **Precision Control**
Default 2 decimal places, adjustable per use case:
```typescript
formatMarketCap(2500000)     // "$2.50T"
formatMarketCap(2500000, 1)  // "$2.5T"
formatMarketCap(2500000, 0)  // "$3T"
```

---

## Testing Recommendations

Test with these tickers to see the formatting in action:

| Ticker | Market Cap Range | Expected Display |
|--------|-----------------|------------------|
| **AAPL** | ~$2.5T | Shows in Trillions (T) |
| **MSFT** | ~$2.3T | Shows in Trillions (T) |
| **TSLA** | ~$700B | Shows in Billions (B) |
| **GME** | ~$10B | Shows in Billions (B) |
| **AMC** | ~$1B | Shows in Billions (B) |
| **Small cap** | <$1B | Shows in Millions (M) |

Revenue estimates should also auto-format based on company size!

---

## Technical Implementation

### Functions Available

```typescript
// From lib/formatters.ts

// Format any large number
formatLargeNumber(1500000000, 2) // "1.50B"

// Format as currency
formatCurrency(1500000000, 2) // "$1.50B"

// Format market cap (Finnhub format - value in millions)
formatMarketCap(2500000, 2) // "$2.50T" (converts 2.5M millions to 2.5T)
```

### Edge Cases Handled

- **Trillions**: 1,000,000,000,000+ → "T"
- **Billions**: 1,000,000,000+ → "B"
- **Millions**: 1,000,000+ → "M"
- **Thousands**: 1,000+ → "K"
- **Small values**: <1,000 → Raw number

---

## Before/After Comparison

### Apple (AAPL)
```
Before:
Market Cap: $2,500,000,000M
Revenue Estimate: $394,328.00M

After:
Market Cap: $2.50T
Revenue Estimate: $394.33B
```

### Amazon (AMZN)
```
Before:
Market Cap: $1,500,000,000M
Revenue Estimate: $574,785.00M

After:
Market Cap: $1.50T
Revenue Estimate: $574.79B
```

### Small Cap Company
```
Before:
Market Cap: $850,000M
Revenue Estimate: $450.00M

After:
Market Cap: $850.00M  ✅ (Stays in millions)
Revenue Estimate: $450.00M  ✅ (Stays in millions)
```

The system intelligently chooses the most readable format based on the actual size of the number!
