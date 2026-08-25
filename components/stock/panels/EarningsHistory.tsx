/**
 * Reported earnings: estimate, actual, surprise, and the beat/miss record.
 *
 * From `/stock/earnings`, which is history rather than schedule — every row is
 * a reported fact, so unlike the forward earnings calendar there is no
 * confirmed-versus-estimated ambiguity to disclose.
 */

import type { EarningsSurprise } from '@/types/stock';
import { Panel, PanelHeader, Tag, DeltaBadge, Sparkline, NotOnPlan } from '@/components/ui/Dense';

function quarterLabel(row: EarningsSurprise): string {
  return `Q${row.quarter} ${row.year}`;
}

export function EarningsHistory({ history }: { history?: EarningsSurprise[] }) {
  if (!history || history.length === 0) {
    return (
      <Panel>
        <PanelHeader title="Earnings history" />
        <NotOnPlan
          what="Reported earnings history"
          endpoint="/stock/earnings"
          detail="No reported quarters were returned for this symbol."
        />
      </Panel>
    );
  }

  // Oldest first for the trend line; the table stays newest first.
  const chronological = [...history].reverse();
  const actuals = chronological
    .map((r) => r.actual)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  const scored = history.filter((r) => typeof r.surprisePercent === 'number');
  const beats = scored.filter((r) => (r.surprisePercent ?? 0) > 0).length;
  const misses = scored.filter((r) => (r.surprisePercent ?? 0) < 0).length;

  return (
    <Panel>
      <PanelHeader
        title="Earnings history"
        meta={`${history.length} reported quarters`}
        action={
          scored.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <Tag tone="positive">{beats} beat</Tag>
              {misses > 0 && <Tag tone="negative">{misses} miss</Tag>}
            </div>
          ) : undefined
        }
      />

      {actuals.length >= 2 && (
        <div
          className="flex items-center justify-between border-b px-3 py-2"
          style={{ borderColor: 'var(--hairline)' }}
        >
          <span
            className="text-[10.5px] font-medium tracking-[0.07em] uppercase"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Reported EPS trend
          </span>
          <Sparkline values={actuals} width={120} height={22} />
        </div>
      )}

      {/* Horizontal scroll is on the table's own container, so the page body
          never scrolls sideways on a narrow screen. */}
      <div className="ff-rail overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse">
          <thead>
            <tr>
              {['Quarter', 'Period', 'Estimate', 'Actual', 'Surprise'].map((h, i) => (
                <th
                  key={h}
                  className={`border-b px-3 py-1.5 text-[10.5px] font-semibold tracking-[0.07em] uppercase ${
                    i === 0 || i === 1 ? 'text-left' : 'text-right'
                  }`}
                  style={{ borderColor: 'var(--hairline)', color: 'var(--text-tertiary)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((row) => {
              const surprise = row.surprisePercent;
              return (
                <tr key={`${row.year}-${row.quarter}-${row.period}`} className="ff-row">
                  <td
                    className="tabular border-b px-3 py-[7px] font-mono text-[12px] font-medium"
                    style={{ borderColor: 'var(--hairline)', color: 'var(--text-primary)' }}
                  >
                    {quarterLabel(row)}
                  </td>
                  <td
                    className="tabular border-b px-3 py-[7px] font-mono text-[11.5px]"
                    style={{ borderColor: 'var(--hairline)', color: 'var(--text-tertiary)' }}
                  >
                    {row.period}
                  </td>
                  <td
                    className="tabular border-b px-3 py-[7px] text-right font-mono text-[12px]"
                    style={{ borderColor: 'var(--hairline)', color: 'var(--text-secondary)' }}
                  >
                    {typeof row.estimate === 'number' ? row.estimate.toFixed(2) : '—'}
                  </td>
                  <td
                    className="tabular border-b px-3 py-[7px] text-right font-mono text-[12px] font-semibold"
                    style={{ borderColor: 'var(--hairline)', color: 'var(--text-primary)' }}
                  >
                    {typeof row.actual === 'number' ? row.actual.toFixed(2) : '—'}
                  </td>
                  <td
                    className="border-b px-3 py-[7px] text-right"
                    style={{ borderColor: 'var(--hairline)' }}
                  >
                    <DeltaBadge value={surprise} digits={1} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
