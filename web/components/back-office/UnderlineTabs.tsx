'use client';

import { cn } from '@/lib/utils';
import { TabsBase } from './tab-parts';
import type { TabsProps } from './tabs-shared';

/**
 * HO-P4 §11.1 — underline-style tabs (Product editor, Administration, Customers). Same props and
 * semantics as `PillTabs`; only the look differs. A strip too wide for the screen scrolls inside
 * itself rather than widening the page.
 */
export function UnderlineTabs({ wrap = false, ...props }: TabsProps & {
  /** Let the tabs wrap onto more rows so every one is visible without a hidden scroll (a short strip such as the customer profile's). */
  wrap?: boolean;
}) {
  return (
    <TabsBase
      {...props}
      containerClass={cn('flex gap-x-1 border-b border-border', wrap ? 'flex-wrap' : 'overflow-x-auto')}
      itemClass={(selected) =>
        cn(
          '-mb-px inline-flex min-h-11 flex-none items-center gap-2 whitespace-nowrap border-b-2 px-4 text-sm font-semibold transition-colors',
          selected
            ? 'border-accent text-accent-ink'
            : 'border-transparent text-ink-muted hover:text-ink',
        )
      }
      countClass={(selected) =>
        cn(
          'rounded-full px-1.5 text-xs font-bold',
          selected ? 'bg-accent-soft text-accent-ink' : 'bg-surface-sunken text-ink-muted',
        )
      }
    />
  );
}
