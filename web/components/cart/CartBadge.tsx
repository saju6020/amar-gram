'use client';

import Link from 'next/link';
import { ShoppingBasket, ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/hooks/useCart';

/**
 * `components/cart/CartBadge.tsx` — HO-ORD-002 §3.3, restyled for HO-P3 (§8.3, ADR-FE-174: visible copy
 * says "basket"; the route stays `/cart`). The basket link for a storefront or portal header: the item
 * count from `['cart']`, **hidden at 0**, linking to `/cart`. It also mounts `useCart`, so a signed-in
 * customer with a waiting guest cart has it merged wherever they land first. A failed read shows the
 * link without a count rather than an error in the header.
 *
 * - `pill` (default): the dark "Basket · N" pill, named "Basket, N items". Below 640 px the word is
 *   dropped (icon and count stay; the accessible name is unchanged) so the pinned header fits 360 px.
 * - `icon`: a round leaf button with a mango count (the account header).
 */
export function CartBadge({ appearance = 'pill' }: { appearance?: 'pill' | 'icon' } = {}) {
  const { data } = useCart();
  const count = data?.itemCount ?? 0;
  const name = count > 0 ? `Basket, ${count} ${count === 1 ? 'item' : 'items'}` : 'Basket';
  if (appearance === 'icon') {
    return (
      <Link
        href="/cart"
        aria-label={name}
        className="relative grid size-11 place-items-center rounded-full bg-leaf text-leaf-soft no-underline hover:bg-leaf-ink"
      >
        <ShoppingCart size={20} aria-hidden="true" />
        {count > 0 && (
          <span
            data-testid="cart-count"
            aria-hidden="true"
            className="absolute -right-1.5 -top-1.5 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-warm px-1.5 text-xs font-bold text-ink"
          >
            {count}
          </span>
        )}
      </Link>
    );
  }
  return (
    <Link
      href="/cart"
      className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-ink px-4 text-sm font-semibold text-surface-page no-underline hover:bg-leaf-ink"
      aria-label={name}
    >
      <ShoppingBasket size={18} aria-hidden="true" />
      <span aria-hidden="true" className="hidden sm:inline">
        Basket
      </span>
      {count > 0 && (
        <span
          data-testid="cart-count"
          aria-hidden="true"
          className="inline-grid h-[22px] min-w-[22px] place-items-center rounded-pill bg-warm px-1.5 text-xs font-bold text-ink"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
