/**
 * Core metrics, valuation, profitability, balance sheet and returns.
 *
 * Every figure here comes from the `/stock/metric` payload the app already
 * fetches and caches for 12 hours, so the whole tab costs zero additional
 * upstream calls. That payload carries 133 fields; the job is selection, not
 * acquisition.
 */

import type { FinnhubBasicFinancials, FinnhubProfile } from '@/types/stock';
import { Panel, PanelHeader, MetricGrid, MetricCell, DataRow } from '@/components/ui/Dense';
import { formatCurrency } from '@/lib/formatters';

type Metric = NonNullable<FinnhubBasicFinancials>['metric'];

const n = (v: number | undefined, digits = 2, suffix = '') =>
  v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(digits)}${suffix}`;

const pct = (v: number | undefined, digits = 1) =>
  v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(digits)}%`;

export function CoreMetrics({
  financials,
  profile,
}: {
  financials: FinnhubBasicFinancials | null;
  profile: FinnhubProfile;
}) {
  const m = (financials?.metric ?? {}) as Metric & Record<string, number | undefined>;
  const marketCap = profile.marketCapitalization
    ? profile.marketCapitalization * 1_000_000
    : undefined;

  return (
    <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
      <Panel>
        <PanelHeader title="Size &amp; valuation" meta="trailing twelve months unless noted" />
        <MetricGrid>
          <MetricCell label="Market cap" value={marketCap ? formatCurrency(marketCap) : '—'} />
          <MetricCell
            label="Enterprise value"
            value={m.enterpriseValue ? formatCurrency(m.enterpriseValue * 1_000_000) : '—'}
          />
          <MetricCell label="P/E (normalised)" value={n(m.peNormalizedAnnual)} sub="annual" />
          <MetricCell label="EV / EBITDA" value={n(m['evEbitdaTTM'])} sub="TTM" />
          <MetricCell label="Price / sales" value={n(m['psTTM'])} sub="TTM" />
          <MetricCell label="Price / book" value={n(m.pbAnnual)} sub="annual" />
          <MetricCell label="EV / FCF" value={n(m['currentEv/freeCashFlowTTM'])} sub="TTM" />
          <MetricCell label="PEG" value={n(m.pegAnnual)} sub="annual" />
        </MetricGrid>
      </Panel>

      <Panel>
        <PanelHeader title="Profitability" />
        <MetricGrid>
          <MetricCell label="Gross margin" value={pct(m['grossMarginTTM'])} sub="TTM" />
          <MetricCell label="Operating margin" value={pct(m.operatingMarginAnnual)} sub="annual" />
          <MetricCell label="Net margin" value={pct(m.netProfitMarginAnnual)} sub="annual" />
          <MetricCell label="Return on equity" value={pct(m.roeRfy)} sub="RFY" />
          <MetricCell label="Return on assets" value={pct(m.roaRfy)} sub="RFY" />
          <MetricCell label="Return on invested cap" value={pct(m['roiAnnual'])} sub="annual" />
        </MetricGrid>
      </Panel>

      <Panel>
        <PanelHeader title="Balance sheet &amp; liquidity" />
        <div>
          <DataRow label="Debt / equity" value={n(m.debtEquityAnnual)} />
          <DataRow label="Current ratio" value={n(m.currentRatioAnnual)} />
          <DataRow label="Quick ratio" value={n(m.quickRatioAnnual)} />
          <DataRow label="Long-term debt / equity" value={n(m['longTermDebt/equityAnnual'])} />
          <DataRow label="Net interest coverage" value={n(m['netInterestCoverageAnnual'])} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Risk &amp; distribution" />
        <div>
          <DataRow label="Beta" value={n(m.beta)} hint="Sensitivity to index moves" />
          <DataRow
            label="Volatility (3M, annualised)"
            value={pct(m['3MonthADReturnStd'], 0)}
          />
          <DataRow label="52-week high" value={m['52WeekHigh'] ? `$${n(m['52WeekHigh'])}` : '—'} />
          <DataRow label="52-week low" value={m['52WeekLow'] ? `$${n(m['52WeekLow'])}` : '—'} />
          <DataRow
            label="Dividend yield"
            value={pct(m['dividendYieldIndicatedAnnual'], 2)}
            hint="Indicated annual"
          />
          <DataRow
            label="Shares outstanding"
            value={profile.shareOutstanding ? `${profile.shareOutstanding.toFixed(0)}M` : '—'}
          />
        </div>
      </Panel>
    </div>
  );
}
