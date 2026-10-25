import * as React from 'react';
import { Clock } from 'lucide-react';
import { DeliveryPromiseCard } from '@/components/hearth/DeliveryPromise';
import { formatMoney } from '@/lib/format/money';
import { formatBestBefore, taxLabel } from '@/lib/format/shop';
import { AvailabilityText } from './StatusText';
import type { DetailSku } from '@/lib/api/shop-catalogue';

export interface BuyBoxProps {
  sku: DetailSku;
  pricesIncludeTax: boolean;
  /** The size option cards, drawn between the price and the buy row. */
  variants?: React.ReactNode;
  /** Only used with a custom `actions` slot; the default buy row carries its own wishlist button. */
  wishlist?: React.ReactNode;
  stockAlert?: React.ReactNode;
  /** The action slot: the quantity stepper, *Add to basket* and wishlist row (or HO-ORD-002's own). */
  actions?: React.ReactNode;
  /** The quantity chosen in the buy row. It only changes the note beside the price, never the price. */
  quantity?: number;
}

/**
 * HO-SHP-002 §11.3 `BuyBox` — everything that decides whether a variant can be bought, for the
 * selected SKU, ALL from API fields (ADR-FE-032): the price (the SELECTED SKU's price exactly as sent,
 * never multiplied by the quantity: the server prices the basket) with the tax label and availability
 * (the "Price and availability" region), the size cards, the best-before notice (`expiryNotice`,
 * US-SHP-07 AC2), the buy row, the back-in-stock card and the delivery promise. No stock number, no
 * arithmetic.
 */
export function BuyBox({
  sku,
  pricesIncludeTax,
  variants,
  wishlist,
  stockAlert,
  actions,
  quantity = 1,
}: BuyBoxProps) {
  const packNote = quantity > 1 ? `${quantity} × ${sku.label}` : `${sku.label} pack`;
  return (
    <>
      <section aria-label="Price and availability" className="flex flex-col gap-2">
        <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <strong className="font-display text-[40px] font-bold leading-tight text-ink">
            {sku.price ? formatMoney(sku.price) : 'Price not available'}
          </strong>
          {sku.price && (
            <span className="text-[15px] font-normal text-ink-muted">
              {packNote} · {taxLabel(pricesIncludeTax)}
            </span>
          )}
        </p>
        <p className="m-0">
          <AvailabilityText availability={sku.availability} />
        </p>
      </section>
      {variants}
      {sku.expiryNotice && (
        <p className="m-0 flex items-start gap-2.5 rounded-2xl bg-warning-bg px-4 py-3 text-[13.5px] leading-snug text-warning-ink">
          <Clock size={16} className="mt-0.5 flex-none" aria-hidden="true" />
          <span>
            Best before {formatBestBefore(sku.expiryNotice.expiresOn)} — this is the date on the
            stock we would send you.
          </span>
        </p>
      )}
      <div data-slot="buy-box-actions">{actions}</div>
      {wishlist && <div className="flex flex-col gap-2">{wishlist}</div>}
      {stockAlert && (
        <div id="stock-alert" className="scroll-mt-24 rounded-card bg-surface-sunken p-4">
          {stockAlert}
        </div>
      )}
      <DeliveryPromiseCard />
    </>
  );
}
