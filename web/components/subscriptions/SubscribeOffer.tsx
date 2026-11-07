'use client';

import Link from 'next/link';
import { Repeat } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { useSubscriptionOptions } from '@/lib/hooks/useSubscriptions';
import { ALREADY_SUBSCRIBED_TEXT, subscribeOfferLabel } from '@/lib/subscriptions/copy';

/**
 * The product page's Subscribe offer (HO-P6 §11.2.2, ADR-FE-195, OQ-1, OQ-2). Rendered by the page only for a signed-in
 * customer and a SKU with a price; it reads the options for that SKU after the page has rendered and never blocks it.
 * Shows "Subscribe & save {n}%" (or "Subscribe" at zero), or "You already subscribe to this · Manage"; nothing while
 * loading, when the read fails, or when the product cannot be subscribed to (the form explains that if it is reached).
 */
export function SubscribeOffer({ skuId }: { skuId: string }) {
  const { data } = useSubscriptionOptions(skuId);
  if (!data) return null;

  if (data.existingSubscriptionId) {
    return (
      <p
        data-testid="subscribe-offer"
        className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-ink"
      >
        <Repeat size={16} className="flex-none text-leaf-ink" aria-hidden="true" />
        <span>{ALREADY_SUBSCRIBED_TEXT}</span>
        <span aria-hidden="true">·</span>
        <Link
          href={`/portal/subscriptions/${encodeURIComponent(data.existingSubscriptionId)}`}
          className="inline-flex min-h-11 items-center font-semibold text-accent-ink"
        >
          Manage
        </Link>
      </p>
    );
  }

  if (!data.subscribable) return null;

  return (
    <div data-testid="subscribe-offer" className="flex flex-col gap-1.5">
      <Link
        href={`/portal/subscriptions/new/${encodeURIComponent(skuId)}`}
        className={buttonVariants({ variant: 'pillSecondary', size: 'pillMd', className: 'w-full sm:w-auto' })}
      >
        <Repeat size={16} aria-hidden="true" />
        {subscribeOfferLabel(data.discountPercent)}
      </Link>
      <p className="m-0 text-[13px] text-ink-muted">Get this on repeat. Skip, pause or cancel any time.</p>
    </div>
  );
}
