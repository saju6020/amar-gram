'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Amount } from '@/components/billing/Amount';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { mainActionClass } from '@/components/hearth/buttons';
import { summaryCardClass } from '@/components/hearth/card';
import { ProductPackArt } from '@/components/hearth/ProductPackArt';
import { OrderSummary } from '@/components/orders/OrderSummary';
import { Button } from '@/components/ui/button';
import type { CheckoutQuote } from '@/lib/api/checkout';
import { describeBlockingReason, describeExcludedReason } from '@/lib/api/errors';
import { resolveFileUrl } from '@/lib/api/files';
import { formatMoney } from '@/lib/format/money';
import { cn } from '@/lib/utils';
import { CheckoutFreeDelivery } from './CheckoutFreeDelivery';

const ASIDE_CLASS = cn(summaryCardClass, 'flex min-w-0 flex-col gap-4 p-5 sm:p-6');
const HEADING_ID = 'co-basket-heading';

function AsideHeading() {
  return (
    <h2 id={HEADING_ID} className="m-0 font-display text-2xl font-bold text-ink">
      Your basket
    </h2>
  );
}

/** The aside while the quote is loading or has failed: the heading, and the reason there is no total yet. */
export function OrderAsideFallback({
  failed,
  onRetry,
}: {
  failed: boolean;
  onRetry: () => void;
}) {
  return (
    <aside aria-label="Your basket" className={ASIDE_CLASS}>
      <AsideHeading />
      {failed ? (
        <ErrorState
          title="We couldn't price your order just now."
          description="Your choices are saved in this page's address — please try again."
          headingLevel={3}
          onRetry={onRetry}
        />
      ) : (
        <LoadingState rows={4} label="Pricing your order…" />
      )}
    </aside>
  );
}

/**
 * `components/checkout/OrderAside.tsx` — the "Your basket" aside of the single-page checkout (HO-P3 S3,
 * ADR-FE-175; docs/design/store/Checkout.dc.html). The quote's lines in compact form, the discount code, the
 * six-row `OrderSummary` (every figure the server's), the changes panel and pending policies the screen passes
 * in, then **Place order** (papaya, 56 px) and the terms line. Place order stays disabled while the quote is
 * settling, while any blocking reason or unfinished choice stands, or while the changes are not acknowledged
 * *for this quote*; every such reason is listed above the button (`aria-describedby`). On a phone the quote's
 * `grandTotal` and the button are pinned to the bottom (the label becomes "Place order · ৳total"); nothing
 * here adds anything up.
 */
export function OrderAside({
  quote,
  fulfilment,
  settling,
  choiceReasons,
  changesPanel,
  policiesPanel,
  discountField,
  needsAcknowledgement,
  acknowledged,
  placing,
  inProgress,
  placeError,
  paymentMethod,
  imageBySku,
  onPlace,
}: {
  quote: CheckoutQuote;
  fulfilment: string;
  settling: boolean;
  /** What is still to choose above (address, time, payment), in the customer's words. */
  choiceReasons: string[];
  changesPanel: ReactNode;
  policiesPanel: ReactNode;
  discountField: ReactNode;
  needsAcknowledgement: boolean;
  acknowledged: boolean;
  placing: boolean;
  inProgress: boolean;
  placeError: string | null;
  paymentMethod?: string;
  /** SKU id → photo URL from the basket (the quote carries no images). */
  imageBySku?: ReadonlyMap<string, string | null>;
  onPlace: () => void;
}) {
  const hasSummary = quote.lines.length > 0;

  const reasons: string[] = [];
  if (settling) reasons.push('Updating your total…');
  for (const code of quote.blockingReasons) reasons.push(describeBlockingReason(code));
  for (const reason of choiceReasons) reasons.push(reason);
  if (needsAcknowledgement && !acknowledged) {
    reasons.push('Tick “I’ve reviewed these changes.” to continue.');
  }
  if (inProgress) reasons.push('This order is already being placed.');
  const unique = [...new Set(reasons)];
  const disabled =
    settling ||
    placing ||
    inProgress ||
    !quote.canPlace ||
    choiceReasons.length > 0 ||
    (needsAcknowledgement && !acknowledged);

  return (
    <aside aria-label="Your basket" className={ASIDE_CLASS}>
      <AsideHeading />

      {hasSummary ? (
        <ul aria-label="Items in this order" className="m-0 flex list-none flex-col gap-3 p-0">
          {quote.lines.map((line) => {
            const imageUrl = resolveFileUrl(imageBySku?.get(line.skuId));
            return (
              <li key={line.lineRef} className="flex items-center gap-3">
                <span aria-hidden="true" className="block size-[52px] flex-none overflow-hidden rounded-xl">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a signed API file URL, not a build-time asset
                    <img src={imageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <ProductPackArt tone="sunken" className="size-full" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-snug">
                  <strong className="text-[15px] [overflow-wrap:anywhere]">{line.productName}</strong>
                  <span className="text-[13px] text-ink-muted [overflow-wrap:anywhere]">
                    {`${line.quantity} × ${line.variantLabel}`}
                  </span>
                </span>
                <strong className="whitespace-nowrap">
                  <Amount money={line.lineTotal} />
                </strong>
              </li>
            );
          })}
        </ul>
      ) : (
        // Issues.md #9 — every line was left out, so there is nothing to price: say so instead of a column of 0.00s.
        <p className="m-0 text-sm text-ink">
          None of the items in your basket can be ordered right now, so there is nothing to price.{' '}
          <Link href="/cart" className="font-semibold text-accent-ink underline">
            Back to your basket
          </Link>
        </p>
      )}

      {quote.excludedLines.length > 0 && (
        <section
          aria-labelledby="left-out-heading"
          className="rounded-2xl bg-surface-sunken px-4 py-3.5"
        >
          <h3 id="left-out-heading" className="m-0 text-sm font-bold text-ink">
            Left out of this order
          </h3>
          <ul className="m-0 mt-1.5 list-disc pl-5 text-sm text-ink">
            {quote.excludedLines.map((line) => (
              <li key={line.lineRef}>
                <b>{line.productName}</b> — {describeExcludedReason(line.reasonCode)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasSummary && discountField}
      {hasSummary && (
        <div className="border-t-[1.5px] border-dashed border-border-strong pt-3">
          <OrderSummary
            appearance="hearth"
            bare
            totals={quote.totals}
            discountCode={quote.discount?.applied ? quote.discount.code : null}
            serviceLevel={quote.selectedServiceLevel}
            fulfilment={fulfilment}
          />
        </div>
      )}

      <CheckoutFreeDelivery quote={quote} />
      {changesPanel}
      {policiesPanel}

      {placeError && (
        <p
          role="alert"
          className="m-0 rounded-2xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger-ink"
        >
          {placeError}
        </p>
      )}
      {unique.length > 0 && (
        <div id="place-why" className="rounded-2xl bg-surface-sunken px-4 py-3 text-[13px] text-ink">
          <p className="m-0">To place your order:</p>
          <ul className="m-0 mt-1.5 list-disc pl-[18px]">
            {unique.map((reason) => (
              <li key={reason} className="mt-0.5">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {inProgress && (
        <p className="m-0 text-sm">
          <Link href="/portal/orders" className="font-semibold text-accent-ink underline">
            Check my orders
          </Link>{' '}
          to see whether it went through.
        </p>
      )}

      {/* Phone: pinned to the bottom with the server's total. The scroll-padding for this bar is in globals.css,
          and the checkout screen reserves the space below its content. */}
      <div
        data-sticky-bar=""
        className="flex min-w-0 flex-col gap-1.5 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-10 max-md:border-t-[1.5px] max-md:border-border max-md:bg-surface max-md:px-4 max-md:pb-4 max-md:pt-3"
      >
        {hasSummary && (
          <p className="m-0 flex items-baseline justify-between gap-3 text-sm text-ink-muted md:hidden">
            <span>Total</span>
            <b className="font-display text-xl text-ink">
              <Amount money={quote.totals.grandTotal} />
            </b>
          </p>
        )}
        <Button
          variant="pill"
          size="pillLg"
          disabled={disabled}
          aria-busy={placing}
          aria-describedby={unique.length > 0 ? 'place-why' : undefined}
          onClick={onPlace}
          className={cn(mainActionClass, 'min-h-14 text-[17px]')}
        >
          {placing ? (
            'Placing your order…'
          ) : (
            <>
              Place order
              <span className="md:hidden">{` · ${formatMoney(quote.totals.grandTotal)}`}</span>
            </>
          )}
        </Button>
        {disabled && unique.length > 0 && (
          <p className="m-0 truncate text-xs text-ink-muted md:hidden">
            Can&rsquo;t place yet &mdash; see the reasons above.
          </p>
        )}
      </div>

      <p className="m-0 text-center text-[13px] text-ink-muted">
        By placing the order you agree to our{' '}
        <Link href="/policies/terms" className="font-semibold text-accent-ink underline">
          terms
        </Link>
        .
      </p>
      {paymentMethod === 'BankTransfer' && hasSummary && (
        <p className="m-0 text-center text-xs leading-relaxed text-ink-muted max-md:hidden">
          {`You transfer ${formatMoney(quote.totals.grandTotal)} to our bank after placing it. Nothing is charged on this website.`}
        </p>
      )}
    </aside>
  );
}
