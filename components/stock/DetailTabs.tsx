'use client';

/**
 * Tab shell for the stock detail view.
 *
 * The only client component in this view. Radix Tabs is used for one reason:
 * roving focus and correct ARIA on a control that carries the page's primary
 * navigation. Panels are passed in as already-rendered server output, so
 * switching tabs is a DOM show/hide with no refetch and no JavaScript cost
 * beyond the tab bar itself.
 *
 * Chose Radix primitives directly over full shadcn/ui. shadcn generates a
 * styled component layer on top of these same primitives, and that layer is
 * tuned for general application UI — comfortable padding, 8px radii, muted
 * foregrounds. Every one of those defaults is the opposite of what a dense
 * data view wants, so it would be restyled to nothing. Three primitives cost
 * ~12kB; the generated layer costs that plus a fight with its own defaults.
 */

import * as Tabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';

export interface TabDef {
  id: string;
  label: string;
  /** Small count or status shown next to the label. */
  badge?: string;
  content: ReactNode;
}

export function DetailTabs({ tabs, defaultTab }: { tabs: TabDef[]; defaultTab?: string }) {
  return (
    <Tabs.Root defaultValue={defaultTab ?? tabs[0]?.id} className="w-full">
      {/* Sticky, horizontally scrollable on narrow screens. `scrollbar-none`
          keeps the rail clean; the fade at the edge signals overflow. */}
      <div
        className="sticky z-20 -mx-4 mb-3 border-b px-4 backdrop-blur-xl sm:-mx-6 sm:px-6"
        style={{
          top: 'var(--topbar-h, 49px)',
          borderColor: 'var(--hairline-strong)',
          background: 'color-mix(in srgb, var(--bg-base) 88%, transparent)',
        }}
      >
        <Tabs.List
          className="flex gap-0.5 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
          aria-label="Stock detail sections"
        >
          {tabs.map((t) => (
            <Tabs.Trigger
              key={t.id}
              value={t.id}
              className="ff-tab group relative flex shrink-0 items-center gap-1.5 px-2.5 py-2 text-[12.5px] font-medium whitespace-nowrap outline-none"
            >
              <span>{t.label}</span>
              {t.badge && (
                <span
                  className="tabular rounded-[var(--radius-sm)] px-1 font-mono text-[10px] leading-[15px]"
                  style={{ background: 'var(--neutral-soft)', color: 'var(--text-tertiary)' }}
                >
                  {t.badge}
                </span>
              )}
              {/* Underline indicator. Transform-only, so it cannot cause layout shift. */}
              <span className="ff-tab-rule pointer-events-none absolute inset-x-1.5 bottom-0 h-[2px] origin-center rounded-full" />
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </div>

      {tabs.map((t) => (
        <Tabs.Content
          key={t.id}
          value={t.id}
          className="ff-tab-panel outline-none"
          // Keep mounted so switching back is instant and scroll position holds.
          forceMount
        >
          {t.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
