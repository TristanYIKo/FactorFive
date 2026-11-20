/**
 * Company identity and live price.
 *
 * Sits at the top of the ticker page. The 52-week range bar gives immediate
 * spatial context that a bare price cannot - "$309" means little on its own,
 * "$309, 71% of the way up its 52-week range" means something.
 *
 * The identity block never changes, so it renders here on the server. Every
 * figure that moves with the price lives in LiveQuote, a client component
 * that keeps them current while the page is open. Only the handful of numbers
 * it needs cross the boundary, not the whole metric payload.
 */

import type { FinnhubProfile, FinnhubQuote, FinnhubBasicFinancials } from '@/types/stock';
import type { MarketSession } from '@/lib/marketHours';
import { Card } from '@/components/ui/Primitives';
import { LiveQuote } from '@/components/stock/LiveQuote';

export function PriceHeader({
  symbol,
  profile,
  quote,
  financials,
  session,
  renderedAt,
}: {
  symbol: string;
  profile: FinnhubProfile;
  quote: FinnhubQuote;
  financials: FinnhubBasicFinancials | null;
  session: MarketSession;
  renderedAt: number;
}) {
  const m = financials?.metric;

  return (
    <Card delay={0}>
      <LiveQuote
        // A fresh server render remounts with fresh data instead of keeping the
        // previous symbol's (or the previous render's) price in state.
        key={`${symbol}-${renderedAt}`}
        symbol={symbol}
        identity={<Identity symbol={symbol} profile={profile} />}
        initialQuote={quote}
        initialSession={session}
        renderedAt={renderedAt}
        high52={m?.['52WeekHigh']}
        low52={m?.['52WeekLow']}
        sharesOutstandingM={profile.shareOutstanding || undefined}
        // Finnhub reports market cap in millions.
        fallbackMarketCap={
          profile.marketCapitalization ? profile.marketCapitalization * 1_000_000 : undefined
        }
      />
    </Card>
  );
}

function Identity({ symbol, profile }: { symbol: string; profile: FinnhubProfile }) {
  return (
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
  );
}
