/**
 * The sections the spec calls for that this data plan cannot fill.
 *
 * Rendered rather than hidden, deliberately. Omitting them would make the
 * product look like it had simply not considered financial statements or
 * charting; naming the endpoint and what it needs turns a gap into a decision
 * the reader can act on.
 */

import { Panel, PanelHeader, NotOnPlan } from '@/components/ui/Dense';

export function StatementsGap() {
  return (
    <Panel>
      <PanelHeader title="Financial statements" />
      <NotOnPlan
        what="Multi-period income statement, balance sheet and cash flow"
        endpoint="/stock/financials-reported"
        detail="Requires a paid Finnhub tier, or parsing SEC EDGAR 10-Q/10-K filings directly. The ratios derived from these statements are already available and shown under Metrics."
      />
    </Panel>
  );
}

export function TechnicalsGap() {
  return (
    <Panel>
      <PanelHeader title="Price action" />
      <NotOnPlan
        what="OHLC candles and volume history"
        endpoint="/stock/candle"
        detail="Needed for candlestick and volume-profile charting. Verify availability on your key before building against it — the 52-week range, relative strength and volatility shown elsewhere come from the metric payload and need no candle data."
      />
    </Panel>
  );
}

export function OwnershipGap() {
  return (
    <Panel>
      <PanelHeader title="Ownership" />
      <NotOnPlan
        what="Institutional holdings and insider transactions"
        endpoint="/institutional-ownership, /stock/insider-transactions"
        detail="Both are premium on Finnhub. SEC Form 13F and Form 4 filings are the free alternative and would need their own ingestion pipeline."
      />
    </Panel>
  );
}
