'use client';

import * as React from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { ActionLink } from '@/components/back-office/ActionLink';
import { PageHeader } from '@/components/back-office/PageHeader';
import { PillTabs } from '@/components/back-office/PillTabs';
import { SearchField } from '@/components/back-office/SearchField';
import { StatusPill } from '@/components/back-office/StatusPill';
import { buttonVariants } from '@/components/ui/button';
import { DataTable } from '@/components/common/DataTable';
import { ProductPackArt } from '@/components/hearth/ProductPackArt';
import { formatInstantDate } from '@/lib/format/time';
import { formatMoney } from '@/lib/format/money';
import { resolveFileUrl } from '@/lib/api/files';
import { CATEGORY_LABELS, categoryLabel } from '@/lib/shop/labels';
import type {
  BulkProductAction,
  BulkProductStatusResult,
  StaffProductSummary,
} from '@/lib/api/staff-shop';
import { ProductBulkActions } from './ProductBulkActions';

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
  /** HO-P5 BG-10: one `bulk-status` call for the ticked rows. Without it the table has no select column. */
  onBulkStatus?: (
    action: BulkProductAction,
    productIds: string[],
  ) => Promise<BulkProductStatusResult>;
}

/** The API's own statuses with the labels the editor already shows (OQ-4). "All" is the empty filter. */
const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'Draft', label: 'Draft' },
  { key: 'Active', label: 'Active' },
  { key: 'Archived', label: 'Archived' },
];
const STATUS_TONE = { Draft: 'neutral', Active: 'success', Archived: 'warning' } as const;
/** DataTable pads every cell `px-4`; eleven columns plus Select need the tighter `px-2.5` to fit a 1280 px frame without a horizontal scroll. */
const TIGHT = 'px-2.5';
const select =
  'min-h-11 rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 text-sm text-ink';

/** BG-9: "{min}" when the two strings are the same, else "{min} – {max}"; "—" when no active pack size is priced. */
export function priceRangeText(range: StaffProductSummary['priceRange']): string {
  if (!range) return '—';
  return range.min.amount === range.max.amount
    ? formatMoney(range.min)
    : `${formatMoney(range.min)} – ${formatMoney(range.max)}`;
}

/** BG-9: the server's sizes joined, else the count of pack sizes as before. */
export function packSizesText(row: StaffProductSummary): string {
  return row.packSizes && row.packSizes.length > 0
    ? row.packSizes.join(', ')
    : `${row.skuCount} pack ${row.skuCount === 1 ? 'size' : 'sizes'}`;
}

/** BG-9: the signed 480 px thumbnail with the server's alt text; the tinted pack placeholder when there is none. */
function ProductThumb({ image }: { image: StaffProductSummary['primaryImage'] }) {
  const src = resolveFileUrl(image?.url);
  if (!image || !src) return <ProductPackArt className="size-10 rounded-[var(--radius-sm)]" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ADR-FE-035: no next/image remote config; the URL is the server's signed one
    <img
      src={src}
      alt={image.altText}
      width={40}
      height={40}
      className="size-10 flex-none rounded-[var(--radius-sm)] object-cover"
    />
  );
}

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
 * HO-P5 BG-9: each row also shows its thumbnail, Origin, pack sizes, price range, stock and an
 * "Organic" pill, every one as the server sent it (no figure is worked out here). HO-P5 BG-10: a select
 * box per row and "Select all on this page" feed the bulk bar (Publish / Hide from shop). The selection is
 * the current page only (OQ-12): it clears when the page's products change and after an action.
 */
export function StaffProductTable(props: StaffProductTableProps) {
  const { filters, onFilter, onFlush } = props;
  const urlSearch = filters.barcode || filters.q;
  const [draft, setDraft] = React.useState(urlSearch);
  React.useEffect(() => setDraft(urlSearch), [urlSearch]);

  // OQ-12: the selection is the current page's; a different page or filter (different rows) clears it.
  const [selected, setSelected] = React.useState<string[]>([]);
  const pageKey = (props.items ?? []).map((row) => row.productId).join(',');
  const lastPageKey = React.useRef(pageKey);
  React.useEffect(() => {
    if (lastPageKey.current === pageKey) return;
    lastPageKey.current = pageKey;
    setSelected([]);
  }, [pageKey]);
  const rows = props.items ?? [];
  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.productId));
  const bulk = props.onBulkStatus;

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

      {bulk && rows.length > 0 && (
        <label className="flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            className="size-5 accent-leaf"
            checked={allSelected}
            onChange={(event) =>
              setSelected(event.target.checked ? rows.map((row) => row.productId) : [])
            }
          />
          Select all on this page
        </label>
      )}
      {bulk && (
        <ProductBulkActions
          selectedIds={selected}
          nameOf={(id) => rows.find((row) => row.productId === id)?.name ?? id}
          onRun={bulk}
          onClear={() => setSelected([])}
        />
      )}

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
        columns={[
          ...(bulk
            ? [
                {
                  id: 'select',
                  header: 'Select',
                  headerClassName: `${TIGHT} w-12`,
                  cellClassName: TIGHT,
                  cell: (row: StaffProductSummary) => (
                    <label className="-m-2.5 flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      className="size-5 accent-leaf"
                      aria-label={`Select ${row.name}`}
                      checked={selected.includes(row.productId)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, row.productId]
                            : current.filter((id) => id !== row.productId),
                        )
                      }
                    />
                    </label>
                  ),
                },
              ]
            : []),
          {
            id: 'name',
            header: 'Product',
            headerClassName: `${TIGHT} min-w-52 sm:min-w-0`,
            cellClassName: `${TIGHT} min-w-52 sm:min-w-0`,
            cell: (row) => (
              <span className="flex items-center gap-3">
                <ProductThumb image={row.primaryImage} />
                <span className="flex min-w-0 flex-col items-start gap-1">
                  <Link
                    href={`/staff/shop/products/${row.productId}`}
                    className="font-semibold text-ink no-underline hover:underline"
                  >
                    {row.kind === 'Bundle' ? `${row.name} (Kit)` : row.name}
                  </Link>
                  {row.isOrganic && <StatusPill tone="success">Organic</StatusPill>}
                </span>
              </span>
            ),
          },
          { id: 'category', headerClassName: TIGHT, cellClassName: TIGHT, header: 'Category', cell: (row) => categoryLabel(row.category) },
          { id: 'brand', headerClassName: TIGHT, cellClassName: TIGHT, header: 'Producer', cell: (row) => row.brand },
          { id: 'origin', headerClassName: TIGHT, cellClassName: TIGHT, header: 'Origin', cell: (row) => row.countryOfOrigin?.name ?? '—' },
          { id: 'skus', headerClassName: `${TIGHT} whitespace-normal`, cellClassName: TIGHT, header: 'Pack sizes', cell: (row) => packSizesText(row) },
          { id: 'price', headerClassName: TIGHT, cellClassName: TIGHT, header: 'Price', cell: (row) => priceRangeText(row.priceRange) },
          {
            id: 'stock',
            header: 'Stock',
            headerClassName: TIGHT,
            cellClassName: TIGHT,
            cell: (row) =>
              row.availableStock == null ? '—' : `${row.availableStock} available`,
          },
          {
            id: 'listed',
            header: 'Listed in shop',
            headerClassName: `${TIGHT} whitespace-normal`,
            cellClassName: TIGHT,
            cell: (row) => (row.listedOnStorefront ? 'Yes' : 'No'),
          },
          {
            id: 'status',
            header: 'Status',
            headerClassName: TIGHT,
            cellClassName: `${TIGHT} whitespace-nowrap`,
            cell: (row) => <StatusPill tone={STATUS_TONE[row.status]}>{row.status}</StatusPill>,
          },
          { id: 'updated', headerClassName: TIGHT, cellClassName: TIGHT, header: 'Updated', cell: (row) => formatInstantDate(row.lastUpdatedOn) },
        ]}
      />
    </div>
  );
}
