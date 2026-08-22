#!/usr/bin/env node
/**
 * FactorFive API benchmark.
 *
 * Measures two things:
 *
 *   1. Latency of /api/stock (cold and warm).
 *   2. Behaviour under CONCURRENT load, and specifically whether the app is
 *      HONEST about the quality of what it returns.
 *
 * That second point needs care. Finnhub's free tier allows 60 requests per
 * minute (confirmed via X-Ratelimit-Limit), and a fully cold symbol costs
 * roughly 15. Several cold symbols at once therefore cannot all receive a full
 * peer cohort. That is a property of the plan, not a bug, and no amount of
 * engineering removes it.
 *
 * The bug this branch fixed was never "peer data was thin". It was that thin
 * peer data was INVISIBLE: the engine emitted a confident ~50/100 built on an
 * empty peer set while the UI claimed a full industry comparison.
 *
 * So the pass condition is not "every request got peers". It is:
 *   - no request claims benchmarksReliable while having too few peers
 *   - no request reports high confidence without the data to justify it
 *
 * Thin and flagged is a pass. Thin and confident is a failure.
 *
 * Usage:
 *   node test-api-performance.js
 *   node test-api-performance.js --concurrency 10
 *   node test-api-performance.js --symbols AAPL,MSFT
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

/** Matches MIN_PEERS_FOR_BENCHMARK in lib/finnhub.ts. */
const MIN_PEERS = 4;

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
      reliable: body?.dataQuality?.benchmarksReliable ?? null,
      confidence: body?.scoreBreakdown?.confidence ?? null,
      cohort: body?.dataQuality?.peerCohort ?? null,
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
      reliable: null,
      confidence: null,
      cohort: null,
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

/** Classify one result. Only DISHONEST and FAIL are correctness failures. */
function classify(r) {
  if (!r.ok) return 'FAIL';
  const thin = (r.peerCount ?? 0) < MIN_PEERS;
  if (!thin) return 'sound';
  if (r.reliable === true || r.confidence === 'high') return 'DISHONEST';
  return 'thin-flagged';
}

function report(label, results) {
  const t = stats(results.map((r) => r.ms));
  const tally = { sound: 0, 'thin-flagged': 0, DISHONEST: 0, FAIL: 0 };
  for (const r of results) tally[classify(r)]++;

  console.log(`\n=== ${label} ===`);
  console.log(`requests      : ${results.length}`);
  console.log(`sound         : ${tally.sound}   (full peer cohort)`);
  console.log(`thin, flagged : ${tally['thin-flagged']}   (few peers, correctly reported unreliable)`);
  console.log(`DISHONEST     : ${tally.DISHONEST}   (few peers but claimed reliable / high confidence)`);
  console.log(`failed        : ${tally.FAIL}`);
  console.log(`latency ms    : min ${t.min} / p50 ${t.p50} / mean ${t.mean} / p95 ${t.p95} / max ${t.max}`);
  console.log('');
  for (const r of results) {
    console.log(
      `  ${r.symbol.padEnd(6)} ${String(r.ms).padStart(6)}ms  ${String(r.status).padEnd(4)} ` +
        `score=${String(r.score ?? '-').padStart(4)} peers=${String(r.peerCount ?? '-').padStart(3)} ` +
        `conf=${String(r.confidence ?? '-').padEnd(7)} ${classify(r)}` +
        `${r.error ? ' :: ' + r.error : ''}`
    );
  }
  return { ...tally, t };
}

(async () => {
  console.log(`FactorFive benchmark -> ${BASE}`);

  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  console.log(
    `health: finnhub=${health.env.hasFinnhubKey} newsapi=${health.env.hasNewsApiKey}` +
      (health.upstream
        ? ` | window ${health.upstream.finnhub.remaining}/${health.upstream.finnhub.limit} left, ` +
          `resets in ${Math.round(health.upstream.finnhub.resetInMs / 1000)}s`
        : '')
  );

  const single = await hit(SYMBOLS[0]);
  report('SEQUENTIAL (1 request, uncontended)', [single]);

  const batch = SYMBOLS.slice(0, CONCURRENCY);
  console.log(`\nfiring ${batch.length} concurrent requests: ${batch.join(', ')}`);
  const results = await Promise.all(batch.map(hit));
  const summary = report(`CONCURRENT (${batch.length} simultaneous users)`, results);

  const after = await fetch(`${BASE}/api/health`).then((r) => r.json());
  if (after.upstream) {
    console.log(
      `\nupstream window after run: ${after.upstream.finnhub.remaining}/${after.upstream.finnhub.limit} ` +
        `remaining, ${after.upstream.memoEntries} memo entries`
    );
  }

  console.log('');
  if (summary.DISHONEST > 0 || summary.FAIL > 0) {
    console.log(
      `VERDICT: FAIL - ${summary.DISHONEST} request(s) overstated their data quality, ` +
        `${summary.FAIL} errored.`
    );
    process.exitCode = 1;
  } else {
    console.log(
      `VERDICT: PASS - ${summary.sound} sound, ${summary['thin-flagged']} thin but correctly ` +
        `flagged, 0 overstated.`
    );
  }
})();
