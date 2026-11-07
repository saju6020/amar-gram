import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import type { UnpaidSubscription } from '@/lib/api/staff-subscriptions';
import { DEFAULT_BRANCH_TIME_ZONE } from '@/lib/hooks/useBranchTimeZone';
import { formatCommerceInstant, formatCycleDate } from '@/lib/subscriptions/dates';
import { orderStateLabel } from '@/lib/subscriptions/labels';
import { cn } from '@/lib/utils';
import { SubscriptionStatusPill } from './SubscriptionStatusPill';
import { CustomerLink, LINK_TARGET, productLine } from './SubscriptionRowCells';
import { unpaidInARow } from './staffCopy';

/**
 * One row of the unpaid worklist (§11.3.4): the customer, the product, how many unpaid orders in a row, and each unpaid
 * order with its date, number (a link to the staff order page), pay-by time and state as text. "Open" goes to the detail.
 *
 * The unpaid view carries no `commerceTimeZoneId` (SubscriptionViewModels.cs:81-88), so a pay-by time is shown in the
 * business zone with the zone named.
 */
export function UnpaidSubscriptionCard({ item }: { item: UnpaidSubscription }) {
  return (
    <li className="min-w-0 rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm [overflow-wrap:anywhere]">
            <CustomerLink id={item.customer.id} name={item.customer.name} />
            {item.customer.mobile && <span className="text-ink-muted"> · {item.customer.mobile}</span>}
          </p>
          <p className="mt-0.5 text-sm text-ink [overflow-wrap:anywhere]">{productLine(item.product)}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <SubscriptionStatusPill status={item.status} />
            <span>{unpaidInARow(item.unpaidStreak)}</span>
          </p>
        </div>
        <Link
          href={`/staff/subscriptions/${item.id}`}
          aria-label={`Open ${item.customer.name}'s subscription to ${item.product.productName}`}
          className={cn(buttonVariants({ variant: 'secondary' }), 'min-h-11 no-underline')}
        >
          Open
        </Link>
      </div>
      <ul className="mt-3 flex flex-col gap-2 border-t border-surface-sunken pt-3 text-sm">
        {item.unpaidCycles.map((cycle) => (
          <li key={cycle.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-semibold text-ink">{formatCycleDate(cycle.cycleOn)}</span>
            {cycle.orderId && cycle.orderNumber ? (
              <Link href={`/staff/orders/${cycle.orderId}`} className={`${LINK_TARGET} text-accent-ink hover:underline`}>
                {cycle.orderNumber}
              </Link>
            ) : (
              <span className="text-ink-muted">—</span>
            )}
            {cycle.paymentExpiresOn && (
              <span className="text-ink-muted">
                Pay by {formatCommerceInstant(cycle.paymentExpiresOn, DEFAULT_BRANCH_TIME_ZONE)}
              </span>
            )}
            <span className="text-ink">{orderStateLabel(cycle.orderState, { audience: 'staff' })}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}
