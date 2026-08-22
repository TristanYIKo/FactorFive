'use client';

/**
 * Market calendar.
 *
 * Events come from lib/marketCalendar.ts, which derives them from agency
 * release rules relative to today rather than a hardcoded list. Dates that
 * follow a firm rule are labelled "scheduled"; ones that follow the usual
 * pattern but should be confirmed are labelled "estimated" and link to the
 * authoritative source. The previous UI presented a hardcoded 2025 list with
 * no such distinction.
 */

import { useMemo, useState } from 'react';
import {
  generateMarketCalendar,
  getEventsForDate,
  type MarketEvent,
} from '@/lib/marketCalendar';

const CATEGORY_COLOUR: Record<MarketEvent['category'], string> = {
  FOMC: 'var(--factor-quality)',
  'Economic Data': 'var(--factor-growth)',
  'Earnings Season': 'var(--factor-profitability)',
  Holiday: 'var(--neutral)',
  Other: 'var(--neutral)',
};

const IMPACT_TONE: Record<MarketEvent['impact'], string> = {
  High: 'var(--negative)',
  Medium: 'var(--warning)',
  Low: 'var(--neutral)',
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function MarketCalendar() {
  const events = useMemo(() => generateMarketCalendar(), []);
  const [view, setView] = useState<'upcoming' | 'month'>('upcoming');
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<Date | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const upcoming = useMemo(
    () => events.filter((e) => e.date >= today).slice(0, 12),
    [events, today]
  );

  const monthGrid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<Date | null> = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [cursor]);

  const selectedEvents = selected ? getEventsForDate(events, selected) : [];

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
            Fed decisions, economic releases and market holidays
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

      {view === 'upcoming' ? (
        <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {upcoming.map((event, i) => (
            <li
              key={event.id}
              className="ff-fade flex items-start gap-4 px-5 py-3.5"
              style={{ ['--delay' as string]: `${i * 40}ms` }}
            >
              <div className="w-12 shrink-0 text-center">
                <div
                  className="text-[10.5px] font-medium uppercase tracking-wide"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {event.date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })}
                </div>
                <div className="tabular text-[19px] leading-tight font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {event.date.getUTCDate()}
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
                    {event.impact}
                  </span>
                  {event.confidence === 'estimated' && (
                    <span
                      className="text-[10.5px]"
                      style={{ color: 'var(--text-tertiary)' }}
                      title="Follows the usual release pattern; confirm the exact date with the source."
                    >
                      estimated
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  {event.description}
                </p>
                <div className="mt-1 flex items-center gap-3">
                  {event.time && (
                    <span className="tabular text-[11.5px]" style={{ color: 'var(--text-tertiary)' }}>
                      {event.time}
                    </span>
                  )}
                  {event.source && (
                    <a
                      href={event.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11.5px] underline-offset-2 hover:underline"
                      style={{ color: 'var(--accent-text)' }}
                    >
                      source
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
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
              const dayEvents = getEventsForDate(events, day);
              const isToday = sameDay(day, today);
              const isSelected = selected && sameDay(day, selected);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelected(isSelected ? null : day)}
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
                {selected.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              {selectedEvents.length === 0 ? (
                <p className="text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
                  No scheduled events.
                </p>
              ) : (
                <ul className="space-y-2">
                  {selectedEvents.map((e) => (
                    <li key={e.id} className="flex items-start gap-2.5">
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: CATEGORY_COLOUR[e.category] }}
                      />
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                          {e.title}
                          {e.time && (
                            <span className="tabular ml-2 font-normal" style={{ color: 'var(--text-tertiary)' }}>
                              {e.time}
                            </span>
                          )}
                        </p>
                        <p className="text-[12.5px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                          {e.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
