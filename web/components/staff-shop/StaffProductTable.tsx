'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { ActionLink } from '@/components/back-office/ActionLink';
import { PageHeader } from '@/components/back-office/PageHeader';
import { PillTabs } from '@/components/back-office/PillTabs';
import { SearchField } from '@/components/back-office/SearchField';
import { StatusPill } from '@/components/back-office/StatusPill';
import { buttonVariants } from '@/components/ui/button';
import { DataTable } from '@/components/common/DataTable';
import { formatInstantDate } from '@/lib/format/time';
import { CATEGORY_LABELS, categoryLabel } from '@/lib/shop/labels';
import type { StaffProductSummary } from '@/lib/api/staff-shop';

export type StaffProductFilterName =
  'q' | 'status' | 'category' | 'brand' | 'kind' | 'listed' | 'barcode' | 'sort';

export interface StaffProductTableProps {
  items: StaffProductSummary[] | undefined;
  totalCount?: number;
  pageSize: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  filters: Record<StaffProductFilterName, string>;
  onFilter: (name: StaffProductFilterName, value: string) => void;
  /** Writes a pending text field straight to the URL (Enter from a barcode scanner, HW-2). */
  onFlush: (name: StaffProductFilterName) => void;
  exportHref: string;
}

/** The API's own statuses with the labels the editor already shows (OQ-4). "All" is the empty filter. */
const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'Draft', label: 'Draft' },
  { key: 'Active', label: 'Active' },
  { key: 'Archived', label: 'Archived' },
];
const STATUS_TONE = { Draft: 'neutral', Active: 'success', Archived: 'warning' } as const;
const select =
  'min-h-11 rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 text-sm text-ink';

/** A scanner's keyboard-wedge input is digits only; anything else is a name or SKU code search. */
const isBarcodeLike = (text: string) => /^\d{6,}$/.test(text);

function SelectFilter({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-ink-muted">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={select}>
        <option value="">All</option>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * HO-SHP-002 §11.6 `StaffProductTable` — UI-4; HO-P4 §11.4.2/§11.4.3. One search box "Name, SKU or
 * barcode": a digits-only entry confirmed with Enter or on leaving the box is the **barcode** filter
 * (a scanner's keyboard-wedge input, HW-2), anything else is the `q` text search. Status pills over
 * the API's own statuses, category, kind, listed, producer and sort, all in the URL; pagination; and
 * **Export CSV** from the server with the same filters.
 *
 * Left out (the list row lacks the data, BG-9/BG-10): row select boxes and the bulk publish bar,
 * and the Origin, price range, stock, thumbnail and "Organic" columns.
 */
export function StaffProductTable(props: StaffProductTableProps) {
  const { filters, onFilter, onFlush } = props;
  const urlSearch = filters.barcode || filters.q;
  const [draft, setDraft] = React.useState(urlSearch);
  React.useEffect(() => setDraft(urlSearch), [urlSearch]);

  function commitSearch(raw: string) {
    const text = raw.trim();
    const barcode = isBarcodeLike(text);
    onFilter('barcode', barcode ? text : '');
    onFilter('q', barcode ? '' : text);
    onFlush('barcode');
    onFlush('q');
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Products"
        actions={
          <>
            <a href={props.exportHref} className={buttonVariants({ variant: 'secondary' })}>
              <Download size={16} aria-hidden="true" />
              Export CSV
            </a>
            <ActionLink href="/staff/admin/content?kind=Banner" variant="outline">
              Banners
            </ActionLink>
            <ActionLink href="/staff/shop/products/new" variant="primary">
              + New product
            </ActionLink>
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <form
            role="search"
            aria-label="Search products"
            className="min-w-60 flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              commitSearch(draft);
            }}
          >
            <SearchField
              id="f-search"
              label="Name, SKU or barcode"
              placeholder="Name, SKU or barcode"
              value={draft}
              onChange={setDraft}
              onBlur={() => commitSearch(draft)}
            />
          </form>
          <SelectFilter
            id="f-category"
            label="Category"
            value={filters.category}
            onChange={(v) => onFilter('category', v)}
            options={Object.keys(CATEGORY_LABELS).map(
              (c) => [c, categoryLabel(c)] as [string, string],
            )}
          />
        </div>
        <PillTabs
          label="Status"
          mode="state"
          items={STATUS_TABS}
          value={filters.status}
          onChange={(key) => onFilter('status', key)}
        />
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-accent">More filters</summary>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <SelectFilter
              id="f-kind"
              label="Kind"
              value={filters.kind}
              onChange={(v) => onFilter('kind', v)}
              options={[
                ['Standard', 'Standard'],
                ['Bundle', 'Kit'],
              ]}
            />
            <SelectFilter
              id="f-listed"
              label="Listed in shop"
              value={filters.listed}
              onChange={(v) => onFilter('listed', v)}
              options={[
                ['true', 'Listed'],
                ['false', 'Not listed'],
              ]}
            />
            <SelectFilter
              id="f-sort"
              label="Sort"
              value={filters.sort}
              onChange={(v) => onFilter('sort', v)}
              options={[
                ['name', 'Name A–Z'],
                ['name_desc', 'Name Z–A'],
              ]}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="f-brand" className="text-xs font-semibold text-ink-muted">
                Producer
              </label>
              <input
                id="f-brand"
                className={select}
                value={filters.brand}
                onChange={(e) => onFilter('brand', e.target.value)}
                onBlur={() => onFlush('brand')}
              />
            </div>
          </div>
        </details>
      </div>

      <DataTable
        caption="Products"
        rows={props.items}
        getRowId={(row) => row.productId}
        isLoading={props.isLoading}
        isError={props.isError}
        onRetry={props.onRetry}
        emptyState={{
          title: 'No products match',
          description: 'Clear a filter, or add a new product.',
        }}
        pagination={{ totalCount: props.totalCount ?? 0, pageSize: props.pageSize }}
        rowHref={(row) => `/staff/shop/products/${row.productId}`}
        columns={[
          {
            id: 'name',
            header: 'Product',
            cell: (row) => (row.kind === 'Bundle' ? `${row.name} (Kit)` : row.name),
          },
          { id: 'category', header: 'Category', cell: (row) => categoryLabel(row.category) },
          { id: 'brand', header: 'Producer', cell: (row) => row.brand },
          {
            id: 'skus',
            header: 'Pack sizes',
            cell: (row) => `${row.skuCount} pack ${row.skuCount === 1 ? 'size' : 'sizes'}`,
          },
          {
            id: 'listed',
            header: 'Listed in shop',
            cell: (row) => (row.listedOnStorefront ? 'Yes' : 'No'),
          },
          {
            id: 'status',
            header: 'Status',
            cell: (row) => <StatusPill tone={STATUS_TONE[row.status]}>{row.status}</StatusPill>,
          },
          { id: 'updated', header: 'Updated', cell: (row) => formatInstantDate(row.lastUpdatedOn) },
        ]}
      />
    </div>
  );
}
