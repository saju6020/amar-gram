'use client';

import Link from 'next/link';
import { Repeat } from 'lucide-react';
import { useNextSubscription } from '@/lib/hooks/useSubscriptions';
import { quantityAndIntervalLabel } from '@/lib/subscriptions/labels';
import { nextDeliveryLine } from '@/lib/subscriptions/copy';

/**
 * The overview's "Next delivery" card (HO-P6 §11.2.9, OQ-8): the soonest live subscription, read from C3
 * (`status=live&pageSize=1`; the server's order puts the soonest first). The product, "Next delivery on {date}" (or the
 * status sentence when it has none) and "Manage". No Skip or Undo here. Decoration, like the branch contacts: absent
 * when there is none, while loading and when the read fails; it never shows an error and never changes the rest of the page.
 */
export function NextDeliveryCard() {
  const query = useNextSubscription();
  const subscription = query.data?.items[0];
  if (!subscription) return null;

  const { product, terms } = subscription;
  return (
    <section
      aria-labelledby="acc-next-delivery"
      data-testid="next-delivery"
      className="flex min-w-0 flex-col gap-2 rounded-card border-[1.5px] border-border bg-surface p-5 sm:p-6"
    >
      <h2 id="acc-next-delivery" className="m-0 flex items-center gap-2 text-lg font-semibold text-ink">
        <Repeat size={18} aria-hidden="true" className="flex-none text-leaf-ink" />
        Next delivery
      </h2>
      <p className="m-0 font-semibold text-ink [overflow-wrap:anywhere]">
        {product.variantLabel ? `${product.productName} · ${product.variantLabel}` : product.productName}
      </p>
      <p className="m-0 text-[15px] text-ink-muted">{quantityAndIntervalLabel(terms.quantity, terms.intervalWeeks)}</p>
      <p className="m-0 text-[15px] text-ink">{nextDeliveryLine(subscription)}</p>
      <Link
        href={`/portal/subscriptions/${encodeURIComponent(subscription.id)}`}
        className="mt-auto inline-flex min-h-11 items-center font-semibold text-accent-ink"
      >
        Manage
      </Link>
    </section>
  );
}
