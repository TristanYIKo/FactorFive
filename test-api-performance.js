#!/usr/bin/env node
/**
 * FactorFive API benchmark.
 *
 * Measures two things the app has historically been bad at:
 *   1. Latency of /api/stock (cold and warm).
 *   2. Behaviour under CONCURRENT load - both whether requests succeed and,
 *      critically, whether the analysis stays correct. A request that returns
 *      200 with peerCount:0 is a silent failure: the scoring engine falls back
 *      to z-score 0 on every factor and emits ~50/100 for any stock.
 *
 * Usage:
 *   node test-api-performance.js                      # default: 5 concurrent
 *   node test-api-performance.js --concurrency 10
 *   node test-api-performance.js --symbols AAPL,MSFT  # custom symbol set
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const CONCURRENCY = parseInt(arg('concurrency', '5'), 10);
const SYMBOLS = arg('symbols', 'AAPL,MSFT,GOOGL,AMZN,NVDA,META,TSLA,JPM,V,WMT')
  .split(',')
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

async function hit(symbol) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}/api/stock?symbol=${symbol}`);
    const ms = Date.now() - started;
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON body */
    }
    return {
      symbol,
      ms,
      status: res.status,
      ok: res.ok,
      score: body?.stockScore ?? null,
      peerCount: body?.industryBenchmarks?.peerCount ?? null,
      error: res.ok ? null : body?.error || body?.details || `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      symbol,
      ms: Date.now() - started,
      status: 0,
      ok: false,
      score: null,
      peerCount: null,
      error: err.message,
    };
  }
}

function stats(values) {
  if (!values.length) return { min: 0, max: 0, mean: 0, p50: 0, p95: 0 };
  const s = [...values].sort((a, b) => a - b);
  const at = (p) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  return {
    min: s[0],
    max: s[s.length - 1],
    mean: Math.round(s.reduce((a, b) => a + b, 0) / s.length),
    p50: at(50),
    p95: at(95),
  };
}

function report(label, results) {
  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  // A 200 response with no peers means the industry benchmark silently
  // collapsed to zero - the scores it produced are meaningless.
  const degraded = ok.filter((r) => !r.peerCount);
  const t = stats(results.map((r) => r.ms));

  console.log(`\n=== ${label} ===`);
  console.log(`requests   : ${results.length}`);
  console.log(`succeeded  : ${ok.length}`);
  console.log(`failed     : ${failed.length}`);
  console.log(`degraded   : ${degraded.length}  (HTTP 200 but peerCount=0 -> scores are garbage)`);
  console.log(`latency ms : min ${t.min} / p50 ${t.p50} / mean ${t.mean} / p95 ${t.p95} / max ${t.max}`);
  console.log('');
  for (const r of results) {
    const flag = !r.ok ? 'FAIL' : !r.peerCount ? 'DEGRADED' : 'ok';
    console.log(
      `  ${r.symbol.padEnd(6)} ${String(r.ms).padStart(6)}ms  ${String(r.status).padEnd(4)} ` +
        `score=${String(r.score ?? '-').padStart(4)} peers=${String(r.peerCount ?? '-').padStart(3)}  ` +
        `${flag}${r.error ? ' :: ' + r.error : ''}`
    );
  }
  return { ok: ok.length, failed: failed.length, degraded: degraded.length, t };
}

(async () => {
  console.log(`FactorFive benchmark -> ${BASE}`);

  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  console.log(`health: keys finnhub=${health.env.hasFinnhubKey} newsapi=${health.env.hasNewsApiKey}`);

  // Single request, uncontended. This is the best case.
  const single = await hit(SYMBOLS[0]);
  report('SEQUENTIAL (1 request, uncontended)', [single]);

  // Concurrent burst. This is where the app has historically fallen over:
  // each request fans out to ~27 upstream calls, so N users produce 27N
  // simultaneous calls against a 30/sec upstream burst cap.
  const batch = SYMBOLS.slice(0, CONCURRENCY);
  console.log(`\nfiring ${batch.length} concurrent requests: ${batch.join(', ')}`);
  const results = await Promise.all(batch.map(hit));
  const summary = report(`CONCURRENT (${batch.length} simultaneous users)`, results);

  console.log('');
  if (summary.failed || summary.degraded) {
    console.log(
      `VERDICT: ${summary.failed} failed, ${summary.degraded} silently degraded ` +
        `out of ${results.length} concurrent requests.`
    );
    process.exitCode = 1;
  } else {
    console.log(`VERDICT: all ${results.length} concurrent requests returned sound data.`);
  }
})();
