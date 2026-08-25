/**
 * Dense data primitives.
 *
 * The vocabulary the stock detail view is built from. Design rules encoded
 * here rather than repeated at each call site:
 *
 *   - Structure comes from 1px hairlines, never from elevation. A data surface
 *     with a drop shadow reads as a card in a template; a terminal reads as a
 *     grid of rules.
 *   - Every numeral is tabular and monospaced, so columns align and figures do
 *     not jitter when they update.
 *   - Labels are 10.5px uppercase with tracking; values are 12.5-13.5px. That
 *     ratio is what lets a panel carry twenty metrics without feeling loud.
 *
 * All server components. None of these ship JavaScript.
 */

import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ panel - */

export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[var(--radius-lg)] border ${className}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--hairline-strong)' }}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-b px-3 py-2"
      style={{ borderColor: 'var(--hairline)' }}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <h3
          className="text-[11.5px] font-semibold tracking-wide uppercase"
          style={{ color: 'var(--text-secondary)' }}
        >
          {title}
        </h3>
        {meta && (
          <span className="truncate text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            {meta}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------- rows - */

/**
 * A label/value row. `mono` is on by default because nearly everything in this
 * app is a figure; prose values opt out.
 */
export function DataRow({
  label,
  value,
  hint,
  tone = 'neutral',
  mono = true,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'muted';
  mono?: boolean;
}) {
  const colour =
    tone === 'positive'
      ? 'var(--positive)'
      : tone === 'negative'
        ? 'var(--negative)'
        : tone === 'muted'
          ? 'var(--text-tertiary)'
          : 'var(--text-primary)';

  return (
    <div
      className="flex items-baseline justify-between gap-3 border-b px-3 py-[7px] last:border-b-0"
      style={{ borderColor: 'var(--hairline)' }}
    >
      <span className="truncate text-[12px]" style={{ color: 'var(--text-tertiary)' }} title={hint}>
        {label}
      </span>
      <span
        className={`shrink-0 text-[12.5px] font-medium ${mono ? 'tabular font-mono' : ''}`}
        style={{ color: colour }}
      >
        {value}
      </span>
    </div>
  );
}

/** Two-column metric grid. Denser than stacked rows, still scannable. */
export function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2"
      style={{ borderColor: 'var(--hairline)' }}
    >
      {children}
    </div>
  );
}

/** A single cell in a MetricGrid — label above value, for scanning down. */
export function MetricCell({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const colour =
    tone === 'positive'
      ? 'var(--positive)'
      : tone === 'negative'
        ? 'var(--negative)'
        : 'var(--text-primary)';

  return (
    <div
      className="border-r border-b px-3 py-2 last:border-r-0"
      style={{ borderColor: 'var(--hairline)' }}
    >
      <div
        className="text-[10.5px] font-medium tracking-[0.07em] uppercase"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </div>
      <div
        className="tabular mt-[3px] font-mono text-[13.5px] leading-none font-semibold"
        style={{ color: colour }}
      >
        {value}
      </div>
      {sub && (
        <div className="tabular mt-[3px] font-mono text-[10.5px]" style={{ color: 'var(--text-tertiary)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- badges - */

/** Compact delta badge. Sign is carried by colour AND glyph, never colour alone. */
export function DeltaBadge({
  value,
  suffix = '%',
  digits = 2,
}: {
  value: number | undefined | null;
  suffix?: string;
  digits?: number;
}) {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return (
      <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
        —
      </span>
    );
  }
  const positive = value >= 0;
  return (
    <span
      className="tabular inline-flex items-center gap-0.5 rounded-[var(--radius-sm)] px-1 py-px font-mono text-[11px] font-semibold"
      style={{
        color: positive ? 'var(--positive)' : 'var(--negative)',
        background: positive ? 'var(--positive-soft)' : 'var(--negative-soft)',
      }}
    >
      {positive ? '▲' : '▼'}
      {positive ? '+' : ''}
      {value.toFixed(digits)}
      {suffix}
    </span>
  );
}

/** Small status pill for categorical state. */
export function Tag({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'accent';
}) {
  const map = {
    neutral: ['var(--neutral-soft)', 'var(--neutral)'],
    positive: ['var(--positive-soft)', 'var(--positive)'],
    negative: ['var(--negative-soft)', 'var(--negative)'],
    warning: ['var(--warning-soft)', 'var(--warning)'],
    accent: ['var(--accent-soft)', 'var(--accent-text)'],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-sm)] px-1.5 py-px text-[10.5px] font-semibold tracking-wide whitespace-nowrap uppercase"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- sparkline - */

/**
 * Inline sparkline. Sized in ems so it sits on the text baseline inside a
 * table row without forcing the row taller.
 */
export function Sparkline({
  values,
  width = 64,
  height = 18,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) {
    return <span style={{ display: 'inline-block', width, height }} aria-hidden="true" />;
  }

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const step = width / (clean.length - 1);

  const points = clean.map((v, i) => `${i * step},${height - ((v - min) / span) * height}`);
  const rising = clean[clean.length - 1] >= clean[0];
  const stroke = rising ? 'var(--positive)' : 'var(--negative)';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible align-middle"
      role="img"
      aria-label={`Trend, ${rising ? 'rising' : 'falling'}`}
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Emphasised endpoint — the value the reader actually wants. */}
      <circle cx={(clean.length - 1) * step} cy={points[points.length - 1].split(',')[1]} r="1.75" fill={stroke} />
    </svg>
  );
}

/* -------------------------------------------------------- unavailable data - */

/**
 * States plainly that a dataset is not on the current plan.
 *
 * Deliberately a first-class component. The alternative — hiding sections the
 * data cannot fill — produces a UI that silently claims less coverage than it
 * has, and hides the reason. Naming the endpoint makes the gap actionable.
 */
export function NotOnPlan({
  what,
  endpoint,
  detail,
}: {
  what: string;
  endpoint?: string;
  detail?: string;
}) {
  return (
    <div className="px-3 py-6 text-center">
      <p className="text-[12.5px] font-medium" style={{ color: 'var(--text-secondary)' }}>
        {what} is not available on this data plan
      </p>
      {endpoint && (
        <p className="tabular mt-1 font-mono text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          {endpoint}
        </p>
      )}
      {detail && (
        <p className="mx-auto mt-1.5 max-w-sm text-[11.5px] leading-snug" style={{ color: 'var(--text-tertiary)' }}>
          {detail}
        </p>
      )}
    </div>
  );
}
