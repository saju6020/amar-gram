'use client';

import * as React from 'react';
import { Minus, Plus, ShoppingBasket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddToCartFeedback, useAddedMessage } from '@/components/cart/AddToCartFeedback';
import { useAddToCart } from '@/lib/hooks/useAddToCart';
import { cn } from '@/lib/utils';

export interface PurchaseRowProps {
  skuId: string;
  productName: string;
  /** The selected size's label ("1 kg"): the confirmation reads "Added 2 × 1 kg to your basket." */
  skuLabel: string;
  disabled?: boolean;
  /** Why it is disabled (e.g. out of stock), written next to the row and tied by `aria-describedby`. */
  disabledReason?: string;
  /** The most the shopper may add at once. */
  quantityMax?: number;
  /** The round wishlist button, drawn last in the row. */
  trailing?: React.ReactNode;
  /** Told the quantity on every change, so the note beside the price can say "2 × 1 kg". */
  onQuantityChange?: (quantity: number) => void;
}

/**
 * The product page's buy row (docs/design/store/Product.dc.html, HO-P3 S2): a pill quantity stepper
 * (− / number input / +, 52px), a full-width papaya *Add to basket* and the round wishlist button.
 * Each stepper button is named with the product ("One more Rolled Oats", UI-6). It shares
 * `useAddToCart` (the cart mutation, the messages) with HO-ORD-002's `AddToCartButton` and keeps its
 * behaviour: the server decides everything else. For an out-of-stock size the stepper and button are
 * disabled with the reason beside them. No price is computed here.
 */
export function PurchaseRow({
  skuId,
  productName,
  skuLabel,
  disabled,
  disabledReason,
  quantityMax = 20,
  trailing,
  onQuantityChange,
}: PurchaseRowProps) {
  const state = useAddToCart({
    skuId,
    productName,
    disabled,
    disabledReason,
    quantityMax,
  });
  const { quantity, setQuantity } = state;
  const added = useAddedMessage(state, skuLabel);
  React.useEffect(() => {
    onQuantityChange?.(quantity);
  }, [quantity, onQuantityChange]);
  // While the shopper is typing the field may be empty; it snaps back to the real quantity on blur.
  const [draft, setDraft] = React.useState<string | null>(null);
  function typeQuantity(raw: string, parsed: number) {
    if (Number.isInteger(parsed) && parsed >= 1) {
      const next = Math.min(quantityMax, parsed);
      setQuantity(next);
      setDraft(String(next));
    } else {
      setDraft(raw);
    }
  }
  const stepperButton =
    'grid size-[52px] place-items-center rounded-pill border-0 bg-transparent p-0 text-ink hover:bg-surface-sunken disabled:opacity-40';

  return (
    <div className="flex flex-col gap-2.5" data-slot="add-to-cart">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={cn(
            'flex min-h-[52px] items-center rounded-pill border-[1.5px] border-ink bg-surface',
            disabled && 'opacity-60',
          )}
        >
          <button
            type="button"
            aria-label={`One less ${productName}`}
            disabled={disabled || quantity <= 1}
            onClick={() => {
              setDraft(null);
              setQuantity(quantity - 1);
            }}
            className={stepperButton}
          >
            <Minus size={18} aria-hidden="true" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            aria-label="Quantity"
            min={1}
            max={quantityMax}
            value={draft ?? quantity}
            disabled={disabled}
            onChange={(event) => typeQuantity(event.target.value, event.target.valueAsNumber)}
            onBlur={() => setDraft(null)}
            className="w-12 border-0 bg-transparent p-0 text-center text-lg font-semibold tabular-nums text-ink [appearance:textfield] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            aria-label={`One more ${productName}`}
            disabled={disabled || quantity >= quantityMax}
            onClick={() => {
              setDraft(null);
              setQuantity(quantity + 1);
            }}
            className={stepperButton}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
        <Button
          variant="pill"
          className="min-h-[52px] min-w-[200px] flex-1 rounded-pill px-6 text-[17px]"
          disabled={state.isDisabled}
          aria-busy={state.pending}
          aria-describedby={state.describedBy}
          onClick={added.onAdd}
        >
          <ShoppingBasket size={18} aria-hidden="true" />
          {state.pending ? 'Adding…' : 'Add to basket'}
        </Button>
        {trailing}
      </div>
      <AddToCartFeedback state={state} message={added.text} />
    </div>
  );
}
