/**
 * Peer distribution detail.
 *
 * Shows the interquartile range of the peer cohort for each metric, the peer
 * median, and where this company sits. The point is that the reader can see
 * the SHAPE of the comparison rather than a single "industry average" number
 * they have no way to sanity-check - which is how the old build ended up
 * reporting a 149% industry revenue growth rate without anyone noticing.
 */

import type { IndustryBenchmarks, FinnhubBasicFinancials, DataQuality } from '@/types/stock';
import { Card, SectionHeading, Badge, EmptyState } from '@/components/ui/Primitives';
import { DistributionStrip } from '@/components/ui/Charts';

const pctFmt = (v: number) => `${v.toFixed(1)}%`;
const numFmt = (v: number) => v.toFixed(1);
/** Percentage points, signed, since the reference is the index. */
const ptsFmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} pts`;

export function PeerBenchmarks({
  benchmarks,
  financials,
  dataQuality,
}: {
  benchmarks?: IndustryBenchmarks;
  financials: FinnhubBasicFinancials | null;
  dataQuality?: DataQuality;
}) {
  if (!benchmarks) return null;

  const d = benchmarks.distributions;
  // The company's values exactly as the score used them: valuation and trend
  // at today's price, everything else from the latest reported figures.
  const s = benchmarks.subject ?? {};

  const rows = [
    { label: 'Revenue growth', dist: d.revenueGrowth, subject: s.revenueGrowth, fmt: pctFmt },
    { label: 'EPS growth', dist: d.epsGrowth, subject: s.epsGrowth, fmt: pctFmt },
    { label: 'Return on equity', dist: d.roe, subject: s.roe, fmt: pctFmt },
    { label: 'Operating margin', dist: d.operatingMargin, subject: s.operatingMargin, fmt: pctFmt },
    { label: 'Net margin', dist: d.netMargin, subject: s.netMargin, fmt: pctFmt },
    { label: 'Debt / equity', dist: d.debtEquity, subject: s.debtEquity, fmt: numFmt },
    { label: 'Current ratio', dist: d.currentRatio, subject: s.currentRatio, fmt: numFmt },
    { label: 'P/E (trailing, at today’s price)', dist: d.pe, subject: s.pe, fmt: numFmt },
    { label: 'P/B (at today’s price)', dist: d.pb, subject: s.pb, fmt: numFmt },
    { label: '12-month return vs S&P 500', dist: d.relative52W, subject: s.relative52W, fmt: ptsFmt },
    { label: '3-month return vs S&P 500', dist: d.relative13W, subject: s.relative13W, fmt: ptsFmt },
    { label: 'Below 52-week high', dist: d.drawdown, subject: s.drawdown, fmt: pctFmt },
  ].filter((r) => r.dist !== null);

  return (
    <Card delay={180}>
      <SectionHeading
        title="Peer distribution"
        hint={
          benchmarks.reliable
            ? `${benchmarks.peerCount} ${benchmarks.industry} peers, ${dataQuality?.peerCohort ?? 'size-filtered'}`
            : 'Too few comparable peers for a reliable benchmark'
        }
        action={
          <Badge tone={benchmarks.reliable ? 'positive' : 'warning'}>
            {benchmarks.reliable ? 'Benchmark sound' : 'Limited data'}
          </Badge>
        }
      />

      {!benchmarks.reliable && dataQuality?.degradedReason && (
        <p className="mb-4 text-[12.5px]" style={{ color: 'var(--warning)' }}>
          {dataQuality.degradedReason}.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="No peer metrics resolved"
          detail="Scores fell back to absolute thresholds rather than an industry comparison."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px]"
            style={{ color: 'var(--text-tertiary)' }}>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-5 rounded-full" style={{ background: 'var(--neutral-soft)' }} />
              middle 50% of peers
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-[2px]" style={{ background: 'var(--text-tertiary)' }} />
              peer median
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--accent)' }} />
              this company
            </span>
          </div>

          <div className="space-y-5">
            {rows.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {row.label}
                  </span>
                  <span className="tabular text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {typeof row.subject === 'number' && Number.isFinite(row.subject)
                      ? row.fmt(row.subject)
                      : '—'}
                  </span>
                </div>
                <DistributionStrip
                  p25={row.dist!.p25}
                  median={row.dist!.median}
                  p75={row.dist!.p75}
                  subject={row.subject}
                  format={row.fmt}
                />
              </div>
            ))}
          </div>

          <p className="mt-5 border-t pt-4 text-[11.5px] leading-relaxed"
            style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}>
            Distributions use medians with winsorized tails, and extreme values are clamped before
            scoring. Percentage metrics on small or loss-making companies routinely exceed several
            hundred percent through base effects, which would otherwise dominate any average.
          </p>
        </>
      )}
    </Card>
  );
}
