/**
 * Inline SVG charts.
 *
 * Hand-rolled rather than pulled from a charting library, for three reasons:
 * nothing to download (the whole set costs about 4KB of markup and zero JS),
 * every colour comes from the design tokens so light and dark work for free,
 * and each chart can be shaped to the one job it does here.
 *
 * All of these are server components. Animation is CSS-only, driven by
 * keyframes in globals.css, so there is no client-side animation loop.
 */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------- gauge -- */

/**
 * The headline 0-100 score as a 240-degree arc.
 *
 * The arc is drawn with a stroke-dasharray offset animated purely in CSS, so
 * it sweeps in on load without any JavaScript.
 */
export function ScoreGauge({
  score,
  confidence,
  size = 176,
}: {
  score: number;
  confidence: 'high' | 'medium' | 'low';
  size?: number;
}) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // 240-degree sweep, starting at 150deg (lower-left) and ending at 30deg.
  const sweep = 240;
  const startAngle = 150;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (sweep / 360) * circumference;
  const filled = Math.max(0, Math.min(100, score)) / 100;

  const tone =
    score >= 70 ? 'var(--positive)' : score >= 45 ? 'var(--warning)' : 'var(--negative)';

  const polar = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  const start = polar(startAngle);
  const end = polar(startAngle + sweep);
  const arcPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 1 ${end.x} ${end.y}`;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={`FactorFive score ${score} out of 100, ${confidence} confidence`}>
        {/* track */}
        <path
          d={arcPath}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* value */}
        <path
          d={arcPath}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={arcLength}
          style={{
            animation: `ff-gauge-sweep 1100ms var(--ease-out) 120ms forwards`,
            ['--gauge-target' as string]: `${arcLength * (1 - filled)}`,
          }}
        />
        <style>{`
          @keyframes ff-gauge-sweep {
            to { stroke-dashoffset: ${arcLength * (1 - filled)}; }
          }
        `}</style>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="tabular text-[42px] leading-none font-semibold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {score}
        </div>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-wider"
          style={{ color: 'var(--text-tertiary)' }}>
          of 100
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- factor bar -- */

/**
 * One factor's 0-20 score, with an optional peer-percentile marker.
 *
 * The marker is the important part: the bar says how many points the factor
 * earned, the tick says where the company sits in the peer distribution. They
 * are different questions and the old UI only answered the first.
 */
export function FactorBar({
  label,
  score,
  max = 20,
  percentile,
  colour,
  delay = 0,
}: {
  label: string;
  score: number;
  max?: number;
  percentile?: number | null;
  colour: string;
  delay?: number;
}) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));

  return (
    <div className="ff-fade" style={{ ['--delay' as string]: `${delay}ms` }}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <span className="tabular text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          {score}
          <span style={{ color: 'var(--text-tertiary)' }} className="font-normal">
            /{max}
          </span>
        </span>
      </div>

      <div
        className="relative h-2 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--bg-subtle)' }}
      >
        <div
          className="h-full rounded-full origin-left"
          style={{
            width: `${pct}%`,
            background: colour,
            animation: `ff-grow-x 700ms var(--ease-out) ${delay}ms both`,
          }}
        />
      </div>

      {typeof percentile === 'number' && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="relative h-[3px] flex-1 rounded-full" style={{ background: 'var(--border)' }}>
            <div
              className="absolute top-1/2 h-[9px] w-[2px] -translate-y-1/2 rounded-full"
              style={{ left: `${Math.max(0, Math.min(100, percentile))}%`, background: colour }}
            />
          </div>
          <span className="tabular text-[11px] whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
            {Math.round(percentile)}th pct
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------ diverging bars -- */

/**
 * Excess return versus the index, one bar per window, centred on zero.
 * Bars grow left for underperformance and right for outperformance.
 */
export function DivergingBars({
  items,
  unit = 'pts',
}: {
  items: Array<{ label: string; value: number }>;
  unit?: string;
}) {
  const magnitude = Math.max(1, ...items.map((i) => Math.abs(i.value)));

  return (
    <div className="space-y-2.5">
      {items.map((item, i) => {
        const ratio = Math.abs(item.value) / magnitude;
        const positive = item.value >= 0;
        return (
          <div key={item.label} className="flex items-center gap-3">
            <span
              className="tabular w-9 shrink-0 text-[12px] font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {item.label}
            </span>

            <div className="relative h-6 flex-1">
              {/* zero line */}
              <div
                className="absolute top-0 bottom-0 left-1/2 w-px"
                style={{ background: 'var(--border-strong)' }}
              />
              <div
                className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-[3px]"
                style={{
                  [positive ? 'left' : 'right']: '50%',
                  width: `${ratio * 50}%`,
                  background: positive ? 'var(--positive)' : 'var(--negative)',
                  animation: `ff-grow-x 600ms var(--ease-out) ${i * 70}ms both`,
                  transformOrigin: positive ? 'left' : 'right',
                }}
              />
            </div>

            <span
              className="tabular w-16 shrink-0 text-right text-[12px] font-semibold"
              style={{ color: positive ? 'var(--positive)' : 'var(--negative)' }}
            >
              {positive ? '+' : ''}
              {item.value.toFixed(1)} {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- range --- */

/**
 * Where the current price sits within its 52-week range, or where the
 * company sits within a peer distribution.
 */
export function RangeBar({
  low,
  high,
  current,
  lowLabel,
  highLabel,
  currentLabel,
  markers = [],
}: {
  low: number;
  high: number;
  current: number;
  lowLabel: string;
  highLabel: string;
  currentLabel?: string;
  /** Extra reference points, e.g. the peer median. */
  markers?: Array<{ value: number; label: string }>;
}) {
  const span = high - low;
  const pos = (v: number) => (span > 0 ? Math.max(0, Math.min(100, ((v - low) / span) * 100)) : 50);

  return (
    <div>
      <div
        className="relative h-2 w-full rounded-full"
        style={{
          background: 'linear-gradient(90deg, var(--negative-soft), var(--bg-subtle), var(--positive-soft))',
        }}
      >
        {markers.map((m) => (
          <div
            key={m.label}
            title={`${m.label}: ${m.value.toFixed(2)}`}
            className="absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${pos(m.value)}%`, background: 'var(--text-tertiary)' }}
          />
        ))}
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{
            left: `${pos(current)}%`,
            background: 'var(--accent)',
            borderColor: 'var(--surface)',
            boxShadow: 'var(--shadow-md)',
            transition: `left var(--dur-slow) var(--ease-out)`,
          }}
        />
      </div>

      <div className="tabular mt-2 flex justify-between text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
        <span>{lowLabel}</span>
        {currentLabel && (
          <span className="font-semibold" style={{ color: 'var(--accent-text)' }}>
            {currentLabel}
          </span>
        )}
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ sparkbar -- */

/** Compact distribution strip: p25-p75 box with a median tick and the subject. */
export function DistributionStrip({
  p25,
  median,
  p75,
  subject,
  format,
}: {
  p25: number;
  median: number;
  p75: number;
  subject?: number;
  format: (v: number) => string;
}) {
  const values = [p25, median, p75, subject].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v)
  );
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pos = (v: number) => ((v - lo) / span) * 100;

  // When every peer clamps to the same sanity bound the quartiles collapse and
  // a box plot of a single point is worse than no chart - it looks like a bug.
  // Say what actually happened instead. This is common for EPS growth, where a
  // whole cohort can sit beyond the +150% clamp through base effects.
  const degenerate = p25 === median && median === p75;
  if (degenerate) {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: 'var(--accent)' }} />
        <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
          All peers at or beyond {format(median)} — distribution too concentrated to rank against.
        </span>
      </div>
    );
  }

  return (
    <div>
      <div className="relative h-6">
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          style={{
            left: `${pos(p25)}%`,
            width: `${pos(p75) - pos(p25)}%`,
            background: 'var(--neutral-soft)',
          }}
        />
        <div
          className="absolute top-1/2 h-3 w-[2px] -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pos(median)}%`, background: 'var(--text-tertiary)' }}
          title={`Peer median ${format(median)}`}
        />
        {typeof subject === 'number' && Number.isFinite(subject) && (
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{
              left: `${pos(subject)}%`,
              background: 'var(--accent)',
              borderColor: 'var(--surface)',
            }}
            title={`This company ${format(subject)}`}
          />
        )}
      </div>
      <div className="tabular flex justify-between text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
        <span>{format(p25)}</span>
        <span>median {format(median)}</span>
        <span>{format(p75)}</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- misc --- */

export function DeltaText({ value, suffix = '%' }: { value: number; suffix?: string }): ReactNode {
  const positive = value >= 0;
  return (
    <span
      className="tabular font-semibold"
      style={{ color: positive ? 'var(--positive)' : 'var(--negative)' }}
    >
      {positive ? '▲' : '▼'} {positive ? '+' : ''}
      {value.toFixed(2)}
      {suffix}
    </span>
  );
}
