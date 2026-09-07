/**
 * Builds the search index used by the ticker search box.
 *
 * Why a generated file rather than a live lookup: Finnhub's free tier allows 60
 * requests per minute and a single cold stock analysis already costs about 15
 * of them. Spending that budget on keystrokes would starve the thing people
 * actually came for. `/stock/symbol` returns the entire US universe in one
 * call, so we pay once here, commit the result, and search runs entirely in the
 * browser against a static asset. Zero upstream calls per search, forever.
 *
 * Run it when the listed universe drifts (quarterly is plenty):
 *
 *     node scripts/build-symbol-index.mjs
 *
 * Reads FINNHUB_KEY from .env.local and writes public/symbols.json.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Exchanges a fundamentals tool can actually analyse. OTC is excluded on purpose. */
const EXCHANGES = new Set(['XNAS', 'XNYS', 'XASE']);

/** ETFs, funds, warrants and units have no P/E or ROE, so they are not listed. */
const TYPES = new Set(['Common Stock', 'ADR']);

/**
 * Tokens that are acronyms or national corporate forms, and must not be
 * title-cased. Deliberately excludes INC, CORP, LTD and CO: those are ordinary
 * words in a company name, and "Agilent Technologies INC" reads as shouting.
 */
const KEEP_UPPER = new Set([
  'PLC', 'LLC', 'LP', 'NV', 'SA', 'AG', 'AB', 'ASA', 'SE', 'BV', 'PBC', 'NA',
  'USA', 'US', 'UK', 'UAE', 'AI', 'IT', 'REIT', 'ETF', 'SPA', 'ADS', 'ADR',
  'II', 'III', 'IV',
]);

/** Finnhub abbreviations that read badly in a suggestion list. */
const EXPAND = new Map([
  ['GRP', 'Group'],
  ['HLDG', 'Holding'],
  ['HLDGS', 'Holdings'],
  ['TECHNOLGY', 'Technology'],
  ['INTL', 'International'],
  ['PHARMACEUTICL', 'Pharmaceutical'],
  ['RESOURCS', 'Resources'],
  ['SVCS', 'Services'],
  ['SYS', 'Systems'],
  ['SVC', 'Service'],
  ['MFG', 'Manufacturing'],
  ['INDS', 'Industries'],
  ['COMMUNICATNS', 'Communications'],
]);

/**
 * Brands whose real casing cannot be recovered by rule.
 *
 * Finnhub stores names in caps, so "NVIDIA" and "JPMORGAN" arrive
 * indistinguishable from ordinary words and title-case flattens them to
 * "Nvidia" and "Jpmorgan". These are the names people actually type, so they
 * are corrected by symbol rather than left slightly wrong.
 */
const OVERRIDES = new Map([
  ['NVDA', 'NVIDIA Corp'],
  ['JPM', 'JPMorgan Chase & Co'],
  ['UNH', 'UnitedHealth Group Inc'],
  ['XOM', 'ExxonMobil Corp'],
  ['AMZN', 'Amazon.com Inc'],
  ['PYPL', 'PayPal Holdings Inc'],
  ['EBAY', 'eBay Inc'],
  ['TMUS', 'T-Mobile US Inc'],
  ['MMM', '3M Co'],
  ['T', 'AT&T Inc'],
  ['GME', 'GameStop Corp'],
  ['BLK', 'BlackRock Inc'],
  ['TSM', 'TSMC'],
  ['ASML', 'ASML Holding NV'],
  ['SAP', 'SAP SE'],
  ['ADBE', 'Adobe Inc'],
  ['CRM', 'Salesforce Inc'],
  ['NFLX', 'Netflix Inc'],
  ['INTC', 'Intel Corp'],
  ['CSCO', 'Cisco Systems Inc'],
  ['ORCL', 'Oracle Corp'],
  ['QCOM', 'Qualcomm Inc'],
  ['TXN', 'Texas Instruments Inc'],
  ['HPQ', 'HP Inc'],
  ['HPE', 'Hewlett Packard Enterprise'],
  ['LVMUY', 'LVMH'],
  ['BABA', 'Alibaba Group Holding'],
  ['JD', 'JD.com Inc'],
  ['NTES', 'NetEase Inc'],
  ['BIDU', 'Baidu Inc'],
]);

/**
 * Finnhub ships descriptions in caps ("NATHAN'S FAMOUS INC"). Naive title-case
 * mangles possessives into "Nathan'S", so casing is applied per alphabetic run
 * rather than per word.
 */
function prettyName(raw) {
  return raw
    .trim()
    .split(/\s+/)
    .map((word) => {
      const bare = word.replace(/[^A-Z0-9]/gi, '');
      if (EXPAND.has(bare)) return EXPAND.get(bare);
      if (KEEP_UPPER.has(bare)) return bare;
      if (/^\d/.test(word)) return word;
      return word.toLowerCase().replace(/[a-z]+/g, (run, offset) =>
        // Capitalise a run only when it starts the word or follows a separator,
        // so "nathan's" becomes "Nathan's" and not "Nathan'S".
        offset === 0 || /[ .\-/&(]/.test(word[offset - 1] ?? '')
          ? run.charAt(0).toUpperCase() + run.slice(1)
          : run
      );
    })
    .join(' ')
    // Bloomberg-style artefacts that survive casing.
    .replace(/\/The$/, '')
    .replace(/\s*-\s*Cl(?:ass)?\s+([A-Z])(?=\s|$)/g, ' Class $1')
    .replace(/\s+Cl-([A-Z])(?=\s|$)/g, ' Class $1')
    .replace(/\bMc([a-z])/g, (_, c) => `Mc${c.toUpperCase()}`)
    .replace(/\.Com\b/g, '.com')
    .trim();
}

function readKey() {
  const env = readFileSync(join(root, '.env.local'), 'utf8');
  const match = env.match(/^FINNHUB_KEY=(.*)$/m);
  if (!match) throw new Error('FINNHUB_KEY not found in .env.local');
  return match[1].trim().replace(/^["']|["']$/g, '');
}

const key = readKey();
process.stdout.write('Fetching US symbol universe from Finnhub ... ');

const res = await fetch(`https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${key}`);
if (!res.ok) throw new Error(`Finnhub returned ${res.status} ${res.statusText}`);
const all = await res.json();
console.log(`${all.length} records`);

const seen = new Set();
const index = all
  .filter((r) => EXCHANGES.has(r.mic) && TYPES.has(r.type) && r.symbol && r.description)
  .filter((r) => {
    if (seen.has(r.symbol)) return false;
    seen.add(r.symbol);
    return true;
  })
  // [symbol, name] tuples rather than objects: same information, roughly half
  // the bytes over the wire.
  .map((r) => [r.symbol, OVERRIDES.get(r.symbol) ?? prettyName(r.description)])
  .sort((a, b) => a[0].localeCompare(b[0]));

mkdirSync(join(root, 'public'), { recursive: true });
const out = join(root, 'public', 'symbols.json');
writeFileSync(out, JSON.stringify(index), 'utf8');

const kb = (Buffer.byteLength(JSON.stringify(index)) / 1024).toFixed(1);
console.log(`Wrote ${index.length} symbols to public/symbols.json (${kb} KB)`);
console.log('Sample:', index.slice(0, 3).map(([s, n]) => `${s} = ${n}`).join(', '));
