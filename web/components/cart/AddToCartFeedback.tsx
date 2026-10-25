'use client';

import * as React from 'react';
import Link from 'next/link';
import type { AddToCart } from '@/lib/hooks/useAddToCart';
import { cn } from '@/lib/utils';

/**
 * The customer-facing confirmation for an add: "Added 2 × 1 kg to your basket." (D-1: the copy says
 * basket). `useAddToCart` only reports THAT an add succeeded (its own message says "cart"), so the
 * sentence is built here from the quantity that was sent. It is hidden again as soon as the shopper
 * changes the quantity, because it would no longer describe the choice on screen.
 */
export function useAddedMessage(state: AddToCart, label: string) {
  const [sent, setSent] = React.useState<number | null>(null);
  const shown = !!state.message && sent !== null && sent === state.quantity;
  return {
    /** Empty when nothing should be announced. */
    text: shown ? `Added ${sent} × ${label} to your basket.` : '',
    /** Use in place of `state.onAdd`: remembers the quantity that is being sent. */
    onAdd: () => {
      setSent(state.quantity);
      state.onAdd();
    },
  };
}

/**
 * The text under an add-to-basket control, shared by `AddToCartButton` and `PurchaseRow`: the disabled
 * reason, the *Added* live region with its View basket link, and the error. Everything comes from
 * `useAddToCart`; `message` is the confirmation sentence from `useAddedMessage`.
 */
export function AddToCartFeedback({ state, message }: { state: AddToCart; message: string }) {
  const { error } = state;
  return (
    <>
      {state.showReason && (
        <p id={state.reasonId} className="m-0 text-sm text-ink-muted">
          {state.disabledReason}
        </p>
      )}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'm-0 text-sm font-semibold text-leaf-ink empty:hidden',
          message &&
            'flex items-center justify-between gap-3 rounded-2xl bg-leaf-soft px-[18px] py-3.5',
        )}
      >
        {message && (
          <>
            <span>{message}</span>
            <Link href="/cart" className="font-semibold text-leaf-ink underline">
              View basket
            </Link>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
    </>
  );
}
