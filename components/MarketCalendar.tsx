'use client';

/**
 * Market calendar.
 *
 * Presentational only. Events are fetched on the server and passed in, because
 * macro release dates now come from FRED and the API key must not reach the
 * browser.
 *
 * Every event displays its provenance — the agency that publishes it, or the
 * rule that defines it. Nothing on this calendar is inferred, so nothing needs
 * an "estimated" caveat.
 */

import { useMemo, useState } from 'react';
import {
  indexByDate,
  dateKey,
  toLocalDate,
  type CalendarResult,
  type MarketEvent,
} from '@/lib/marketCalendar';

const CATEGORY_COLOUR: Record<MarketEvent['category'], string> = {
  'Economic Data': 'var(--factor-growth)',
  'Market Structure': 'var(--factor-quality)',
  Holiday: 'var(--neutral)',
};

const IMPACT_TONE: Record<MarketEvent['impact'], string> = {
  high: 'var(--negative)',
  medium: 'var(--warning)',
  low: 'var(--neutral)',
};

const IMPACT_LABEL: Record<MarketEvent['impact'], string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function sourceLabel(source: MarketEvent['source']): string {
  return source.kind === 'published'
    ? `${source.agency}, via ${source.via}`
    : source.rule;
}

export default function MarketCalendar({
  events,
  macro,
}: {
  events: MarketEvent[];
  macro: CalendarResult['macro'];
}) {
  const [view, setView] = useState<'upcoming' | 'month'>('upcoming');
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);

  const today = useMemo(() => dateKey(new Date()), []);

  // Indexed once per event-set, not once per cell. The previous version filtered
  // the full array inside the grid map: 42 linear scans on every render.
  const byDate = useMemo(() => indexByDate(events), [events]);

  const upcoming = useMemo(
    () => events.filter((e) => e.date >= today).slice(0, 14),
    [events, today]
  );

  const monthGrid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const startPad = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<Date | null> = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [cursor]);

  const selectedEvents = selected ? (byDate.get(selected) ?? []) : [];

  if (events.length === 0) {
    return (
      <section
        className="rounded-[var(--radius-lg)] border p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Market calendar
        </h2>
        <p className="mt-2 text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
          No events could be loaded. Macro release dates come from FRED, so this is usually a
          missing or rejected <code>FRED_API_KEY</code>.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-[var(--radius-lg)] border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <header
        className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Market calendar
          </h2>
          <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--text-tertiary)' }}>
            Scheduled economic releases, market holidays and options expirations
          </p>
        </div>

        <div
          className="inline-flex rounded-[var(--radius-md)] border p-0.5"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-subtle)' }}
        >
          {(['upcoming', 'month'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium capitalize transition-all"
              style={
                view === v
                  ? { background: 'var(--surface)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }
                  : { color: 'var(--text-tertiary)' }
              }
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      {/* Holidays and options expirations are computed locally and always
          succeed, so a missing FRED key yields a calendar that looks populated
          while every economic release is quietly absent. Say so explicitly. */}
      {macro.status !== 'ok' && (
        <div
          className="border-b px-5 py-3"
          style={{ borderColor: 'var(--border)', background: 'var(--warning-soft)' }}
        >
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--warning)' }}>
            Economic releases are not being shown
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
            {macro.status === 'not-configured'
              ? 'FRED_API_KEY is not set on this deployment, so CPI, PCE, payrolls and the other agency releases cannot be loaded. Holidays and options expirations below are computed locally and remain accurate.'
              : 'FRED could not be reached, so agency release dates are temporarily unavailable. Holidays and options expirations below are computed locally and remain accurate.'}
          </p>
        </div>
      )}

      {view === 'upcoming' ? (
        <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {upcoming.map((event, i) => {
            const d = toLocalDate(event.date);
            return (
              <li
                key={event.id}
                className="ff-fade flex items-start gap-4 px-5 py-3.5"
                style={{ ['--delay' as string]: `${Math.min(i, 10) * 40}ms` }}
              >
                <div className="w-12 shrink-0 text-center">
                  <div
                    className="text-[10.5px] font-medium uppercase tracking-wide"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {d.toLocaleDateString('en-US', { month: 'short' })}
                  </div>
                  <div
                    className="tabular text-[19px] leading-tight font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {d.getDate()}
                  </div>
                </div>

                <span
                  className="mt-2 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: CATEGORY_COLOUR[event.category] }}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>
                      {event.title}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        color: IMPACT_TONE[event.impact],
                        background: `color-mix(in srgb, ${IMPACT_TONE[event.impact]} 13%, transparent)`,
                      }}
                    >
                      {IMPACT_LABEL[event.impact]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                    {event.description}
                  </p>
                  <a
                    href={event.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-[11.5px] underline-offset-2 hover:underline"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {sourceLabel(event.source)}
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="rounded-[var(--radius-sm)] border px-2.5 py-1 text-[13px] transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              aria-label="Previous month"
            >
              ←
            </button>
            <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="rounded-[var(--radius-sm)] border px-2.5 py-1 text-[13px] transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              aria-label="Next month"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d, i) => (
              <div
                key={i}
                className="pb-1.5 text-center text-[11px] font-medium"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {d}
              </div>
            ))}

            {monthGrid.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} />;
              const key = dateKey(day);
              const dayEvents = byDate.get(key) ?? [];
              const isToday = key === today;
              const isSelected = key === selected;

              return (
                <button
                  key={key}
                  onClick={() => setSelected(isSelected ? null : key)}
                  className="relative aspect-square rounded-[var(--radius-sm)] border p-1 text-[12.5px] transition-all hover:-translate-y-px"
                  style={{
                    borderColor: isSelected ? 'var(--accent)' : 'transparent',
                    background: isToday ? 'var(--accent-soft)' : 'transparent',
                    color: isToday ? 'var(--accent-text)' : 'var(--text-secondary)',
                    fontWeight: isToday ? 600 : 400,
                  }}
                >
                  {day.getDate()}
                  {dayEvents.length > 0 && (
                    <span className="absolute inset-x-0 bottom-1 flex justify-center gap-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className="h-1 w-1 rounded-full"
                          style={{ background: CATEGORY_COLOUR[e.category] }}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="ff-fade mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <h3 className="mb-2 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {toLocalDate(selected).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>
              {selectedEvents.length === 0 ? (
                <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
                  No scheduled events.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {selectedEvents.map((e) => (
                    <li key={e.id} className="flex items-start gap-2.5">
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: CATEGORY_COLOUR[e.category] }}
                      />
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                          {e.title}
                        </p>
                        <p className="text-[12.5px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                          {e.description}
                        </p>
                        <a
                          href={e.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-block text-[11.5px] underline-offset-2 hover:underline"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          {sourceLabel(e.source)}
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <footer
        className="border-t px-5 py-3 text-[11.5px]"
        style={{ borderColor: 'var(--border)', color: 'var(--text-tertiary)' }}
      >
        Economic release dates published by the source agencies via FRED. Holidays and options
        expirations computed from the exchange rules that define them. No dates are estimated.
      </footer>
    </section>
  );
}
