# FactorFive architecture

How the app fetches data, why it is fast, and where the sharp edges are.

## The constraint everything else follows from

Finnhub's free tier allows **60 requests per rolling 60-second window**. This is
not documentation trivia — it is the single fact that shapes the entire backend.
It is also self-reported on every response, so the app reads it rather than
assuming it:

```
X-Ratelimit-Limit: 60
X-Ratelimit-Remaining: 48
X-Ratelimit-Reset: 1787376114
```

A fully cold symbol costs roughly **15 upstream calls** (7 for the symbol
itself, up to 8 peer fundamentals). So a single 60-call window can cold-fill
about four symbols. No amount of engineering changes that ceiling; what
engineering can do is make warm requests free, keep the essentials fast when
budget is tight, and be honest when data is thin.

## Request path

Every external call goes through `lib/upstream.ts`, in this order:

| Stage | What it does | Why |
|---|---|---|
| **Memo** | Returns a warm key immediately | Sits *in front of* the limiter so cache hits pay no rate-limit cost |
| **Single-flight** | Concurrent callers for the same key share one promise | Ten visitors on `/ticker/AAPL` produce one upstream fetch |
| **Rate window** | Paces requests to the real 60/min budget | With a priority split, below |
| **Retry** | Honours 429 / `Retry-After`, retries 5xx | A 429 is a real failure, not something to swallow |

The memo's position matters more than it looks. An earlier revision took a
rate-limit token *before* calling `fetch`, so a cached response queued exactly
as long as a network call. Five warm concurrent requests took ~5s while hitting
cache on every single call.

### Priority

The limiter has two queues.

- **High** — price, profile, fundamentals. The page cannot render without them.
- **Low** — peer metrics. Enrichment.

Low-priority work may not consume the last few requests of a window, and yields
to any high-priority work waiting. Without this, one visitor's eight peer
lookups sit ahead of the next visitor's price quote.

Peer calls also run with `retries: 0`. When budget is the scarce resource,
spending three requests re-asking for one peer is strictly worse than spending
them on three different peers — the benchmark needs a representative sample, not
any particular company.

### Deadlines

Nothing waits more than 9 seconds for budget, and peer enrichment gives up after
6. A caller that times out while queued **releases its slot without spending
budget**. Failing fast with a 503 and `Retry-After` beats a page that hangs,
especially since the CDN's `stale-while-revalidate` will usually serve the
previous response meanwhile.

## Caching

Three layers, each with a different job:

1. **In-process memo** — microseconds, per-instance, in front of the limiter.
2. **Next.js Data Cache** (`next: { revalidate }`) — shared across instances on
   Vercel, survives cold starts. This is the durability layer.
3. **CDN** (`Cache-Control: s-maxage=60, stale-while-revalidate=300`) — repeat
   viewers never invoke the function at all.

TTLs are set per resource by how fast the data actually moves, not uniformly:

| Resource | TTL | Rationale |
|---|---|---|
| `quote` | 30s | The only genuinely live value on the page |
| `company-news` | 15m | Headlines do not need second-level freshness |
| `metric` | 12h | Fundamentals update quarterly |
| `recommendation` | 12h | Analyst ratings move slowly |
| `profile2` | 7d | Name, logo, industry, share count |
| `peers` | 30d | Peer sets are effectively static |

### Scaling past one instance

The memo and the rate window are per-instance. That is sufficient on Vercel
because the Data Cache is shared and removes most upstream volume. If you ever
self-host behind a load balancer, or run enough concurrent instances that they
collectively exceed 60/min, move both to Redis:

- `RateWindow` becomes a Redis counter keyed by window
- the memo becomes a Redis `GET`/`SETEX`

`syncFromHeaders` already handles the multi-instance case correctly for free —
it only ever adopts `remaining` downward, so budget spent by another instance
is picked up automatically.

## Two bugs worth remembering

**`Number(null)` is `0`, not `NaN`.** Finnhub's premium endpoints answer a
free-tier key with a bare 403 carrying no rate-limit headers at all. Reading
them as `Number(headers.get(...))` produced a perfectly finite `0`, the limiter
concluded it had no budget and clamped shut, and every peer lookup then timed
out waiting for a window that was never exhausted. One request took **103
seconds** on a completely fresh quota. `numericHeader()` exists solely to make
this unrepresentable.

**Rate-limit headers are stale on arrival.** They describe the provider's state
when *it* handled that request, which says nothing about the other requests you
have already issued and are still awaiting. Fire forty at once and the first
response says "59 remaining" because only one had landed. Adopting that resets
your count upward and the window blows. The limiter therefore only ever believes
the header when it reports *less* budget than local accounting.

## Scoring

`lib/scoring.ts` produces five factors of 20 points each. Two properties matter
more than the formulas.

### Robust statistics

Benchmarks use **median and MAD with winsorized tails**, not mean and standard
deviation. Finnhub groups peers by SIC code, so Apple's peer list arrives as
disk-drive makers plus IONQ, a pre-revenue quantum computing firm. Under an
arithmetic mean that cohort reported a "Technology average" of **149% revenue
growth and −20% net margin**, against which Apple scored 3/20 on growth.

Peers are additionally filtered to a **market-cap cohort** — read from the
metric payload at no extra API cost — widening the band only when too few peers
qualify. Base-effect artefacts are clamped before scoring (Western Digital at
954% EPS growth, HPE at a P/E of 1399), and the displayed medians use the same
clamped values, so the numbers on screen are the numbers the score came from.

### Blended scoring

Each metric blends peer-relative (60%) and absolute-threshold (40%) views. A
pure peer-relative score is hostage to whatever cohort the provider returns; a
pure absolute score ignores that a 20% margin means different things in software
and grocery retail.

### Honest degradation

This is the important one. When peer data is missing the engine does **not**
invent a comparison. The previous version returned a z-score of 0, which the
sigmoid mapped to exactly half marks — so any rate-limited request silently
produced ~50/100 while the UI claimed a full industry analysis.

Now `dataQuality.benchmarksReliable` and `scoreBreakdown.confidence` carry that
information to the surface, and the UI renders it. `test-api-performance.js`
asserts on precisely this: thin data is acceptable, thin data claiming high
confidence is a test failure.

## Market context

`lib/marketContext.ts` adds the dimension the five factors lack — how the
company sits against the market it trades in. Built entirely from data already
fetched plus one cached SPY call:

- **Regime** — index trailing returns, volatility, drawdown from high
- **Relative strength** — excess return vs the S&P over 4/13/26/52 weeks
- **Risk** — beta, realised volatility, return per unit of volatility, drawdown
- **Scenario range** — a one-standard-deviation twelve-month band from realised
  volatility, labelled explicitly as a statistical range and **not a forecast**

### Known gap: macroeconomics

This is market and risk context, not macro. CPI, fed funds, the yield curve and
unemployment are not available on Finnhub's free tier. Adding
[FRED](https://fred.stlouisfed.org/docs/api/api_key.html) (free, one key) would
slot in behind `fetchMarketRegime()` cleanly and is the obvious next step.

Analyst price targets are similarly unavailable — `/stock/price-target` is
premium-only, so the Analyst factor's upside component always falls back to
neutral. The app records that 403 and stops re-asking for an hour rather than
spending a request per page view to be told "no" again.

## Market calendar

Every event is either **fetched from a source of record** or **computed from the
rule that defines it**. Nothing is estimated.

### Fetched: macro releases

`lib/fred.ts` pulls scheduled release dates from FRED, which publishes the
statistical agencies' own calendars including dates that have not happened yet.
A curated allowlist of 11 releases filters out the noise — FRED carries 331
releases, most of them daily series updates, and querying `releases/dates`
wholesale returns ~1,240 entries over 45 days.

`include_release_dates_with_no_data=true` is the parameter that surfaces future
dates; without it FRED returns only dates where data already exists, which makes
the endpoint useless for a forward calendar.

This replaced a rule-based generator, and the rules were wrong. Checked against
FRED for September 2026:

| Release | Rule predicted | Actual |
|---|---|---|
| CPI | Sep 14 | **Sep 11** |
| PPI | Sep 15 | **Sep 10** |
| Retail Sales | Sep 15 | **Sep 16** |
| Non-Farm Payrolls | Sep 4 | Sep 4 ✓ |

The PPI error is the instructive one: the rule assumed PPI always follows CPI,
and that month it precedes it. A convention that holds most months is not a
schedule.

### Computed: market structure

Holidays and options expirations are derived from the rule that *constitutes*
them — Martin Luther King Jr. Day **is** the third Monday in January; monthly
options expiration **is** the third Friday. These are definitions, not
predictions, so computing them is exact. Weekend observance follows the NYSE
rule (Saturday → preceding Friday, Sunday → following Monday), and Good Friday
uses the anonymous Gregorian Easter algorithm.

Quarterly expirations are labelled **triple** witching, not quadruple: the
fourth leg was single-stock futures, which stopped trading in the US when
OneChicago closed in 2020.

### Deliberately absent: FOMC

There is no free programmatic source for FOMC meeting dates. FRED's "FOMC Press
Release" (release 101) returns *consecutive daily dates* — an artifact of how
that series is tracked, not the meeting schedule. Rather than hardcode a list
that silently goes stale, FOMC is omitted entirely.

This is a real gap: FOMC is the highest-impact event on any market calendar. Two
ways to close it, both requiring a decision rather than a default:

- Maintain a short verified list from federalreserve.gov, stamped with a
  `verifiedOn` date and hidden automatically once it ages past its horizon.
- Take macro from a paid calendar feed that includes central-bank events.

### Dates are strings, not `Date`

`MarketEvent.date` is `YYYY-MM-DD`. `new Date('2026-09-11')` parses as UTC
midnight, which renders as September 10th for anyone west of Greenwich — the
most common way calendars go quietly wrong. Callers build a local-time `Date`
through `toLocalDate()` when they need one.

### Rendering

Events are fetched on the server (the FRED key must not reach the browser) and
passed to the client component as props, streaming behind a Suspense boundary so
the hero does not block on them. The component indexes events into a
`Map<'YYYY-MM-DD', MarketEvent[]>` once per event set; the previous version
filtered the whole array inside the grid map, a linear scan repeated 42 times
per render.

## Verifying

```bash
npm run build && npm start
```

Then, in a second terminal:

```bash
node test-api-performance.js --concurrency 5
```

The benchmark reports latency and classifies every response as `sound`,
`thin-flagged`, `DISHONEST` or `FAIL`. It exits non-zero only on `DISHONEST` or
`FAIL` — thin data on a constrained tier is expected; thin data presented
confidently is the bug.

Live limiter state is available at `/api/health`, which reports window
remaining, queue depth and memo size without exposing key values.
