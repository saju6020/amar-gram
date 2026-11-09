'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TableFrame } from '@/components/back-office/TableFrame';
import { AdjustStockDialog } from '@/components/back-office-stock/AdjustStockDialog';
import { StockItemBatches } from '@/components/back-office-stock/StockItemBatches';
import { StockPager } from '@/components/back-office-stock/StockPager';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { StorageChip } from '@/components/inventory/StorageChip';
import { StatusPill } from '@/components/back-office/StatusPill';
import { Button } from '@/components/ui/button';
import { formatDateOrDash, formatQuantity } from '@/lib/format/inventory';
import { isZeroDecimal } from '@/lib/validation/inventory';
import type { StockSummary } from '@/lib/api/inventory-stock';

const TH = 'px-4 py-3 text-[13px] font-semibold text-ink-muted';
const NUMERIC = 'px-4 py-2.5 text-right tabular-nums';

/**
 * HO-P5 BG-16: the server's reorder level with the item's unit -- "Off" when reordering is switched off for it
 * ("0"), and "(branch default)" when the branch default stands in for an explicit policy. Nothing is worked out here.
 */
export function reorderLevelText(row: StockSummary): string | null {
  if (row.reorderLevel === undefined) return null;
  if (isZeroDecimal(row.reorderLevel)) return 'Off';
  const text = formatQuantity(row.reorderLevel, row.stockUnit);
  return row.reorderLevelIsDefault ? `${text} (branch default)` : text;
}

/** One item plus, once first opened, its batch matrix in a row beneath it. */
function StockRow({
  row,
  onAdjust,
}: {
  row: StockSummary;
  onAdjust: (row: StockSummary, trigger: HTMLElement) => void;
}) {
  const [open, setOpen] = React.useState(false);
  // The batch query starts on the FIRST expand and the row stays mounted (hidden) after a collapse,
  // so re-opening it never refetches on its own.
  const [opened, setOpened] = React.useState(false);
  const detailId = `stock-batches-${row.skuId}`;
  return (
    <>
      <tr className="border-t border-surface-sunken align-top">
        <th scope="row" className="px-4 py-2.5 text-left font-normal">
          <div className="flex items-start gap-1">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailId}
              aria-label={`Batches of ${row.displayName}`}
              onClick={() => {
                setOpen((current) => !current);
                setOpened(true);
              }}
              className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-[var(--radius-sm)] text-ink-muted hover:bg-surface-sunken"
            >
              {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
            </button>
            <div className="min-w-0">
              <Link
                href={`/staff/inventory/stock/${row.skuId}`}
                className="font-semibold text-ink no-underline hover:underline"
              >
                {row.displayName}
              </Link>
              <div className="text-xs text-ink-muted">
                {row.skuCode}
                {row.storage && (
                  <span className="ml-2 inline-block align-middle">
                    <StorageChip storage={row.storage} />
                  </span>
                )}
              </div>
            </div>
          </div>
        </th>
        <td className={NUMERIC}>{formatQuantity(row.onHand, row.stockUnit)}</td>
        <td className={NUMERIC}>{formatQuantity(row.reserved, row.stockUnit)}</td>
        <td className={`${NUMERIC} font-semibold text-ink`}>{formatQuantity(row.sellable, row.stockUnit)}</td>
        <td className="px-4 py-2.5">{formatDateOrDash(row.nextExpiresOn, 'No expiry date')}</td>
        <td className="px-4 py-2.5">
          <div className="flex flex-col items-start gap-1">
            <span>{reorderLevelText(row) ?? '—'}</span>
            {row.belowReorderLevel && <StatusPill tone="warning">Below reorder level</StatusPill>}
          </div>
        </td>
        <td className="px-4 py-2.5 text-right">
          <Button
            variant="secondary"
            size="sm"
            aria-label={`Adjust ${row.displayName}`}
            onClick={(event) => onAdjust(row, event.currentTarget)}
          >
            Adjust
          </Button>
        </td>
      </tr>
      {opened && (
        <tr id={detailId} hidden={!open} className="bg-surface-page">
          <td colSpan={7} className="px-4 pb-4 pt-1 sm:pl-14">
            <StockItemBatches skuId={row.skuId} />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * `components/stock/StockTable.tsx` — HO-IMP-002 §11.4, US-IMP-06/08, restyled by HO-P4 S4 (11.5.3).
 * One row per item: Item (name + code), On hand, Reserved, Available (the server's `sellable`) and
 * Next expiry — each the server's figure with the item's unit (UI-8) — and an "Adjust" action. A
 * disclosure button on each row (`aria-expanded`) opens that item's batches, loaded on first
 * expand. Filters live in the URL above this table; the name still opens the item's page (batch ×
 * location matrix, FEFO preview, figures such as usable / held / expired). HO-P5 BG-16: "Reorder at"
 * (the server's level, "(branch default)" or "Off") with a "Below reorder level" pill from the server's own
 * boolean; the expanded batches add "Received" and "Supplier" (see `SkuStockMatrix`).
 */
export function StockTable({
  rows,
  totalCount,
  pageSize,
  isLoading,
  isError,
  onRetry,
}: {
  rows: StockSummary[] | undefined;
  totalCount: number;
  pageSize: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const [adjusting, setAdjusting] = React.useState<StockSummary | null>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);

  if (isLoading) return <LoadingState variant="table" rows={Math.min(pageSize, 8)} />;
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (!rows || rows.length === 0) {
    return <EmptyState title="No stock matches" description="Receive goods, or clear the filters." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <TableFrame label="Stock by item (scrolls horizontally)" minWidth={900}>
        <table className="relative w-full border-collapse text-sm">
          <caption className="sr-only">Stock by item</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className={TH}>Item</th>
              <th scope="col" className={`${TH} text-right`}>On hand</th>
              <th scope="col" className={`${TH} text-right`}>Reserved</th>
              <th scope="col" className={`${TH} text-right`}>Available</th>
              <th scope="col" className={TH}>Next expiry</th>
              <th scope="col" className={TH}>Reorder at</th>
              <th scope="col" className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <StockRow
                key={row.skuId}
                row={row}
                onAdjust={(target, trigger) => {
                  returnFocusRef.current = trigger;
                  setAdjusting(target);
                }}
              />
            ))}
          </tbody>
        </table>
      </TableFrame>
      <StockPager totalCount={totalCount} pageSize={pageSize} />
      {adjusting && (
        <AdjustStockDialog row={adjusting} onClose={() => setAdjusting(null)} returnFocusRef={returnFocusRef} />
      )}
    </div>
  );
}
