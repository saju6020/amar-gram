'use client';

import * as React from 'react';
import { ActiveFilterChips } from '@/components/catalogue/ActiveFilterChips';
import { CatalogueFilters } from '@/components/catalogue/CatalogueFilters';
import { FiltersSheet } from '@/components/catalogue/FiltersSheet';
import { SortSelect } from '@/components/catalogue/SortSelect';
import { useCatalogueNavigation } from '@/lib/hooks/useCatalogueNavigation';
import { activeFilterCount, type CatalogueParams } from '@/lib/shop/catalogueParams';
import type { CatalogueFilters as Facets, CategoryNode } from '@/lib/api/shop-catalogue';

export interface CatalogueControlsProps {
  facets: Facets;
  categories: CategoryNode[];
  currencyCode: string;
  /** Values the page owns and the shopper cannot change (an origin page's country). */
  fixed?: Partial<CatalogueParams>;
  /**
   * The server-rendered result summary (a polite live region), drawn in the toolbar. `null` when the
   * page shows the count itself (the catalogue's heading band).
   */
  summary: React.ReactNode;
  /** The server-rendered results. */
  children: React.ReactNode;
}

/**
 * HO-SHP-002 §8.2, ADR-FE-031 — the catalogue's interactive island. It owns NO catalogue data: it
 * reads the URL through `useCatalogueNavigation` and writes the next URL; the server re-renders the
 * results (`children`) and the summary. Desktop applies each filter on change; below 768 px the
 * same groups live in a sheet that applies once (*Show results*).
 *
 * Layout (Catalogue.dc.html, HO-P3 S2): the filter card on the left and, on the right, one toolbar
 * line (the active-filter chips and the sort) above the results. The filter card scrolls with the
 * page (no scrollbar of its own, owner 2026-10-17).
 */
export function CatalogueControls({
  facets,
  categories,
  currencyCode,
  fixed,
  summary,
  children,
}: CatalogueControlsProps) {
  const { params, apply, setSort, clearAll } = useCatalogueNavigation(fixed);
  const hideOrigin = !!fixed?.origin?.length;
  const fixedKeys = Object.keys(fixed ?? {}) as Array<keyof CatalogueParams>;
  const panel = { value: params, facets, categories, currencyCode, hideOrigin };
  // The page-owned filter (an origin page's country) is not the shopper's to count or remove.
  const filterCount = activeFilterCount({ ...params, origin: hideOrigin ? [] : params.origin });

  return (
    <div className="grid gap-4 md:grid-cols-[270px_minmax(0,1fr)] md:items-start md:gap-8">
      <aside
        aria-label="Filters"
        className="rounded-card border-[1.5px] border-border bg-surface p-5 max-md:hidden"
      >
        <CatalogueFilters
          {...panel}
          priceMode="button"
          onChange={apply}
          onClear={filterCount > 0 ? clearAll : undefined}
        />
      </aside>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <FiltersSheet {...panel} count={filterCount} onShowResults={(draft) => apply(draft)} />
            {summary}
            <ActiveFilterChips
              value={params}
              origins={facets.origins}
              currencyCode={currencyCode}
              fixedKeys={fixedKeys}
              onChange={apply}
              onClearAll={clearAll}
            />
          </div>
          <SortSelect value={params.sort} hasQuery={!!params.q} onChange={setSort} />
        </div>
        {children}
      </div>
    </div>
  );
}
