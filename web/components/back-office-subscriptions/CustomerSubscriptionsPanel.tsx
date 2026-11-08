import Link from 'next/link';
import { Repeat } from 'lucide-react';
import type { SubscriptionView } from '@/lib/api/subscriptions';
import type { CustomerSubscriptionSummary } from '@/lib/api/staff-subscriptions';
import {
  NO_CURRENT_SUBSCRIPTIONS,
  NO_DELIVERY_CANCELLED,
  NO_DELIVERY_PAUSED,
  NO_DELIVERY_SCHEDULED,
  NO_DELIVERY_SUSPENDED,
  customerSubscriptionCounts,
  nextDeliveryLabel,
} from '@/lib/subscriptions/copy';
import { quantityAndIntervalLabel, subscriptionPaymentMethodLabel } from '@/lib/subscriptions/labels';
import { SubscriptionStatusPill } from '@/components/staff-subscriptions/SubscriptionStatusPill';

/** The next delivery as a date sentence, or why there is none (the status is the server's, not a date comparison). */
function nextDeliveryText(view: SubscriptionView): string {
  if (view.nextDeliveryOn) return nextDeliveryLabel(view.nextDeliveryOn);
  if (view.status === 'Paused') return NO_DELIVERY_PAUSED;
  if (view.status === 'Suspended') return NO_DELIVERY_SUSPENDED;
  if (view.status === 'Cancelled') return NO_DELIVERY_CANCELLED;
  return NO_DELIVERY_SCHEDULED;
}

/**
 * `components/back-office-subscriptions/CustomerSubscriptionsPanel.tsx` — HO-P6 S3 (§11.4.3, US-SUB-06), design
 * `CustomerSubscriptionsPanel.dc.html`. The customer profile's Subscriptions tab: each live subscription (Suspended
 * included, as T9 sends them) as a link to its staff detail, then the suspended and cancelled counts as text. Hook-free:
 * `CustomerProfileView` reads T9 and passes the summary in. Rows are cards at every width so a 360 px screen never scrolls
 * sideways (UI-1).
 */
export function CustomerSubscriptionsPanel({ summary }: { summary: CustomerSubscriptionSummary }) {
  return (
    <section aria-labelledby="customer-subscriptions-heading" className="flex flex-col gap-3">
      <h2 id="customer-subscriptions-heading" className="sr-only">
        Subscriptions
      </h2>
      {summary.live.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-ink-muted">
          {NO_CURRENT_SUBSCRIPTIONS}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {summary.live.map((view) => (
            <li key={view.id}>
              <Link
                href={`/staff/subscriptions/${encodeURIComponent(view.id)}`}
                className="flex min-h-11 flex-col gap-1 rounded-2xl border border-border bg-surface p-4 text-sm text-ink no-underline hover:border-border-strong"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-semibold [overflow-wrap:anywhere]">
                    <Repeat size={16} aria-hidden="true" className="flex-none text-ink-muted" />
                    {view.product.variantLabel
                      ? `${view.product.productName} · ${view.product.variantLabel}`
                      : view.product.productName}
                  </span>
                  <SubscriptionStatusPill status={view.status} />
                </span>
                <span className="text-ink-muted">
                  {quantityAndIntervalLabel(view.terms.quantity, view.terms.intervalWeeks)}
                </span>
                <span className="text-ink-muted">{nextDeliveryText(view)}</span>
                <span className="text-ink-muted">
                  {subscriptionPaymentMethodLabel(view.terms.paymentMethod)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 text-sm text-ink-muted">{customerSubscriptionCounts(summary.suspendedCount, summary.cancelledCount)}</p>
    </section>
  );
}
