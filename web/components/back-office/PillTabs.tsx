'use client';

import { cn } from '@/lib/utils';
import { TabsBase } from './tab-parts';
import type { TabsProps } from './tabs-shared';

export type { TabItem, TabsProps } from './tabs-shared';

/**
 * HO-P4 §11.1 — pill-shaped tabs. `mode="state"` switches a view on one route (`role=tablist`,
 * `aria-selected`); `mode="link"` is a route section nav (`<nav aria-label>` + links with
 * `aria-current="page"`). The selected pill is the banana-leaf `bg-leaf-ink text-leaf-soft`.
 * A `count` shows only when the caller passes a server number; nothing is ever counted here.
 */
export function PillTabs(props: TabsProps) {
  return (
    <TabsBase
      {...props}
      containerClass="flex flex-wrap gap-2"
      itemClass={(selected) =>
        cn(
          'inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors',
          selected
            ? 'border-leaf-ink bg-leaf-ink text-leaf-soft'
            : 'border-border bg-surface text-ink-muted hover:bg-surface-sunken hover:text-ink',
        )
      }
      countClass={(selected) =>
        cn(
          'rounded-full px-1.5 text-xs font-bold',
          selected ? 'bg-leaf-soft text-leaf-ink' : 'bg-surface-sunken text-ink-muted',
        )
      }
    />
  );
}
