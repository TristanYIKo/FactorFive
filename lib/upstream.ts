/**
 * Shared upstream HTTP layer.
 *
 * Every external API call in the app goes through here. It exists to solve the
 * problem that made FactorFive single-user: a single page view fanned out to
 * ~27 Finnhub calls, so two simultaneous visitors exceeded the provider's
 * 30-requests/second burst cap. The provider then returned 429s which the old
 * code silently swallowed, producing scores with no peer data behind them.
 *
 * Three mechanisms, in the order a request meets them:
 *
 *   1. Single-flight  - concurrent callers asking for the same URL share one
 *                       in-flight promise instead of each issuing a request.
 *   2. Token bucket   - smooths bursts to stay under the provider's rate cap,
 *                       queueing rather than firing everything at once.
 *   3. Retry          - honours 429 / Retry-After and retries 5xx with backoff.
 *
 * Responses are cached by Next's Data Cache via `next: { revalidate }`, which
 * on Vercel is shared across instances and survives cold starts. The token
 * bucket and single-flight map are per-instance; that is sufficient because
 * caching removes most upstream volume, but see docs/CACHING.md for the Redis
 * upgrade path if you ever self-host behind a load balancer.
 */

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
 * Classic token bucket. `capacity` tokens are available at once and refill at
 * `refillPerSecond`. `take()` resolves as soon as a token is free, so callers
 * queue instead of overwhelming the provider.
 */
class TokenBucket {
  private tokens: number;
  private lastRefill = Date.now();
  private waiters: Array<() => void> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number
  ) {
    this.tokens = capacity;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    this.lastRefill = now;
  }

  /** Wake as many queued callers as we now have tokens for. */
  private drain(): void {
    this.refill();
    while (this.waiters.length > 0 && this.tokens >= 1) {
      this.tokens -= 1;
      const next = this.waiters.shift();
      if (next) next();
    }
    if (this.waiters.length > 0 && !this.timer) {
      // Schedule the next drain for when the next token should be available.
      const waitMs = Math.max(10, Math.ceil((1 / this.refillPerSecond) * 1000));
      this.timer = setTimeout(() => {
        this.timer = null;
        this.drain();
      }, waitMs);
      // Do not hold a serverless process open just for the limiter.
      this.timer.unref?.();
    }
  }

  take(): Promise<void> {
    this.refill();
    if (this.tokens >= 1 && this.waiters.length === 0) {
      this.tokens -= 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waiters.push(resolve);
      this.drain();
    });
  }
}

/** Finnhub free tier: 30 req/sec burst, 60 req/min sustained. Stay under both. */
const finnhubBucket = new TokenBucket(20, 15);
/** NewsAPI free tier is a daily quota rather than a rate; keep it gentle. */
const newsBucket = new TokenBucket(5, 2);

const buckets: Record<string, TokenBucket> = {
  finnhub: finnhubBucket,
  news: newsBucket,
};

/** In-flight request coalescing, keyed by cache key. */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Tier-1 in-process response memo.
 *
 * This sits IN FRONT of the rate limiter, and that placement is the whole
 * point. Next's Data Cache is shared and durable, but a cached `fetch` still
 * has to be reached through our own code - and taking a rate-limit token
 * before calling fetch means a cache hit pays the same queueing cost as a
 * network call. With ~18 upstream calls per page view and a 15/sec bucket,
 * five warm concurrent requests were still taking ~5s despite hitting cache
 * on every single call.
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

/** Clears the in-process memo. Test helper. */
export function clearMemo(): void {
  memo.clear();
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
  /** Which rate-limit bucket to draw from. */
  provider: 'finnhub' | 'news';
  /** Seconds Next should cache this response. 0 disables caching. */
  revalidate: number;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Attempts after the first. */
  retries?: number;
  /** Stable key for coalescing. Defaults to the URL. */
  key?: string;
}

/**
 * Fetch JSON from an upstream provider with rate limiting, coalescing,
 * caching and correct 429 handling.
 *
 * Throws UpstreamError on failure so callers can distinguish "this genuinely
 * has no data" from "we were rate limited" - a distinction the previous code
 * lost, which is what let unfounded scores through.
 */
export async function upstreamJson<T>(url: string, opts: UpstreamOptions): Promise<T> {
  const { provider, revalidate, timeoutMs = 8000, retries = 2 } = opts;
  const key = opts.key ?? url;

  // Tier 1, before the rate limiter: a warm key costs nothing.
  const cached = memoGet(key);
  if (cached) return cached.value as T;

  return singleFlight(key, async () => {
    // Another caller may have populated the memo while we queued behind them.
    const raced = memoGet(key);
    if (raced) return raced.value as T;

    const bucket = buckets[provider];
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      await bucket.take();

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

        // A 429 is a real failure. The old code treated it as a non-ok
        // response that never threw, so it was silently discarded.
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get('retry-after')) || 0;
          const backoff = retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
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
  try {
    const data = await upstreamJson<T>(url, opts);
    return { data, ok: true };
  } catch (err) {
    return { data: fallback, ok: false, error: (err as Error).message };
  }
}
