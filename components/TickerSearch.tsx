'use client';

/**
 * Ticker search with keyboard navigation.
 *
 * One of only three client components in the app. Uses useTransition so that
 * navigation is optimistic: the button enters its pending state on the very
 * first keystroke of Enter, while the server renders the new page. The old
 * build pushed the route and left the user staring at an unchanged screen.
 */

import { useState, useRef, useEffect, useMemo, useTransition, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';

/** A small local universe purely for suggestions; any symbol can be submitted. */
const UNIVERSE: Array<{ symbol: string; name: string; sector: string }> = [
  { symbol: 'AAPL', name: 'Apple', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon', sector: 'Consumer' },
  { symbol: 'NVDA', name: 'NVIDIA', sector: 'Semiconductors' },
  { symbol: 'META', name: 'Meta Platforms', sector: 'Technology' },
  { symbol: 'TSLA', name: 'Tesla', sector: 'Automotive' },
  { symbol: 'AVGO', name: 'Broadcom', sector: 'Semiconductors' },
  { symbol: 'AMD', name: 'AMD', sector: 'Semiconductors' },
  { symbol: 'INTC', name: 'Intel', sector: 'Semiconductors' },
  { symbol: 'TSM', name: 'TSMC', sector: 'Semiconductors' },
  { symbol: 'QCOM', name: 'Qualcomm', sector: 'Semiconductors' },
  { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financials' },
  { symbol: 'BAC', name: 'Bank of America', sector: 'Financials' },
  { symbol: 'GS', name: 'Goldman Sachs', sector: 'Financials' },
  { symbol: 'V', name: 'Visa', sector: 'Financials' },
  { symbol: 'MA', name: 'Mastercard', sector: 'Financials' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financials' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
  { symbol: 'UNH', name: 'UnitedHealth', sector: 'Healthcare' },
  { symbol: 'LLY', name: 'Eli Lilly', sector: 'Healthcare' },
  { symbol: 'PFE', name: 'Pfizer', sector: 'Healthcare' },
  { symbol: 'DIS', name: 'Disney', sector: 'Media' },
  { symbol: 'NFLX', name: 'Netflix', sector: 'Media' },
  { symbol: 'WMT', name: 'Walmart', sector: 'Retail' },
  { symbol: 'COST', name: 'Costco', sector: 'Retail' },
  { symbol: 'HD', name: 'Home Depot', sector: 'Retail' },
  { symbol: 'TGT', name: 'Target', sector: 'Retail' },
  { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy' },
  { symbol: 'CVX', name: 'Chevron', sector: 'Energy' },
  { symbol: 'BA', name: 'Boeing', sector: 'Industrials' },
  { symbol: 'CAT', name: 'Caterpillar', sector: 'Industrials' },
  { symbol: 'KO', name: 'Coca-Cola', sector: 'Consumer' },
  { symbol: 'PEP', name: 'PepsiCo', sector: 'Consumer' },
  { symbol: 'MCD', name: "McDonald's", sector: 'Consumer' },
  { symbol: 'NKE', name: 'Nike', sector: 'Consumer' },
];

export function TickerSearch({
  size = 'large',
  placeholder = 'Search any ticker — AAPL, MSFT, NVDA',
  autoFocus = false,
}: {
  size?: 'large' | 'compact';
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [isPending, startTransition] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return UNIVERSE.filter(
      (t) => t.symbol.startsWith(q) || t.name.toUpperCase().includes(q)
    )
      .sort((a, b) => {
        // Exact and prefix matches on the symbol rank above name matches.
        const aExact = a.symbol === q ? 0 : a.symbol.startsWith(q) ? 1 : 2;
        const bExact = b.symbol === q ? 0 : b.symbol.startsWith(q) ? 1 : 2;
        return aExact - bExact || a.symbol.localeCompare(b.symbol);
      })
      .slice(0, 7);
  }, [query]);

  useEffect(() => {
    setHighlighted(0);
    setOpen(matches.length > 0);
  }, [matches.length, query]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  // Focus the search from anywhere with "/", the convention users expect.
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function go(symbol: string) {
    const clean = symbol.trim().toUpperCase();
    if (!clean) return;
    setOpen(false);
    startTransition(() => router.push(`/ticker/${encodeURIComponent(clean)}`));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    go(matches.length > 0 && open ? matches[highlighted].symbol : query);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const big = size === 'large';

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={onSubmit}>
        <div className="relative">
          <span
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
            style={{ color: 'var(--text-tertiary)' }}
            aria-hidden="true"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => matches.length > 0 && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            maxLength={12}
            aria-label="Search for a stock ticker"
            aria-expanded={open}
            aria-autocomplete="list"
            role="combobox"
            aria-controls="ticker-suggestions"
            className={`w-full rounded-[var(--radius-lg)] border pl-11 outline-none transition-all ${
              big ? 'py-3.5 pr-28 text-[15px]' : 'py-2.5 pr-20 text-[14px]'
            }`}
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-sm)',
            }}
          />

          <button
            type="submit"
            disabled={isPending || !query.trim()}
            className={`absolute top-1/2 right-1.5 -translate-y-1/2 rounded-[var(--radius-md)] font-medium transition-all disabled:opacity-45 ${
              big ? 'px-4 py-2 text-[13.5px]' : 'px-3 py-1.5 text-[13px]'
            }`}
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {isPending ? 'Loading…' : 'Analyse'}
          </button>
        </div>
      </form>

      {open && matches.length > 0 && (
        <ul
          id="ticker-suggestions"
          role="listbox"
          className="ff-fade absolute z-20 mt-2 w-full overflow-hidden rounded-[var(--radius-lg)] border py-1"
          style={{
            background: 'var(--surface-overlay)',
            borderColor: 'var(--border-strong)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {matches.map((t, i) => (
            <li key={t.symbol} role="option" aria-selected={i === highlighted}>
              <button
                type="button"
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => go(t.symbol)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors"
                style={{ background: i === highlighted ? 'var(--accent-soft)' : 'transparent' }}
              >
                <span className="flex min-w-0 items-baseline gap-2.5">
                  <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {t.symbol}
                  </span>
                  <span className="truncate text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                    {t.name}
                  </span>
                </span>
                <span className="shrink-0 text-[11.5px]" style={{ color: 'var(--text-tertiary)' }}>
                  {t.sector}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
