/**
 * Company identity and live price.
 *
 * Sits at the top of the ticker page. The 52-week range bar gives immediate
 * spatial context that a bare price cannot - "$309" means little on its own,
 * "$309, 71% of the way up its 52-week range" means something.
 */

import type { FinnhubProfile, FinnhubQuote, FinnhubBasicFinancials } from '@/types/stock';
import { Card, Stat } from '@/components/ui/Primitives';
import { RangeBar, DeltaText } from '@/components/ui/Charts';
import { formatCurrency } from '@/lib/formatters';

export function PriceHeader({
  symbol,
  profile,
  quote,
  financials,
}: {
  symbol: string;
  profile: FinnhubProfile;
  quote: FinnhubQuote;
  financials: FinnhubBasicFinancials | null;
}) {
  const m = financials?.metric;
  const high52 = m?.['52WeekHigh'];
  const low52 = m?.['52WeekLow'];
  // Finnhub reports market cap in millions.
  const marketCap = profile.marketCapitalization ? profile.marketCapitalization * 1_000_000 : undefined;

  return (
    <Card delay={0}>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          {profile.logo ? (
            // Company logos come from arbitrary vendor URLs, so a plain img with
            // lazy loading is the pragmatic choice over next/image remote config.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.logo}
              alt=""
              width={52}
              height={52}
              loading="eager"
              className="h-13 w-13 shrink-0 rounded-[var(--radius-md)] border object-contain"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)', height: 52, width: 52 }}
            />
          ) : (
            <div
              className="flex h-13 w-13 shrink-0 items-center justify-center rounded-[var(--radius-md)] border text-lg font-semibold"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-subtle)', height: 52, width: 52 }}
            >
              {symbol.slice(0, 2)}
            </div>
          )}

          <div className="min-w-0">
            <h1
              className="truncate text-[22px] leading-tight font-semibold tracking-tight sm:text-[26px]"
              style={{ color: 'var(--text-primary)' }}
            >
              {profile.name || symbol}
            </h1>
            <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                {symbol}
              </span>
              {profile.exchange ? ` · ${profile.exchange}` : ''}
              {profile.finnhubIndustry ? ` · ${profile.finnhubIndustry}` : ''}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div
            className="tabular text-[30px] leading-none font-semibold tracking-tight sm:text-[34px]"
            style={{ color: 'var(--text-primary)' }}
          >
            ${quote.c?.toFixed(2) ?? '—'}
          </div>
          <div className="mt-1.5 text-[13px]">
            {typeof quote.dp === 'number' ? (
              <>
                <DeltaText value={quote.dp} />
                <span className="tabular ml-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  ({quote.d >= 0 ? '+' : ''}
                  {quote.d?.toFixed(2)})
                </span>
              </>
            ) : (
              <span style={{ color: 'var(--text-tertiary)' }}>no change data</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 sm:grid-cols-4"
        style={{ borderColor: 'var(--border)' }}>
        <Stat label="Open" value={quote.o ? `$${quote.o.toFixed(2)}` : '—'} />
        <Stat label="Day range" value={quote.l && quote.h ? `$${quote.l.toFixed(2)} – $${quote.h.toFixed(2)}` : '—'} />
        <Stat label="Prev close" value={quote.pc ? `$${quote.pc.toFixed(2)}` : '—'} />
        <Stat label="Market cap" value={marketCap ? formatCurrency(marketCap) : '—'} />
      </div>

      {high52 && low52 && quote.c && (
        <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="text-[12px] font-medium uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}>
              52-week range
            </span>
          </div>
          <RangeBar
            low={low52}
            high={high52}
            current={quote.c}
            lowLabel={`$${low52.toFixed(2)}`}
            highLabel={`$${high52.toFixed(2)}`}
            currentLabel={`$${quote.c.toFixed(2)}`}
          />
        </div>
      )}
    </Card>
  );
}
