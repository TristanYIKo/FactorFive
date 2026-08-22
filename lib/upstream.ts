/**
 * Shared upstream HTTP layer.
 *
 * Every external API call in the app goes through here. It exists to solve the
 * problem that made FactorFive single-user: a single page view fanned out to
 * ~27 Finnhub calls against a budget of 60 per minute, so a second concurrent
 * visitor exhausted the window. The provider returned 429s which the old code
 * silently swallowed, producing scores with no peer data behind them.
 *
 * Four mechanisms, in the order a request meets them:
 *
 *   1. Memo          - a warm key returns immediately, paying no rate-limit
 *                      cost at all. Sits deliberately in front of the limiter.
 *   2. Single-flight - concurrent callers asking for the same URL share one
 *                      in-flight promise instead of each issuing a request.
 *   3. Rate window   - paces requests to the provider's real published budget,
 *                      with a priority split so page-critical data never
 *                      queues behind enrichment.
 *   4. Retry         - honours 429 / Retry-After and retries 5xx with backoff.
 *
 * Responses are cached by Next's Data Cache via `next: { revalidate }`, which
 * on Vercel is shared across instances and survives cold starts. The rate
 * window and single-flight map are per-instance; that is sufficient because
 * caching removes most upstream volume, but see docs/ARCHITECTURE.md for the Redis
 * upgrade path if you ever self-host behind a load balancer.
 */

/** Enrichment waits for essentials, never the reverse. */
export type Priority = 'high' | 'low';

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

/**
 * Window-aware rate limiter.
 *
 * Finnhub does not throttle per second - it allows a fixed number of requests
 * per rolling window and tells you exactly where you stand on every response:
 *
 *   X-Ratelimit-Limit: 60
 *   X-Ratelimit-Remaining: 48
 *   X-Ratelimit-Reset: <unix seconds>
 *
 * So this models that directly instead of approximating it with a refill rate.
 * Two earlier attempts got this wrong in instructive ways. A 15/sec token
 * bucket was fifteen times over budget and exhausted the window under load. A
 * 1/sec bucket respected the average but never learned that the window RESETS -
 * it kept trickling at 1/sec while the real quota had already refreshed to 60,
 * which made things slower still.
 *
 * Two further properties matter:
 *
 *   RESERVE - low-priority work (peer enrichment) may not consume the last
 *   `RESERVE` requests of a window. That budget is held for the data a page
 *   cannot render without, so one visitor's peer lookups can never starve
 *   another visitor's price quote.
 *
 *   DEADLINES - a caller can pass a deadline. If the window has not reopened by
 *   then it gives up WITHOUT consuming budget. Previously an abandoned peer
 *   request stayed queued and still spent a request nobody was waiting for.
 */

interface Waiter {
  resolve: (granted: boolean) => void;
  priority: Priority;
  deadlineAt?: number;
}

/**
 * Read a numeric header, returning null when it is absent or unparseable.
 *
 * Written out rather than inlined as `Number(headers.get(...))` because that
 * form is a trap: `Number(null)` is 0, not NaN, so a MISSING header sails
 * through `Number.isFinite()` and reads as a legitimate zero.
 *
 * That exact bug stalled the whole app. Finnhub's premium endpoints - notably
 * /stock/price-target - answer a free-tier key with a bare 403 carrying no
 * rate-limit headers whatsoever. The limiter read that as "0 requests
 * remaining", clamped itself shut, and every peer lookup then timed out
 * waiting for a window that was never actually exhausted. One request took
 * 103 seconds and returned no peers, on a completely fresh quota.
 */
function numericHeader(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

class RateWindow {
  private limit: number;
  private remaining: number;
  private resetAt: number;
  private queue: Waiter[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    limit: number,
    private readonly windowMs: number,
    /** Requests at the tail of a window reserved for high priority callers. */
    private readonly reserve: number
  ) {
    this.limit = limit;
    this.remaining = limit;
    this.resetAt = Date.now() + windowMs;
  }

  /**
   * Reconcile with the provider's accounting, PESSIMISTICALLY.
   *
   * `remaining` is only ever adopted when it is lower than our own count. This
   * is not excess caution - taking it at face value is actively wrong, and cost
   * a debugging cycle to find. The header describes the provider's state at the
   * moment IT handled that request, which says nothing about the other requests
   * we have already issued and are still awaiting. Fire forty at once and the
   * first response comes back saying "59 remaining", because from the
   * provider's side only one had landed. Adopting that resets the local count
   * upward, the limiter re-authorises work it had already authorised, and the
   * window blows.
   *
   * Downward it is always safe and genuinely useful: it accounts for budget
   * spent by other instances sharing the key. Recovery after a window closes
   * comes from rollover() and the reset timestamp, never from this.
   */
  syncFromHeaders(headers: Headers): void {
    const limit = numericHeader(headers, 'x-ratelimit-limit');
    const remaining = numericHeader(headers, 'x-ratelimit-remaining');
    const reset = numericHeader(headers, 'x-ratelimit-reset');

    if (limit !== null && limit > 0) this.limit = limit;
    if (remaining !== null) {
      this.remaining = Math.max(0, Math.min(this.remaining, remaining));
    }
    // Reset is unix seconds. Guard against a stale or absent value.
    if (reset !== null && reset > 0) {
      const at = reset * 1000;
      if (at > Date.now() - this.windowMs) this.resetAt = at;
    }
    this.drain();
  }

  /** The provider says we are out. Believe it and wait for the window. */
  markExhausted(retryAfterMs?: number): void {
    this.remaining = 0;
    if (retryAfterMs && retryAfterMs > 0) {
      this.resetAt = Math.max(this.resetAt, Date.now() + retryAfterMs);
    }
  }

  /** Roll the window over once its reset time has passed. */
  private rollover(): void {
    const now = Date.now();
    if (now >= this.resetAt) {
      this.remaining = this.limit;
      // Advance to the next boundary rather than now + window, so we stay in
      // step with the provider even if we were idle for several windows.
      const missed = Math.floor((now - this.resetAt) / this.windowMs) + 1;
      this.resetAt += missed * this.windowMs;
    }
  }

  private budgetFor(priority: Priority): number {
    return priority === 'high' ? this.remaining : this.remaining - this.reserve;
  }

  private drain(): void {
    this.rollover();

    // High priority first, then low, each in arrival order.
    for (const priority of ['high', 'low'] as const) {
      let i = 0;
      while (i < this.queue.length) {
        const w = this.queue[i];
        if (w.priority !== priority) {
          i++;
          continue;
        }
        if (this.budgetFor(priority) <= 0) break;
        this.queue.splice(i, 1);
        this.remaining -= 1;
        w.resolve(true);
      }
    }

    // Anyone whose deadline has passed gives up without spending budget.
    const now = Date.now();
    this.queue = this.queue.filter((w) => {
      if (w.deadlineAt !== undefined && w.deadlineAt <= now) {
        w.resolve(false);
        return false;
      }
      return true;
    });

    if (this.queue.length > 0 && !this.timer) {
      // Wake at the window reset, or at the soonest deadline, whichever first.
      const deadlines = this.queue
        .map((w) => w.deadlineAt)
        .filter((d): d is number => d !== undefined);
      const wakeAt = Math.min(this.resetAt, ...(deadlines.length ? deadlines : [Infinity]));
      const waitMs = Math.max(15, Math.min(wakeAt - Date.now(), this.windowMs));
      this.timer = setTimeout(() => {
        this.timer = null;
        this.drain();
      }, waitMs);
      this.timer.unref?.();
    }
  }

  /**
   * Reserve one request. Resolves true when granted, false when the caller's
   * deadline passed first (in which case nothing was spent).
   */
  acquire(priority: Priority = 'high', deadlineAt?: number): Promise<boolean> {
    this.rollover();

    if (this.queue.length === 0 && this.budgetFor(priority) > 0) {
      this.remaining -= 1;
      return Promise.resolve(true);
    }
    if (deadlineAt !== undefined && deadlineAt <= Date.now()) {
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      this.queue.push({ resolve, priority, deadlineAt });
      this.drain();
    });
  }

  /** Diagnostics for /api/health. */
  snapshot() {
    this.rollover();
    return { limit: this.limit, remaining: this.remaining, queued: this.queue.length, resetAt: this.resetAt };
  }
}

/**
 * Finnhub free tier: 60 requests per 60-second window, confirmed from the
 * response headers rather than assumed. Ten are reserved for page-critical
 * calls so peer enrichment can never starve them.
 */
const finnhubWindow = new RateWindow(60, 60_000, 6);

/** NewsAPI free tier is a 100/day quota; pace it and reserve nothing. */
const newsWindow = new RateWindow(50, 60_000, 0);

/**
 * FRED allows 120 requests/minute, which is generous relative to what the
 * calendar needs (about a dozen calls per refresh, cached for hours). Sits well
 * under the published cap.
 */
const fredWindow = new RateWindow(100, 60_000, 0);

const windows: Record<string, RateWindow> = {
  finnhub: finnhubWindow,
  news: newsWindow,
  fred: fredWindow,
};

/** Exposed for /api/health so limiter state is observable in production. */
export function limiterSnapshot() {
  return {
    finnhub: finnhubWindow.snapshot(),
    news: newsWindow.snapshot(),
    fred: fredWindow.snapshot(),
  };
}

/** In-flight request coalescing, keyed by cache key. */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Tier-1 in-process response memo.
 *
 * This sits IN FRONT of the rate limiter, and that placement is the whole
 * point. Next's Data Cache is shared and durable, but a cached `fetch` still
 * has to be reached through our own code - and taking a rate-limit token
 * before calling fetch means a cache hit pays the same queueing cost as a
 * network call. With ~15 upstream calls per page view, five warm concurrent
 * requests were taking ~5s despite hitting cache on every single call, purely
 * from queueing for tokens they did not need.
 *
 * So: memo hit -> return immediately, no token, no fetch.
 * Memo miss    -> take a token, go to Next's Data Cache / the network.
 *
 * Per-instance and deliberately small. It is a latency optimisation, not the
 * durability layer; Next's Data Cache remains the cross-instance cache.
 */
const memo = new Map<string, { value: unknown; expires: number }>();
const MEMO_MAX_ENTRIES = 500;

function memoGet(key: string): { value: unknown } | null {
  const hit = memo.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    memo.delete(key);
    return null;
  }
  // Refresh insertion order so hot keys survive eviction.
  memo.delete(key);
  memo.set(key, hit);
  return hit;
}

function memoSet(key: string, value: unknown, ttlSeconds: number): void {
  if (ttlSeconds <= 0) return;
  if (memo.size >= MEMO_MAX_ENTRIES) {
    // Map preserves insertion order, so the first key is the coldest.
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
}

/**
 * Endpoints that answered 403/404, and when to bother asking again.
 * Keyed the same way as the memo.
 */
const unavailableUntil = new Map<string, number>();
const UNAVAILABLE_TTL_MS = 60 * 60 * 1000;

/** Clears the in-process memo. Test helper. */
export function clearMemo(): void {
  memo.clear();
  unavailableUntil.clear();
}

export function memoSize(): number {
  return memo.size;
}

/**
 * Share one in-flight promise across concurrent callers with the same key.
 * This is what stops ten simultaneous visitors to /ticker/AAPL from issuing
 * ten identical upstream requests.
 */
export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

/** Number of requests currently coalescing. Exposed for tests and /api/health. */
export function inFlightCount(): number {
  return inFlight.size;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface UpstreamOptions {
  /** Which provider's rate window to draw from. */
  provider: 'finnhub' | 'news' | 'fred';
  /** Seconds Next should cache this response. 0 disables caching. */
  revalidate: number;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Attempts after the first. */
  retries?: number;
  /** Stable key for coalescing. Defaults to the URL. */
  key?: string;
  /**
   * 'high' (default) for data the page cannot render without; 'low' for
   * enrichment such as peer metrics, which yields the rate-limit budget to
   * any high-priority work waiting behind it.
   */
  priority?: Priority;
  /**
   * Absolute time (ms epoch) after which this call is no longer worth making.
   * A caller that times out while queued releases its slot without spending
   * any of the window's budget. Defaults to MAX_QUEUE_WAIT_MS from now.
   */
  deadlineAt?: number;
}

/**
 * Nothing waits longer than this for rate-limit budget.
 *
 * Without a ceiling, a request arriving on an exhausted window blocks until it
 * reopens - up to a full minute. One cold request was measured at 15 seconds
 * mid-window. Failing fast with a 503 and Retry-After is far better than a
 * page that hangs, particularly since the CDN's stale-while-revalidate will
 * usually serve the previous response in the meantime.
 */
const MAX_QUEUE_WAIT_MS = 9000;

/**
 * Fetch JSON from an upstream provider with rate limiting, coalescing,
 * caching and correct 429 handling.
 *
 * Throws UpstreamError on failure so callers can distinguish "this genuinely
 * has no data" from "we were rate limited" - a distinction the previous code
 * lost, which is what let unfounded scores through.
 */
export async function upstreamJson<T>(url: string, opts: UpstreamOptions): Promise<T> {
  const {
    provider,
    revalidate,
    timeoutMs = 8000,
    retries = 2,
    priority = 'high',
    deadlineAt = Date.now() + MAX_QUEUE_WAIT_MS,
  } = opts;
  const key = opts.key ?? url;

  // Tier 1, before the rate limiter: a warm key costs nothing.
  const cached = memoGet(key);
  if (cached) return cached.value as T;

  return singleFlight(key, async () => {
    // Another caller may have populated the memo while we queued behind them.
    const raced = memoGet(key);
    if (raced) return raced.value as T;

    const limiter = windows[provider];
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const granted = await limiter.acquire(priority, deadlineAt);
      if (!granted) {
        throw new UpstreamError(
          `Skipped ${provider} request: rate-limit budget unavailable before deadline`,
          0,
          false
        );
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(url, {
          signal: controller.signal,
          // Next's Data Cache: shared across instances on Vercel and durable
          // across cold starts. This replaces the old per-instance Map that
          // collapsed under exactly the load it was meant to absorb.
          ...(revalidate > 0
            ? { next: { revalidate } }
            : { cache: 'no-store' as const }),
        });
        clearTimeout(timer);

        // Believe the provider's accounting over ours.
        limiter.syncFromHeaders(res.headers);

        // A 429 is a real failure. The old code treated it as a non-ok
        // response that never threw, so it was silently discarded.
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get('retry-after')) || 0;
          const backoff = retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
          // Stop issuing until the window reopens, rather than letting every
          // other queued caller discover the same 429 one at a time.
          limiter.markExhausted(backoff);
          lastError = new UpstreamError(`Rate limited by ${provider}`, 429, true);
          if (attempt < retries) {
            await sleep(Math.min(backoff, 4000));
            continue;
          }
          throw lastError;
        }

        if (res.status >= 500) {
          lastError = new UpstreamError(`${provider} returned ${res.status}`, res.status, true);
          if (attempt < retries) {
            await sleep(500 * 2 ** attempt);
            continue;
          }
          throw lastError;
        }

        if (!res.ok) {
          // 4xx other than 429 will not improve on retry.
          throw new UpstreamError(`${provider} returned ${res.status}`, res.status, false);
        }

        const json = (await res.json()) as T;
        memoSet(key, json, revalidate);
        if (process.env.FF_DEBUG_UPSTREAM) {
          const snap = limiter.snapshot();
          console.log(
            `[upstream] ${priority.padEnd(4)} ${key} -> ${res.status} | window ${snap.remaining}/${snap.limit} queued ${snap.queued}`
          );
        }
        return json;
      } catch (err) {
        clearTimeout(timer);

        if (err instanceof UpstreamError && !err.retryable) throw err;

        const isAbort = (err as Error).name === 'AbortError';
        lastError =
          err instanceof UpstreamError
            ? err
            : new UpstreamError(
                isAbort ? `${provider} request timed out` : (err as Error).message,
                0,
                true
              );

        if (attempt < retries) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw lastError;
      }
    }

    throw lastError ?? new UpstreamError('Unknown upstream failure', 0, true);
  });
}

/**
 * Like upstreamJson but resolves to `fallback` instead of throwing.
 * Use for genuinely optional data. The returned tuple reports whether the call
 * actually succeeded, so callers can tell the difference between "no data
 * exists" and "we failed to fetch it".
 */
export async function upstreamJsonOptional<T>(
  url: string,
  opts: UpstreamOptions,
  fallback: T
): Promise<{ data: T; ok: boolean; error?: string }> {
  const key = opts.key ?? url;

  // A previously observed entitlement failure. Do not spend a request finding
  // out again.
  const blockedUntil = unavailableUntil.get(key);
  if (blockedUntil !== undefined) {
    if (blockedUntil > Date.now()) {
      return { data: fallback, ok: false, error: 'Endpoint not available on this plan' };
    }
    unavailableUntil.delete(key);
  }

  try {
    const data = await upstreamJson<T>(url, opts);
    return { data, ok: true };
  } catch (err) {
    const error = err as UpstreamError;

    // 403 and 404 are statements about entitlement or existence, not transient
    // faults - they will answer identically for as long as the plan does.
    // Finnhub's /stock/price-target is premium-only, so on a free key every
    // single page view was spending a rate-limited request to be told "no"
    // again. Remember the answer.
    if (error.status === 403 || error.status === 404) {
      unavailableUntil.set(key, Date.now() + UNAVAILABLE_TTL_MS);
    }

    return { data: fallback, ok: false, error: error.message };
  }
}
