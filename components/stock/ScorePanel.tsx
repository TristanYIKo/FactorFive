/**
 * The headline score and its five factors.
 *
 * Design intent: the number is the hero, but it never appears without the
 * evidence behind it. Confidence, peer count and cohort quality sit directly
 * beside the score rather than buried in a tooltip, because the failure this
 * rebuild fixed was precisely a confident number with nothing underneath it.
 */

import type { ScoreBreakdown, DataQuality } from '@/types/stock';
import { Card, Badge, SectionHeading } from '@/components/ui/Primitives';
import { ScoreGauge, FactorBar } from '@/components/ui/Charts';

const FACTORS = [
  { key: 'growth', label: 'Growth', colour: 'var(--factor-growth)' },
  { key: 'profitability', label: 'Profitability', colour: 'var(--factor-profitability)' },
  { key: 'valuation', label: 'Valuation', colour: 'var(--factor-valuation)' },
  { key: 'quality', label: 'Quality', colour: 'var(--factor-quality)' },
  { key: 'analyst', label: 'Analyst', colour: 'var(--factor-analyst)' },
] as const;

function verdict(score: number): { text: string; tone: 'positive' | 'warning' | 'negative' } {
  if (score >= 75) return { text: 'Strong', tone: 'positive' };
  if (score >= 60) return { text: 'Solid', tone: 'positive' };
  if (score >= 45) return { text: 'Mixed', tone: 'warning' };
  if (score >= 30) return { text: 'Weak', tone: 'negative' };
  return { text: 'Poor', tone: 'negative' };
}

const CONFIDENCE_COPY = {
  high: { label: 'High confidence', tone: 'positive' as const },
  medium: { label: 'Medium confidence', tone: 'warning' as const },
  low: { label: 'Low confidence', tone: 'negative' as const },
};

export function ScorePanel({
  score,
  breakdown,
  dataQuality,
}: {
  score: number;
  breakdown: ScoreBreakdown;
  dataQuality?: DataQuality;
}) {
  const v = verdict(score);
  const conf = CONFIDENCE_COPY[breakdown.confidence];

  const scores: Record<string, number> = {
    growth: breakdown.growthScore,
    profitability: breakdown.profitabilityScore,
    valuation: breakdown.valuationScore,
    quality: breakdown.qualityScore,
    analyst: breakdown.analystScore,
  };

  return (
    <Card delay={60}>
      <SectionHeading
        title="FactorFive score"
        hint={breakdown.description}
        action={
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge tone={v.tone}>{v.text}</Badge>
            <Badge tone={conf.tone}>{conf.label}</Badge>
          </div>
        }
      />

      <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:gap-8">
        <div className="flex flex-col items-center justify-center">
          <ScoreGauge score={score} confidence={breakdown.confidence} />
          {dataQuality && (
            <p className="mt-2 text-center text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              {dataQuality.peersResolved > 0
                ? `${dataQuality.peersResolved} peers · ${dataQuality.peerCohort}`
                : 'No peer comparison available'}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {FACTORS.map((f, i) => (
            <FactorBar
              key={f.key}
              label={f.label}
              score={scores[f.key]}
              percentile={breakdown.peerContext.percentileRanks[f.key]}
              colour={f.colour}
              delay={140 + i * 70}
            />
          ))}
        </div>
      </div>

      {/* Per-factor evidence. Each line states the company's number and the
          peer median it was measured against. */}
      <div className="mt-6 space-y-2.5 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
        {FACTORS.map((f) => (
          <div key={f.key} className="flex gap-3">
            <span
              className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: f.colour }}
            />
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {f.label}.
              </span>{' '}
              {breakdown.details[f.key]}
            </p>
          </div>
        ))}
      </div>

      {breakdown.caveats.length > 0 && (
        <div
          className="mt-5 rounded-[var(--radius-md)] border px-4 py-3"
          style={{ borderColor: 'var(--warning)', background: 'var(--warning-soft)' }}
        >
          <p className="text-[12px] font-semibold" style={{ color: 'var(--warning)' }}>
            What this score could not account for
          </p>
          <ul className="mt-1.5 space-y-1">
            {breakdown.caveats.map((c) => (
              <li key={c} className="text-[12.5px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
