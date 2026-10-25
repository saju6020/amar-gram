'use client';

import { AccessRefusedState } from '@/components/admin/AccessRefusedState';
import { FilterBar } from '@/components/inventory/FilterBar';
import { STOCK_CLASS_OPTIONS } from '@/components/inventory/labels';
import { StockTable } from '@/components/stock/StockTable';
import { ApiForbiddenError } from '@/lib/api/client';
import { useStockSummary } from '@/lib/hooks/useInventory';
import { useInventoryListState } from '@/lib/hooks/useInventoryListState';
import { useLocations } from '@/lib/hooks/useInventoryLookup';

const FIELDS = ['search', 'locationId', 'class', 'belowReorderPoint'] as const;

/**
 * `components/back-office-stock/StockBrowser.tsx` — HO-P4 S4, 11.5.3. "Stock by item": the URL
 * filters (search, location, class, below reorder point) over the expandable stock list. One
 * component for the Inventory overview and `/staff/inventory/stock`, so both behave alike. The
 * server's `403` on the list is the permission check (`AccessRefusedState`).
 */
export function StockBrowser() {
  const list = useInventoryListState(FIELDS, { debounced: ['search'] });
  const query = useStockSummary({
    ...list.params,
    belowReorderPoint: list.values.belowReorderPoint === 'true',
  });
  const locations = useLocations();
  if (query.error instanceof ApiForbiddenError) return <AccessRefusedState error={query.error} />;
  return (
    <section aria-label="Stock by item" className="flex flex-col gap-4">
      <FilterBar
        label="Filter stock"
        values={list.values}
        onChange={list.setValue}
        onCommit={list.flush}
        fields={[
          { name: 'search', label: 'Search by name or code', type: 'text' },
          {
            name: 'locationId',
            label: 'Location',
            type: 'select',
            options: [{ value: '', label: 'All locations' }, ...(locations.data ?? []).map((l) => ({ value: l.id, label: l.name }))],
          },
          { name: 'class', label: 'Class', type: 'select', options: STOCK_CLASS_OPTIONS },
          { name: 'belowReorderPoint', label: 'Below reorder point', type: 'checkbox' },
        ]}
      />
      <StockTable
        rows={query.data?.items}
        totalCount={query.data?.totalCount ?? 0}
        pageSize={list.pageSize}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
      />
    </section>
  );
}
