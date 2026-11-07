'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface StateTab {
  id: string;
  label: string;
}

/**
 * State tabs (customer Current / Cancelled, UI-6): the WAI-ARIA tabs pattern with arrow keys, Home and End, only the
 * selected tab in the tab order, and 44 px tab buttons. The selected tab lives in the caller's state; the panel is labelled
 * by its tab.
 */
export function StateTabs({
  label,
  tabs,
  selected,
  onSelect,
  idPrefix,
  children,
}: {
  label: string;
  tabs: StateTab[];
  selected: string;
  onSelect: (id: string) => void;
  idPrefix: string;
  children: ReactNode;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === selected));

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: number) {
    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    onSelect(tabs[next]!.id);
    refs.current[next]?.focus();
  }

  const active = tabs[index]!;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
        {tabs.map((tab, position) => (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[position] = node;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={position === index}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={position === index ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => onKeyDown(event, position)}
            className={cn(
              'min-h-11 rounded-pill border-[1.5px] px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              position === index
                ? 'border-leaf bg-leaf text-leaf-soft'
                : 'border-border bg-surface text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${idPrefix}-panel-${active.id}`}
        aria-labelledby={`${idPrefix}-tab-${active.id}`}
        className="min-w-0"
      >
        {children}
      </div>
    </div>
  );
}
