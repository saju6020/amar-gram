'use client';

import Link from 'next/link';
import type { AddToCart } from '@/lib/hooks/useAddToCart';

/**
 * The text under an add-to-cart control, shared by `AddToCartButton` and `PurchaseRow`: the disabled
 * reason, the *Added* live region with its View cart link, and the error. Everything comes from `useAddToCart`.
 */
export function AddToCartFeedback({ state }: { state: AddToCart }) {
  const { message, error } = state;
  return (
    <>
      {state.showReason && (
        <p id={state.reasonId} className="m-0 text-sm text-ink-muted">
          {state.disabledReason}
        </p>
      )}
      <p role="status" aria-live="polite" className="m-0 text-sm font-semibold text-accent-ink">
        {message}
        {message && (
          <>
            {' '}
            <Link href="/cart" className="underline">
              View cart
            </Link>
          </>
        )}
      </p>
      {error && (
        <p role="alert" className="m-0 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
    </>
  );
}
