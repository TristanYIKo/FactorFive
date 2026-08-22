/**
 * Layout and display primitives.
 *
 * Server components by default - none of these need interactivity, so none of
 * them ship JavaScript. Anything that does need state lives in its own
 * 'use client' file so the boundary stays as small as possible.
 */

import type { ReactNode } from 'react';

type Tone = 'neutral' | 'positive' | 'negative' | 'warning' | 'accent';

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--neutral-soft)', fg: 'var(--neutral)' },
  positive: { bg: 'var(--positive-soft)', fg: 'var(--positive)' },
  negative: { bg: 'var(--negative-soft)', fg: 'var(--negative)' },
  warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)' },
  accent: { bg: 'var(--accent-soft)', fg: 'var(--accent-text)' },
};

export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
}) {
  const { bg, fg } = toneStyles[tone];
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className = '',
  delay = 0,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  /** Stagger the entrance, in ms. */
  delay?: number;
  padded?: boolean;
}) {
  return (
    <section
      className={`ff-rise rounded-[var(--radius-lg)] border ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-sm)',
        ['--delay' as string]: `${delay}ms`,
      }}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
        {hint && (
          <p className="mt-0.5 text-[13px] leading-snug" style={{ color: 'var(--text-tertiary)' }}>
            {hint}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}

/** A labelled statistic. `mono` keeps digits from jittering. */
export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  const colour = tone ? toneStyles[tone].fg : 'var(--text-primary)';
  return (
    <div className="min-w-0">
      <div
        className="text-[11px] font-medium uppercase tracking-wider"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </div>
      <div className="tabular mt-1 truncate text-[15px] font-semibold" style={{ color: colour }}>
        {value}
      </div>
      {sub && (
        <div className="tabular mt-0.5 text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`ff-skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** Empty or unavailable state. Says why, rather than showing a blank box. */
export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div
      className="rounded-[var(--radius-md)] border border-dashed px-4 py-8 text-center"
      style={{ borderColor: 'var(--border-strong)' }}
    >
      <p className="text-[14px] font-medium" style={{ color: 'var(--text-secondary)' }}>
        {title}
      </p>
      {detail && (
        <p className="mx-auto mt-1 max-w-md text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
          {detail}
        </p>
      )}
    </div>
  );
}
