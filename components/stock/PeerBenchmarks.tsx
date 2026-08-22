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

  const m = financials?.metric;
  const d = benchmarks.distributions;

  const rows = [
    { label: 'Revenue growth', dist: d.revenueGrowth, subject: m?.revenueGrowthQuarterlyYoy ?? m?.revenueGrowthAnnual, fmt: pctFmt },
    { label: 'EPS growth', dist: d.epsGrowth, subject: m?.epsGrowthQuarterlyYoy ?? m?.epsGrowthAnnual, fmt: pctFmt },
    { label: 'Return on equity', dist: d.roe, subject: m?.roeRfy, fmt: pctFmt },
    { label: 'Net margin', dist: d.netMargin, subject: m?.netProfitMarginAnnual, fmt: pctFmt },
    { label: 'Operating margin', dist: d.operatingMargin, subject: m?.operatingMarginAnnual, fmt: pctFmt },
    { label: 'P/E ratio', dist: d.pe, subject: m?.peNormalizedAnnual, fmt: numFmt },
    { label: 'P/B ratio', dist: d.pb, subject: m?.pbAnnual, fmt: numFmt },
    { label: 'Debt / equity', dist: d.debtEquity, subject: m?.debtEquityAnnual, fmt: numFmt },
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
