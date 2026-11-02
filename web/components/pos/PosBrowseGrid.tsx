'use client';

import { useState } from 'react';
import { PillTabs } from '@/components/back-office/PillTabs';
import { Button } from '@/components/ui/button';
import type { PosSku } from '@/lib/api/pos';
import { usePosBrowse } from '@/lib/hooks/usePos';
import { CATEGORY_LABELS } from '@/lib/shop/labels';
import { POS_TILE_GRID, PosSkuTile } from './PosSkuTile';

/**
 * `components/pos/PosBrowseGrid.tsx` — HO-P5 §11.3.11 (BG-6), US-ORD-16. The counter's browse grid: a tablist
 * of "All" and one tab per product category (names from `lib/shop/labels`, the server's fixed enumeration), then
 * the sellable items in that category as tap tiles, paged — "Show more" asks the server for the next page. The
 * tabs scroll sideways inside their own strip so the phone layout never overflows. The selected category and the
 * pages shown are this component's state only (the POS keeps nothing in the URL or in storage). Tapping a tile
 * adds it to the basket through `onAdd`; the scan field above keeps focus priority and, once a name is typed,
 * its search results replace this grid.
 */
const ALL = 'all';
const CATEGORY_TABS = [{ key: ALL, label: 'All' }, ...Object.entries(CATEGORY_LABELS).map(([key, label]) => ({ key, label }))];

export function PosBrowseGrid({ onAdd }: { onAdd: (sku: PosSku) => void }) {
  const [category, setCategory] = useState(ALL);
  const browse = usePosBrowse(category === ALL ? '' : category);
  const skus = browse.data?.pages.flatMap((page) => page.items) ?? [];
  const label = category === ALL ? 'All items' : (CATEGORY_LABELS[category] ?? category);

  return (
    <section aria-label="Browse items" className="flex flex-col gap-3">
      <div className="overflow-x-auto pb-1 [&>[role=tablist]]:flex-nowrap [&>[role=tablist]>button]:shrink-0">
        <PillTabs mode="state" label="Item categories" value={category} onChange={setCategory} items={CATEGORY_TABS} />
      </div>
      {browse.isPending ? (
        <p role="status" className="text-sm text-ink-muted">Loading items…</p>
      ) : browse.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[var(--radius-sm)] bg-danger-bg p-3 text-sm font-semibold text-danger-ink">
          <span>We couldn’t load the items just now.</span>
          <Button variant="secondary" size="sm" onClick={() => void browse.refetch()}>Try again</Button>
        </div>
      ) : skus.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing to sell in {label.toLowerCase()} right now.</p>
      ) : (
        <>
          <ul aria-label={`${label} to sell`} className={POS_TILE_GRID}>
            {skus.map((sku) => (
              <li key={sku.skuId} className="min-w-0">
                <PosSkuTile sku={sku} onAdd={onAdd} />
              </li>
            ))}
          </ul>
          {browse.hasNextPage && (
            <div>
              <Button variant="secondary" size="sm" onClick={() => void browse.fetchNextPage()} disabled={browse.isFetchingNextPage} aria-busy={browse.isFetchingNextPage}>
                {browse.isFetchingNextPage ? 'Loading…' : 'Show more'}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
