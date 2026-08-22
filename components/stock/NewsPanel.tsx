/**
 * News with sentiment, and the analyst consensus bar.
 *
 * Both read from data the page already has, so neither costs an extra request.
 */

import type {
  FinnhubNewsArticle,
  NewsAPIArticle,
  SentimentAnalysis,
  FinnhubRecommendationTrend,
} from '@/types/stock';
import { Card, SectionHeading, Badge, EmptyState } from '@/components/ui/Primitives';

function relativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function SentimentPanel({
  sentiment,
  articles,
}: {
  sentiment?: SentimentAnalysis;
  articles?: NewsAPIArticle[];
}) {
  if (!sentiment || !articles?.length) return null;

  const total = sentiment.totalArticles || 1;
  const segments = [
    { label: 'Positive', count: sentiment.positiveCount, colour: 'var(--positive)' },
    { label: 'Neutral', count: sentiment.neutralCount, colour: 'var(--neutral)' },
    { label: 'Negative', count: sentiment.negativeCount, colour: 'var(--negative)' },
  ];

  const avg = sentiment.averageSentiment;
  const tone = avg > 0.15 ? 'positive' : avg < -0.15 ? 'negative' : 'neutral';
  const label = avg > 0.15 ? 'Net positive' : avg < -0.15 ? 'Net negative' : 'Mixed';

  return (
    <Card delay={240}>
      <SectionHeading
        title="News sentiment"
        hint={`Across ${sentiment.totalArticles} recent articles`}
        action={<Badge tone={tone}>{label}</Badge>}
      />

      <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--bg-subtle)' }}>
        {segments.map((s, i) => (
          <div
            key={s.label}
            style={{
              width: `${(s.count / total) * 100}%`,
              background: s.colour,
              animation: `ff-grow-x 600ms var(--ease-out) ${i * 90}ms both`,
              transformOrigin: 'left',
            }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
            <span className="h-2 w-2 rounded-full" style={{ background: s.colour }} />
            {s.label} <span className="tabular font-semibold" style={{ color: 'var(--text-secondary)' }}>{s.count}</span>
          </span>
        ))}
      </div>
    </Card>
  );
}

export function AnalystPanel({ recommendations }: { recommendations: FinnhubRecommendationTrend[] }) {
  const latest = recommendations?.[0];
  if (!latest) return null;

  const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
  if (total === 0) return null;

  const segments = [
    { label: 'Strong buy', count: latest.strongBuy, colour: 'var(--positive)' },
    { label: 'Buy', count: latest.buy, colour: 'color-mix(in srgb, var(--positive) 60%, var(--surface))' },
    { label: 'Hold', count: latest.hold, colour: 'var(--neutral)' },
    { label: 'Sell', count: latest.sell, colour: 'color-mix(in srgb, var(--negative) 60%, var(--surface))' },
    { label: 'Strong sell', count: latest.strongSell, colour: 'var(--negative)' },
  ];

  const bullish = latest.strongBuy + latest.buy;
  const bullishPct = Math.round((bullish / total) * 100);

  return (
    <Card delay={280}>
      <SectionHeading
        title="Analyst consensus"
        hint={`${total} analysts · as of ${latest.period}`}
        action={
          <Badge tone={bullishPct >= 60 ? 'positive' : bullishPct >= 40 ? 'warning' : 'negative'}>
            {bullishPct}% bullish
          </Badge>
        }
      />

      <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--bg-subtle)' }}>
        {segments.map((s, i) =>
          s.count > 0 ? (
            <div
              key={s.label}
              style={{
                width: `${(s.count / total) * 100}%`,
                background: s.colour,
                animation: `ff-grow-x 600ms var(--ease-out) ${i * 70}ms both`,
                transformOrigin: 'left',
              }}
              title={`${s.label}: ${s.count}`}
            />
          ) : null
        )}
      </div>

      {/* Wrapping flex rather than a fixed 5-column grid: in the narrow
          sidebar those columns were ~60px wide and truncated every label to
          "St… 13". */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
        {segments.map((s) => (
          <span
            key={s.label}
            className="flex items-center gap-1.5 whitespace-nowrap"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.colour }} />
            {s.label}
            <span className="tabular font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {s.count}
            </span>
          </span>
        ))}
      </div>
    </Card>
  );
}

export function NewsPanel({ news }: { news: FinnhubNewsArticle[] }) {
  return (
    <Card delay={320}>
      <SectionHeading title="Recent news" hint="Last 14 days" />

      {news.length === 0 ? (
        <EmptyState title="No recent headlines" detail="Nothing was published for this symbol in the last 14 days." />
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {news.map((article) => (
            <li key={article.id ?? article.url}>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block py-3.5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p
                      className="text-[14px] leading-snug font-medium transition-colors group-hover:underline"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {article.headline}
                    </p>
                    <p className="mt-1 text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                      {article.source}
                      {article.datetime ? ` · ${relativeTime(new Date(article.datetime * 1000))}` : ''}
                    </p>
                  </div>
                  <span
                    className="mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: 'var(--text-tertiary)' }}
                    aria-hidden="true"
                  >
                    ↗
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
