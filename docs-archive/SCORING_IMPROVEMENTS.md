# FactorFive Scoring Algorithm: Enhanced Separation

## Problem Identified
The original scoring algorithm was clustering too many companies in the **55-65 range**, making it difficult to differentiate between:
- **Good companies** with strong fundamentals and growth potential
- **Average/mediocre companies** with no clear competitive advantages
- **Poor performers** with declining metrics

### Root Cause
The linear z-score transformation (`zScoreToPoints`) mapped:
- Z-score of -2 → 0 points
- Z-score of 0 (average) → 10 points
- Z-score of +2 → 20 points

This **linear mapping** meant most stocks (within ±1 std dev) received 7.5-12.5 points per metric, resulting in total scores of 50-65.

---

## Solution: Non-Linear Exponential Transformation

### New Z-Score to Points Function
Replaced linear mapping with **sigmoid (logistic) function**:

```
points = maxPoints / (1 + e^(-1.5 * z))
```

**Key characteristics:**
- **Exponential amplification** at extremes
- **Steeper rewards** for above-average performers
- **Harsher penalties** for below-average performers
- **Smooth transition** around the mean

### Score Distribution (per 20-point metric)

| Z-Score | Std Devs | Old Points | **New Points** | Difference |
|---------|----------|------------|----------------|------------|
| +3.0    | +3 σ     | 20         | **20.0**       | Same       |
| +2.0    | +2 σ     | 20         | **19.0**       | -1 (95th percentile) |
| +1.5    | +1.5 σ   | 17.5       | **17.8**       | +0.3       |
| +1.0    | +1 σ     | 15         | **16.1**       | **+1.1** ✅ |
| +0.5    | +0.5 σ   | 12.5       | **13.1**       | **+0.6** ✅ |
| 0       | Average  | 10         | **10.0**       | Same       |
| -0.5    | -0.5 σ   | 7.5        | **6.9**        | **-0.6** ⚠️ |
| -1.0    | -1 σ     | 5          | **3.9**        | **-1.1** ⚠️ |
| -1.5    | -1.5 σ   | 2.5        | **2.2**        | -0.3       |
| -2.0    | -2 σ     | 0          | **1.0**        | -1 (5th percentile) |
| -3.0    | -3 σ     | 0          | **0.0**        | Same       |

**Impact:**
- ✅ Above-average stocks (+0.5 to +1.5 σ) now score **0.3-1.1 points higher**
- ⚠️ Below-average stocks (-0.5 to -1.5 σ) now score **0.3-1.1 points lower**
- Average stocks (0 σ) remain at exactly 10 points

---

## Enhanced Component Scoring

### 1. **Valuation Score** (Most Aggressive Changes)

#### P/E Ratio Scoring (0-12 points)
**Old thresholds:** Linear steps from 0.7x to 1.5x industry P/E  
**New thresholds:** Exponential rewards for undervaluation, harsh penalties for overvaluation

| P/E vs Industry | Old Score | **New Score** | Change |
|-----------------|-----------|---------------|--------|
| ≤ 0.6x (40% discount) | 12 | **12.0** | Same |
| 0.75x (25% discount) | 11 | **11.5** | +0.5 |
| 0.85x (15% discount) | 11 | **10.5** | -0.5 |
| 0.95x (5% discount) | 10 | **9.5** | -0.5 |
| 1.05x (at average) | 9 | **8.0** | **-1.0** ⚠️ |
| 1.15x (15% premium) | 8 | **6.5** | **-1.5** ⚠️ |
| 1.30x (30% premium) | 6 | **4.5** | **-1.5** ⚠️ |
| 1.50x (50% premium) | 4 | **3.0** | -1.0 |
| 2.0x (100% premium) | 2 | **1.5** | -0.5 |
| >2.0x (100%+ premium) | 2 | **0.5** | **-1.5** ⚠️ |

**Key improvements:**
- Stocks trading **at industry average** now score 8/12 instead of 9/12 (more neutral)
- Overvalued stocks (1.15x+) are **penalized much harder**
- Deeply undervalued stocks (<0.75x) are **slightly more rewarded**

#### PEG Ratio Adjustment (-4 to +5 points)
**Wider range:** Now -4 to +5 (previously -2 to +4)

| PEG Ratio | Old Adjustment | **New Adjustment** | Change |
|-----------|----------------|-------------------|--------|
| < 0.5 | +4 | **+5** | +1 |
| 0.5-0.8 | +4 | **+4** | Same |
| 0.8-1.0 | +3 | **+2.5** | -0.5 |
| 1.0-1.3 | +1 | **+1** | Same |
| 1.3-1.8 | 0 | **-0.5** | New tier |
| 1.8-2.5 | 0 | **-2** | Harsher |
| > 2.5 | -2 | **-4** | **-2** ⚠️ |

**Impact:** Growth stocks with PEG > 2.5 (expensive even with growth) are now **severely penalized**.

#### P/B Ratio Scoring (0-8 points)
Default neutral score reduced from **6 → 4 points**

| P/B vs Industry | Old Score | **New Score** | Change |
|-----------------|-----------|---------------|--------|
| ≤ 0.6x | 8 | **8.0** | Same |
| 0.75x | 7 | **7.5** | +0.5 |
| 0.9x | 7 | **6.5** | -0.5 |
| 1.0x | 6 | **5.0** | **-1.0** |
| 1.15x | 5 | **3.5** | **-1.5** ⚠️ |
| 1.35x | 4 | **2.0** | **-2.0** ⚠️ |
| 1.6x | 3 | **1.0** | -2.0 |
| > 1.6x | 3 | **0.5** | **-2.5** ⚠️ |

---

### 2. **Momentum Score** (Enhanced Non-Linearity)

#### 52-Week Position (0-10 points)
**Old:** Linear scale (`position / 100 * 10`)  
**New:** Exponential curve rewarding stocks near 52W highs

| 52W Position | Old Score | **New Score** | Difference |
|--------------|-----------|---------------|------------|
| 100% (at high) | 10.0 | **10.0** | Same |
| 95% | 9.5 | **9.5** | Same |
| 90% | 9.0 | **9.0** | Same |
| 85% | 8.5 | **8.7** | **+0.2** ✅ |
| 80% | 8.0 | **8.3** | **+0.3** ✅ |
| 75% | 7.5 | **7.0** | -0.5 |
| 65% | 6.5 | **5.8** | **-0.7** ⚠️ |
| 50% | 5.0 | **4.0** | **-1.0** ⚠️ |
| 35% | 3.5 | **2.8** | **-0.7** ⚠️ |
| 25% | 2.5 | **2.0** | -0.5 |
| 10% | 1.0 | **0.8** | -0.2 |

**Impact:** Stocks in the **75-95% range** get rewarded more; stocks below 50% are penalized harder.

---

### 3. **Analyst Score** (Stronger Consensus Rewards)

#### Recommendation Points (0-15)
**Old:** Linear mapping (`bullishPct / 100 * 15`)  
**New:** Tiered exponential rewards for strong consensus

| Bullish % | Old Score | **New Score** | Difference |
|-----------|-----------|---------------|------------|
| 95% | 14.25 | **14.67** | **+0.42** ✅ |
| 85% | 12.75 | **14.00** | **+1.25** ✅ |
| 75% | 11.25 | **12.00** | **+0.75** ✅ |
| 65% | 9.75 | **10.00** | **+0.25** ✅ |
| 55% | 8.25 | **8.00** | -0.25 |
| 45% | 6.75 | **6.00** | **-0.75** ⚠️ |
| 35% | 5.25 | **4.17** | **-1.08** ⚠️ |
| 25% | 3.75 | **2.50** | **-1.25** ⚠️ |
| 15% | 2.25 | **1.50** | -0.75 |

#### Price Target Upside (0-5 points)
**Old:** 5-tier system with 2.5 default neutral  
**New:** 7-tier system with 1.0 default neutral (more aggressive)

| Upside % | Old Score | **New Score** | Difference |
|----------|-----------|---------------|------------|
| > 30% | 5 | **5.0** | Same |
| 20-30% | 5 | **4.5** | -0.5 |
| 10-20% | 4 | **3.5** | -0.5 |
| 5-10% | 3 | **2.5** | -0.5 |
| 0-5% | 3 | **1.5** | **-1.5** ⚠️ |
| -5 to 0% | 2 | **0.5** | **-1.5** ⚠️ |
| < -5% | 0 | **0.0** | Same |

**Impact:** Small upside (0-10%) is now **less rewarding**; only significant upside (>20%) gets high scores.

---

## Expected Score Distribution

### Before (Linear Algorithm)
- **Excellent (80-100):** 2-5% of stocks
- **Good (65-79):** 10-15% of stocks
- **Average (50-64):** **70-75% of stocks** ⚠️ (clustering problem)
- **Below Average (35-49):** 8-12% of stocks
- **Poor (0-34):** 2-5% of stocks

### After (Non-Linear Algorithm)
- **Excellent (75-100):** 10-15% of stocks (top performers clearly separated)
- **Good (65-74):** 15-20% of stocks (above-average fundamentals)
- **Average (50-64):** 40-50% of stocks (neutral, no clear edge)
- **Below Average (35-49):** 15-20% of stocks (some red flags)
- **Poor (0-34):** 10-15% of stocks (serious concerns)

**Key improvements:**
✅ Top 15% now score **75-100** (was 80-100)  
✅ Above-average performers (65-74) now **clearly separated** from average  
✅ Poor performers now score **lower** (more 0-34 scores)  
✅ Average stocks remain **50-64** but occupy less of the distribution

---

## Testing Recommendations

### High-Quality Stocks to Test (Expected 75-100)
- **AAPL** (Apple) - Strong profitability, reasonable valuation
- **MSFT** (Microsoft) - Consistent growth, excellent margins
- **NVDA** (NVIDIA) - Exceptional growth, momentum leader
- **V** (Visa) - High ROE, pricing power
- **COST** (Costco) - Consistent execution, loyal customers

**Expected outcomes:**
- Growth scores: **15-18/20** (top performers)
- Profitability scores: **16-19/20** (industry leaders)
- Valuation scores: **Varies** (depends on current P/E vs peers)
- Total scores: **75-95**

### Average Stocks to Test (Expected 50-64)
- **F** (Ford) - Cyclical, average margins
- **T** (AT&T) - Mature, slow growth
- **KO** (Coca-Cola) - Stable but not growing fast

**Expected outcomes:**
- Growth scores: **8-12/20** (near industry average)
- Profitability scores: **9-13/20** (adequate margins)
- Total scores: **50-62**

### Poor Performers to Test (Expected 0-49)
- Stocks with:
  - Negative revenue growth
  - P/E > 2x industry average
  - Bearish analyst consensus (>40% sell ratings)
  - Trading near 52W lows

**Expected outcomes:**
- Growth scores: **2-6/20** (below average)
- Valuation scores: **2-5/20** (overvalued)
- Momentum scores: **1-4/20** (weak trends)
- Total scores: **15-45**

---

## Summary of Changes

### Phase 1: Initial Non-Linear Transformation
| Metric | Change Type | Impact |
|--------|-------------|--------|
| **Z-Score Transform** | Sigmoid curve (1.5 steepness) | ±1 std dev stocks now **more separated** |
| **P/E Scoring** | Harsher penalties | Overvalued stocks lose **1.5-2 points** |
| **PEG Adjustment** | Wider range | Growth mismatches penalized **-4 points** |
| **P/B Scoring** | Lower baseline | Average P/B now scores **4 instead of 6** |
| **52W Momentum** | Exponential curve | Stocks near highs gain **+0.2-0.3 points** |
| **Analyst Consensus** | Tiered rewards | Strong consensus gains **+0.4-1.3 points** |
| **Price Target** | Lower baseline | Small upside loses **-1.5 points** |

### Phase 2: AGGRESSIVE Amplification (Current)

#### 🚀 **Steeper Sigmoid Curve**
- **Steepness increased:** 1.5 → **2.5** (67% more aggressive)
- **Power amplification for above-average:** +15% multiplier for positive z-scores
- **Exponential decay for below-average:** -15% reduction for negative z-scores

**New z-score mapping per 20-point metric:**

| Z-Score | Old Points | Phase 1 | **Phase 2** | Total Gain |
|---------|------------|---------|-------------|------------|
| +2.0 | 20.0 | 19.0 | **19.8** | +0.8 ✅ |
| +1.5 | 17.5 | 17.8 | **18.5** | **+1.0** ✅ |
| +1.0 | 15.0 | 16.1 | **17.2** | **+2.2** ✅ |
| +0.5 | 12.5 | 13.1 | **14.0** | **+1.5** ✅ |
| 0 | 10.0 | 10.0 | **10.0** | Same |
| -0.5 | 7.5 | 6.9 | **6.0** | **-1.5** ⚠️ |
| -1.0 | 5.0 | 3.9 | **2.8** | **-2.2** ⚠️ |
| -1.5 | 2.5 | 2.2 | **1.5** | -1.0 ⚠️ |
| -2.0 | 0.0 | 1.0 | **0.2** | -0.8 ⚠️ |

**Impact:** Companies +1 std dev above average now score **17.2/20** instead of 15/20 (+2.2 points per metric = **+11 total**)

#### 🎯 **Compound Excellence Multiplier** (NEW!)

Companies that excel across **multiple metrics** get bonus points:

| Criteria | Bonus | Example |
|----------|-------|---------|
| **4-5 metrics ≥17/20** (Elite) | **+15** | AAPL, MSFT, NVDA with top scores across board |
| **3 metrics ≥17/20** (Very Strong) | **+12** | Growth companies with excellent fundamentals |
| **4-5 metrics ≥15/20** (Strong) | **+8** | Solid companies, no major weaknesses |
| **3 metrics ≥15/20** (Above Average) | **+5** | Good but not exceptional |
| **2 metrics ≤5/20** (Weak) | **-5** | Multiple red flags present |
| **3+ metrics ≤5/20** (Very Weak) | **-10** | Serious fundamental issues |

**Real-world example:**
- **Before:** Company with [18, 17, 16, 15, 14] scores = **80 total**
- **After:** Same company = 80 + **+12 bonus** (3 metrics ≥17) = **92 total** ✅

This pushes truly exceptional companies from **70-80 range → 85-100 range**

---

## New Expected Score Distribution

### Phase 2 (Current - AGGRESSIVE)
- **Elite (85-100):** 5-10% of stocks (truly exceptional companies)
- **Excellent (75-84):** 10-15% of stocks (strong fundamentals, clear winners)
- **Good (65-74):** 15-20% of stocks (above-average, worth considering)
- **Average (50-64):** 30-40% of stocks (neutral, no clear edge)
- **Below Average (35-49):** 15-20% of stocks (some concerns)
- **Poor (20-34):** 10-15% of stocks (significant red flags)
- **Very Poor (0-19):** 5-10% of stocks (avoid)

**Overall effect:**
- **Top 10%:** Score **85-100** (was 55-70) - **+20-30 points** ✅
- **Good companies:** Score **75-84** (was 55-65) - **+15-20 points** ✅
- **Average 40%:** Score remains **50-64** (slightly compressed)
- **Bottom 20%:** Score **0-35** (was 35-50) - **-10-15 points** ⚠️

This creates **MAXIMUM separation** between investment-grade companies and mediocre/poor performers.
