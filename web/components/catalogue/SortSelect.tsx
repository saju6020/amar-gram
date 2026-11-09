'use client';

import { useId } from 'react';
import { ArrowUpDown, ChevronDown } from 'lucide-react';
import { CATALOGUE_SORTS, type CatalogueSort } from '@/lib/shop/catalogueParams';
import { SORT_LABELS } from '@/lib/shop/labels';
import { cn } from '@/lib/utils';

export interface SortSelectProps {
  value: CatalogueSort | null;
  /** *Relevance* is offered only with a search (HO-SHP-002 §11.2). */
  hasQuery: boolean;
  onChange: (sort: CatalogueSort | null) => void;
}

/**
 * Changing the sort keeps every filter and the search — US-SHP-04 AC2.
 * From 768 px (Catalogue.dc.html) the API's sorts are a segmented `radiogroup` of pills, the chosen
 * one in leaf; below that they stay the native `<select>` pill ("⇅ Sort: Newest ⌄"), so the phone's
 * own picker works as before. Both are always in the markup and CSS shows one; the select keeps the
 * label "Sort by" for assistive tech.
 */
export function SortSelect({ value, hasQuery, onChange }: SortSelectProps) {
  const id = useId();
  const groupLabelId = `${id}-label`;
  const options = CATALOGUE_SORTS.filter((sort) => sort !== 'relevance' || hasQuery);
  const effective = value ?? (hasQuery ? 'relevance' : 'newest');
  return (
    <>
      <div className="hidden items-center gap-2 md:flex">
        <span id={groupLabelId} className="text-sm text-ink-muted">
          Sort
        </span>
        <div
          role="radiogroup"
          aria-labelledby={groupLabelId}
          className="flex flex-wrap gap-1 rounded-3xl border-[1.5px] border-border bg-surface p-[3px]"
        >
          {options.map((sort) => (
            <label
              key={sort}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center rounded-pill px-3.5 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
                sort === effective ? 'bg-leaf text-leaf-soft' : 'text-ink hover:bg-surface-sunken',
              )}
            >
              <input
                type="radio"
                name={`${id}-sort`}
                value={sort}
                checked={sort === effective}
                onChange={() => onChange(sort)}
                className="sr-only"
              />
              {SORT_LABELS[sort]}
            </label>
          ))}
        </div>
      </div>
      <div className="relative inline-flex items-center md:hidden">
        <label htmlFor={id} className="sr-only">
          Sort by
        </label>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 flex items-center gap-1.5 text-sm text-ink-muted"
        >
          <ArrowUpDown size={15} />
          Sort:
        </span>
        <select
          id={id}
          value={effective}
          onChange={(event) => onChange(event.target.value as CatalogueSort)}
          className="min-h-11 cursor-pointer appearance-none rounded-pill border-[1.5px] border-border-strong bg-surface pl-[5.1rem] pr-10 text-sm font-semibold text-ink transition-colors hover:border-ink-faint hover:bg-surface-sunken"
        >
          {options.map((sort) => (
            <option key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 text-ink-muted"
        />
      </div>
    </>
  );
}
