/**
 * Market and risk context.
 *
 * This panel answers the question the five factors cannot: how does this
 * company sit against the market it actually trades in, and how much risk did
 * shareholders carry to get that result.
 */

import type { MarketContext } from '@/types/stock';
import { describeBeta } from '@/lib/marketContext';
import { Card, Badge, SectionHeading, Stat, EmptyState } from '@/components/ui/Primitives';
import { DivergingBars, RangeBar } from '@/components/ui/Charts';

function regimeTone(label: string): 'positive' | 'warning' | 'negative' | 'neutral' {
  if (label.includes('strong') || label.includes('Strong')) return 'positive';
  if (label.includes('Risk-off')) return 'negative';
  if (label.includes('Cooling') || label.includes('Range')) return 'warning';
  return 'neutral';
}

export function MarketContextPanel({ context }: { context?: MarketContext }) {
  if (!context) {
    return (
      <Card delay={120}>
        <SectionHeading title="Market context" />
        <EmptyState
          title="Market context unavailable"
          detail="Broad-market data could not be retrieved for this request."
        />
      </Card>
    );
  }

  const { regime, relativeStrength, risk, scenarios, insights } = context;

  return (
    <Card delay={120}>
      <SectionHeading
        title="Market context"
        hint={`Measured against ${regime.proxy} as an S&P 500 proxy`}
        action={<Badge tone={regimeTone(regime.label)}>{regime.label}</Badge>}
      />

      <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {regime.description}
      </p>

      {/* Generated observations - each states a number and what it implies. */}
      {insights.length > 0 && (
        <ul className="mt-4 space-y-2">
          {insights.map((insight, i) => (
            <li
              key={insight}
              className="ff-fade flex gap-2.5 text-[13px] leading-relaxed"
              style={{ color: 'var(--text-secondary)', ['--delay' as string]: `${200 + i * 80}ms` }}
            >
              <span style={{ color: 'var(--accent-text)' }}>—</span>
              {insight}
            </li>
          ))}
        </ul>
      )}

      {relativeStrength.length > 0 && (
        <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
          <h3 className="mb-1 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Relative strength vs S&amp;P 500
          </h3>
          <p className="mb-3.5 text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
            Excess return in percentage points. Right of the line is beating the index.
          </p>
          <DivergingBars items={relativeStrength.map((r) => ({ label: r.window, value: r.excessReturn }))} />
        </div>
      )}

      <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
        <h3 className="mb-3 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Risk profile
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Beta"
            value={risk.beta !== undefined ? risk.beta.toFixed(2) : '—'}
            // Shared banding, so this label can never disagree with the
            // narrative insight rendered a few lines above it.
            sub={risk.beta === undefined ? undefined : describeBeta(risk.beta)}
          />
          <Stat
            label="Volatility"
            value={risk.volatility !== undefined ? `${risk.volatility.toFixed(0)}%` : '—'}
            sub="annualised"
          />
          <Stat
            label="Return / risk"
            value={risk.returnPerUnitRisk !== undefined ? risk.returnPerUnitRisk.toFixed(2) : '—'}
            sub="per 1% volatility"
            tone={
              risk.returnPerUnitRisk === undefined
                ? undefined
                : risk.returnPerUnitRisk > 1
                  ? 'positive'
                  : risk.returnPerUnitRisk < 0
                    ? 'negative'
                    : 'warning'
            }
          />
          <Stat
            label="Off 52w high"
            value={risk.drawdownFromHigh !== undefined ? `${risk.drawdownFromHigh.toFixed(1)}%` : '—'}
            sub="drawdown"
          />
        </div>
      </div>

      {scenarios && (
        <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
          <h3 className="mb-1 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Twelve-month volatility range
          </h3>
          <p className="mb-4 text-[12px] leading-snug" style={{ color: 'var(--text-tertiary)' }}>
            {scenarios.basis}
          </p>
          <RangeBar
            low={scenarios.bear}
            high={scenarios.bull}
            current={scenarios.current}
            lowLabel={`$${scenarios.bear.toFixed(2)}`}
            highLabel={`$${scenarios.bull.toFixed(2)}`}
            currentLabel={`now $${scenarios.current.toFixed(2)}`}
          />
        </div>
      )}
    </Card>
  );
}
