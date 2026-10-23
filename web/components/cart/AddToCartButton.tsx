'use client';

import { ShoppingBasket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAddToCart } from '@/lib/hooks/useAddToCart';

import { AddToCartFeedback } from './AddToCartFeedback';

/**
 * `components/cart/AddToCartButton.tsx` — HO-ORD-002 §3.3, the component HO-SHP-002's buy box mounts.
 * Props `{ skuId, productName, disabled?, quantityMax? }`. States: idle, pending, *Added* (announced
 * in a live region), and disabled **with its reason in text**. It posts to `/api/cart/lines`; the
 * server decides everything else.
 */
export interface AddToCartButtonProps {
  skuId: string;
  productName: string;
  disabled?: boolean;
  /** Why it is disabled (e.g. out of stock), shown beside the button. */
  disabledReason?: string;
  /** The most the shopper may add at once (the server's `maxQuantityPerLine` when known). */
  quantityMax?: number;
}

export function AddToCartButton({
  skuId,
  productName,
  disabled,
  disabledReason,
  quantityMax = 20,
}: AddToCartButtonProps) {
  const state = useAddToCart({
    skuId,
    productName,
    disabled,
    disabledReason,
    quantityMax,
  });

  return (
    <div className="flex flex-col gap-2" data-slot="add-to-cart">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`qty-${skuId}`} className="text-xs font-semibold text-ink-muted">
            Quantity
          </label>
          <input
            id={`qty-${skuId}`}
            type="number"
            min={1}
            max={quantityMax}
            value={state.quantity}
            disabled={disabled}
            onChange={(event) => state.setQuantity(event.target.valueAsNumber)}
            className="h-10 w-20 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-2 text-sm tabular-nums text-ink"
          />
        </div>
        <Button
          disabled={state.isDisabled}
          aria-busy={state.pending}
          aria-describedby={state.describedBy}
          onClick={state.onAdd}
        >
          <ShoppingBasket size={16} aria-hidden="true" />
          {state.pending ? 'Adding…' : 'Add to cart'}
        </Button>
      </div>
      <AddToCartFeedback state={state} />
    </div>
  );
}
