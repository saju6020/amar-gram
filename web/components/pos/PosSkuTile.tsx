'use client';

import type { PosSku } from '@/lib/api/pos';
import { formatMoney } from '@/lib/format/money';

/**
 * `components/pos/PosSkuTile.tsx` — HO-ORD-002 §11.11, HO-P5 §11.3.11. One tap tile (name, variant, price)
 * that adds the SKU to the basket. Shared by the name-search results and the category grid, so both read the
 * same to a screen reader: "Add {name}, {price}". The price is the server's string.
 */
export function PosSkuTile({ sku, onAdd }: { sku: PosSku; onAdd: (sku: PosSku) => void }) {
  const name = `${sku.productName} ${sku.variantLabel}`.trim();
  return (
    <button
      type="button"
      aria-label={`Add ${name}${sku.unitPrice ? `, ${formatMoney(sku.unitPrice)}` : ''}`}
      onClick={() => onAdd(sku)}
      className="flex min-h-28 w-full flex-col justify-between gap-2 rounded-[14px] border border-border bg-surface p-3 text-left text-ink transition-colors hover:bg-surface-sunken"
    >
      <strong aria-hidden="true" className="text-sm leading-tight [overflow-wrap:anywhere]">{sku.productName}</strong>
      <span aria-hidden="true" className="flex items-baseline justify-between gap-2 text-[13px] text-ink-muted">
        <span className="min-w-0 [overflow-wrap:anywhere]">{sku.variantLabel}</span>
        {sku.unitPrice && <strong className="whitespace-nowrap text-ink">{formatMoney(sku.unitPrice)}</strong>}
      </span>
    </button>
  );
}

/** The grid both tile lists use: as many 150 px columns as fit. */
export const POS_TILE_GRID = 'm-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 p-0';
