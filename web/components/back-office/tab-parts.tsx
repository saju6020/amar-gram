'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { handleTablistKeyDown, type TabsProps } from './tabs-shared';

/**
 * The one behaviour both tab styles share (HO-P4 §11.1, UI-6): `state` is an ARIA tablist with a
 * roving tabindex and arrow-key movement; `link` is a `<nav aria-label>` of links with
 * `aria-current="page"` and never `role="tab"`. Each style supplies only its classes.
 */
export function TabsBase({
  label,
  items,
  value,
  onChange,
  mode,
  containerClass,
  itemClass,
  countClass,
}: TabsProps & {
  containerClass: string;
  itemClass: (selected: boolean) => string;
  countClass: (selected: boolean) => string;
}) {
  const keys = items.map((item) => item.key);
  const selectedIndex = Math.max(0, keys.indexOf(value ?? ''));

  if (mode === 'link') {
    return (
      <nav aria-label={label} className={containerClass}>
        {items.map((item) => {
          const selected = item.key === value;
          return (
            <Link
              key={item.key}
              href={item.href ?? '#'}
              aria-current={selected ? 'page' : undefined}
              className={cn(itemClass(selected), 'no-underline')}
            >
              {item.label}
              {item.count !== undefined && (
                <span className={countClass(selected)}>{item.count}</span>
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div role="tablist" aria-label={label} className={containerClass}>
      {items.map((item, index) => {
        const selected = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={index === selectedIndex ? 0 : -1}
            onClick={() => onChange?.(item.key)}
            onKeyDown={(event) => handleTablistKeyDown(event, keys, index, onChange)}
            className={itemClass(selected)}
          >
            {item.label}
            {item.count !== undefined && <span className={countClass(selected)}>{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
