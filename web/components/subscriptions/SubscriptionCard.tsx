import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { cardClass } from '@/components/hearth/card';
import type { SubscriptionView } from '@/lib/api/subscriptions';
import { quantityAndIntervalLabel } from '@/lib/subscriptions/labels';
import { cn } from '@/lib/utils';
import { ProductThumb } from './ProductThumb';
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge';
import { nextDeliveryLine, warningLine } from '@/lib/subscriptions/copy';

/**
 * One subscription on "My subscriptions" (HO-P6 §11.2.4): the whole card opens it. Picture, product and pack, "2 × every 4
 * weeks", the status as a word with an icon, when the next delivery is (or why there is none), and at most one warning line.
 */
export function SubscriptionCard({ subscription }: { subscription: SubscriptionView }) {
  const warning = warningLine(subscription);
  const { product, terms } = subscription;
  return (
    <Link
      href={`/portal/subscriptions/${encodeURIComponent(subscription.id)}`}
      className={cn(
        cardClass,
        'flex gap-4 rounded-[20px] px-4 py-4 text-ink no-underline transition-colors hover:border-leaf sm:px-5',
      )}
    >
      <ProductThumb imageUrl={product.imageUrl} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <strong className="text-base [overflow-wrap:anywhere] sm:text-lg">
            {product.variantLabel ? `${product.productName} · ${product.variantLabel}` : product.productName}
          </strong>
          <SubscriptionStatusBadge status={subscription.status} />
        </span>
        <span className="text-sm text-ink-muted">
          {quantityAndIntervalLabel(terms.quantity, terms.intervalWeeks)}
        </span>
        <span className="text-sm font-semibold text-ink">{nextDeliveryLine(subscription)}</span>
        {warning && (
          <span className="mt-1 flex items-start gap-1.5 text-[13px] font-semibold text-warning-ink">
            <TriangleAlert size={14} aria-hidden="true" className="mt-0.5 flex-none" />
            {warning}
          </span>
        )}
      </span>
    </Link>
  );
}
