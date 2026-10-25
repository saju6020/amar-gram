'use client';

import Link from 'next/link';
import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Amount } from '@/components/billing/Amount';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { bannerWarnClass, summaryCardClass } from '@/components/hearth/card';
import { mainActionClass } from '@/components/hearth/buttons';
import { HearthEmpty } from '@/components/hearth/HearthEmpty';
import type { PackTone } from '@/components/hearth/ProductPackArt';
import { Button, buttonVariants } from '@/components/ui/button';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/components/ui/use-toast';
import { describeOrderingError } from '@/lib/api/errors';
import {
  useAddCartLine,
  useCart,
  useCartMergeNotice,
  useRemoveCartLine,
  useUpdateCartLine,
} from '@/lib/hooks/useCart';
import { useCustomerSession } from '@/lib/hooks/useSession';
import { useHydrated } from '@/lib/hooks/useHydrated';
import type { CartLine } from '@/lib/api/cart';
import { cn } from '@/lib/utils';
import { CartLineRow } from './CartLineRow';
import { CartMergeNotice } from './CartMergeNotice';

const TILE_TONES: PackTone[] = ['warm', 'sunken', 'teal'];

/**
 * `components/cart/CartScreen.tsx` — ⭐ HO-ORD-002 §11.1 `CartPage`, US-ORD-01, 02, rebuilt for HO-P3 S3
 * (docs/design/store/BasketPhone.dc.html; visible copy says "basket", ADR-FE-174). Lines as rounded cards
 * with image, variant, quantity stepper, line subtotal and **Remove** (reversible, so no confirm — an *Undo*
 * toast re-adds the line); availability and price changes as text. The summary shows the **server's**
 * subtotal and *"Delivery and total are worked out at checkout"*: no total, delivery charge or
 * free-delivery figure is worked out here (the basket has no address or zone, so the server cannot say; G5).
 * **Go to checkout** (signed out → sign-in with `?next=/checkout`). An unavailable line blocks it until it
 * is removed, with the reason beside the button. Loading, empty and error states are all real. On a phone
 * the summary footer (subtotal and the Checkout pill) sticks to the bottom.
 */
export function CartScreen() {
  const cart = useCart();
  const hydrated = useHydrated();
  const session = useCustomerSession();
  const update = useUpdateCartLine();
  const remove = useRemoveCartLine();
  const add = useAddCartLine();
  const { notice, dismiss } = useCartMergeNotice();
  const [error, setError] = useState<string | null>(null);
  const busy = update.isPending || remove.isPending || add.isPending;

  // The header's CartBadge may already have the cart when this page hydrates: keep the server's loading state
  // for the hydration render, then show the cart.
  if (!hydrated || cart.isPending) return <LoadingState rows={5} label="Loading your basket…" />;
  if (cart.isError || !cart.data) {
    return (
      <ErrorState
        title="We couldn't load your basket."
        description="Your items are safe — please try again."
        headingLevel={2}
        onRetry={() => void cart.refetch()}
      />
    );
  }

  const data = cart.data;
  const signedIn = !!session.data;
  const blocker = data.lines.find((line) => line.availability === 'Unavailable');

  function changeQuantity(line: CartLine, quantity: number) {
    setError(null);
    update.mutate(
      { lineId: line.lineId, quantity },
      { onError: (failure) => setError(describeOrderingError(failure)) },
    );
  }

  function removeLine(line: CartLine) {
    setError(null);
    remove.mutate(line.lineId, {
      onSuccess: () => {
        const label = `${line.productName} ${line.variantLabel}`.trim();
        toast({
          title: `Removed ${label} from your basket.`,
          action: (
            <ToastAction
              altText={`Undo removing ${label}`}
              onClick={() => add.mutate({ skuId: line.skuId, quantity: line.quantity })}
            >
              Undo
            </ToastAction>
          ),
        });
      },
      onError: (failure) => setError(describeOrderingError(failure)),
    });
  }

  const checkoutHref = signedIn ? '/checkout' : `/sign-in?next=${encodeURIComponent('/checkout')}`;
  const checkoutLabel = signedIn || session.isPending ? 'Go to checkout' : 'Sign in to check out';
  const hasLines = data.lines.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
        <h1 className="m-0 font-display text-[32px] font-bold leading-[1.1] tracking-tight text-ink md:text-[40px]">
          Your basket
        </h1>
        {hasLines && (
          <span className="rounded-pill bg-warm-soft px-3.5 py-1.5 text-[13px] font-bold text-warm-ink">
            {`${data.itemCount} ${data.itemCount === 1 ? 'item' : 'items'}`}
          </span>
        )}
        {hasLines && <span className="text-[13px] text-ink-muted md:hidden">Step 1 of 2</span>}
      </div>
      {notice && <CartMergeNotice result={notice} onDismiss={dismiss} />}
      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-danger-bg px-[18px] py-3.5 text-sm font-semibold text-danger-ink"
        >
          {error}
        </p>
      )}
      {!hasLines ? (
        <HearthEmpty
          title="Your basket is empty."
          description="Find organic food and everyday goods — what you add stays here, even if you sign in later."
          action={
            <Link href="/shop" className={buttonVariants({ variant: 'pill', size: 'pillLg' })}>
              Browse the shop
            </Link>
          }
        />
      ) : (
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section aria-label="Items in your basket" className="min-w-0">
            <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
              {data.lines.map((line, index) => (
                <CartLineRow
                  key={line.lineId}
                  line={line}
                  maxQuantityPerLine={data.maxQuantityPerLine}
                  busy={busy}
                  tone={TILE_TONES[index % TILE_TONES.length]}
                  onQuantity={(quantity) => changeQuantity(line, quantity)}
                  onRemove={() => removeLine(line)}
                />
              ))}
            </ul>
          </section>
          {/* Below md the two wrappers vanish (`contents`) so the sticky bar is pinned against the
              whole page; the summary, warning and notes stay in normal flow above it. */}
          <div className="flex min-w-0 flex-col gap-4 max-md:contents">
            <aside
              aria-label="Basket summary"
              className={cn(summaryCardClass, 'flex flex-col gap-4 max-md:contents')}
            >
              <div className="flex flex-col gap-4">
                <h2 className="m-0 font-display text-2xl font-bold text-ink max-md:sr-only">
                  Basket summary
                </h2>
                <dl className="m-0 max-md:hidden">
                  <div className="flex items-baseline justify-between gap-3 text-base">
                    <dt className="font-semibold text-ink">{`Subtotal (${data.itemCount} ${data.itemCount === 1 ? 'item' : 'items'})`}</dt>
                    <dd className="m-0 whitespace-nowrap font-display text-[28px] font-bold text-ink">
                      <Amount money={data.subtotal} />
                    </dd>
                  </div>
                </dl>
                <p className="m-0 rounded-2xl border-[1.5px] border-dashed border-border-strong px-4 py-3.5 text-sm text-ink-muted">
                  Delivery and total are worked out at checkout.
                </p>
                {blocker && (
                  <p className={cn(bannerWarnClass, 'm-0')}>
                    <TriangleAlert size={15} aria-hidden="true" className="mt-0.5 flex-none" />
                    Remove the unavailable item to continue to checkout.
                  </p>
                )}
              </div>
              {!signedIn && !session.isPending && (
                <p className="m-0 text-center text-xs leading-relaxed text-ink-muted md:order-3">
                  You&rsquo;ll be asked to sign in first — your basket comes with you.
                </p>
              )}
              {/* Phone: the bar holds the server's subtotal, the Go to checkout pill and, when it is
                  disabled, a one-line reason. Scroll-padding is in globals.css. */}
              <div
                data-sticky-bar=""
                className="flex min-w-0 flex-col gap-1.5 max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-4 max-md:border-t-[1.5px] max-md:border-border max-md:bg-surface max-md:px-4 max-md:pb-4 max-md:pt-3 md:order-2"
              >
                <p className="m-0 flex items-baseline justify-between gap-3 text-sm text-ink-muted md:hidden">
                  <span>Subtotal</span>
                  <b className="font-display text-xl text-ink">
                    <Amount money={data.subtotal} />
                  </b>
                </p>
                {blocker ? (
                  <>
                    <Button
                      variant="pill"
                      size="pillLg"
                      disabled
                      aria-describedby="checkout-why"
                      className={mainActionClass}
                    >
                      {checkoutLabel}
                    </Button>
                    <p id="checkout-why" className="m-0 text-center text-xs text-ink-muted">
                      {`Disabled: ${blocker.productName} is unavailable.`}
                    </p>
                  </>
                ) : (
                  <Link
                    href={checkoutHref}
                    className={cn(
                      buttonVariants({ variant: 'pill', size: 'pillLg' }),
                      mainActionClass,
                    )}
                  >
                    {checkoutLabel}
                  </Link>
                )}
              </div>
            </aside>
            {signedIn && (
              <p className="m-0 text-sm text-ink-muted max-lg:hidden">
                Your basket is saved to your account, so it&rsquo;s there on your other devices too.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
