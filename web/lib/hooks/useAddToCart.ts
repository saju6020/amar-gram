'use client';

import * as React from 'react';
import { describeOrderingError } from '@/lib/api/errors';
import { useAddCartLine } from '@/lib/hooks/useCart';

export interface UseAddToCartOptions {
  skuId: string;
  productName: string;
  disabled?: boolean;
  disabledReason?: string;
  /** The most the shopper may add at once. */
  quantityMax?: number;
}

/**
 * The add-to-cart behaviour shared by `AddToCartButton` and the product page's `PurchaseRow`
 * (HO-ORD-002 §3.3): the cart mutation, the quantity (clamped to 1..max), the disabled reason and
 * the Added / error messages. The two components differ only in their markup.
 */
export function useAddToCart({
  skuId,
  productName,
  disabled,
  disabledReason,
  quantityMax = 20,
}: UseAddToCartOptions) {
  const add = useAddCartLine();
  const [quantity, setQuantityState] = React.useState(1);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const setQuantity = React.useCallback(
    (next: number) => {
      if (Number.isInteger(next)) setQuantityState(Math.min(quantityMax, Math.max(1, next)));
    },
    [quantityMax],
  );

  function submit() {
    setError(null);
    setMessage('');
    add.mutate(
      { skuId, quantity },
      {
        onSuccess: () => setMessage(`Added ${quantity} × ${productName} to your cart.`),
        onError: (failure) => setError(describeOrderingError(failure)),
      },
    );
  }

  const reasonId = `add-${skuId}-why`;
  const showReason = !!disabled && !!disabledReason;
  return {
    quantity,
    setQuantity,
    quantityMax,
    pending: add.isPending,
    isDisabled: !!disabled || add.isPending,
    reasonId,
    disabledReason,
    showReason,
    describedBy: showReason ? reasonId : undefined,
    /** The Add button's click. */
    onAdd: submit,
    message,
    error,
  };
}

export type AddToCart = ReturnType<typeof useAddToCart>;
