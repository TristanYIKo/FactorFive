'use client';

/**
 * Client boundary for the home page's calendar section.
 *
 * Exists purely so the rest of the home page can stay a server component.
 * The old home page marked the entire route 'use client', which meant the
 * hero, the factor cards and the footer all shipped as JavaScript to do
 * nothing but sit still.
 */

import MarketCalendar from '@/components/MarketCalendar';

export function HomeTabs() {
  return <MarketCalendar />;
}
