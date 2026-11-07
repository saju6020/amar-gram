import Link from 'next/link';
import { formatCycleDate } from '@/lib/subscriptions/dates';
import { orderStateLabel, quantityAndIntervalLabel } from '@/lib/subscriptions/labels';
import type { SubscriptionCycle, SubscriptionProduct } from '@/lib/api/subscriptions';
import type { StaffSubscriptionRow } from '@/lib/api/staff-subscriptions';
import { NO_DELIVERY_CANCELLED, NO_DELIVERY_PAUSED, NO_DELIVERY_SUSPENDED, unpaidShort } from '@/lib/subscriptions/copy';

/** "Cold-pressed mustard oil · 1 L". */
export function productLine(product: SubscriptionProduct): string {
  return product.variantLabel ? `${product.productName} · ${product.variantLabel}` : product.productName;
}

/** Keeps a link in a table cell or card a 44 px target (UI-1). */
export const LINK_TARGET = 'inline-flex min-h-11 items-center';

export function CustomerLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/staff/customers/${encodeURIComponent(id)}`} className={`${LINK_TARGET} font-semibold text-accent-ink hover:underline`}>
      {name}
    </Link>
  );
}

/** The product line as the row link's content: a 44 px target inside the shared table's link. */
export function ProductCell({ product }: { product: SubscriptionProduct }) {
  return <span className={`${LINK_TARGET} [overflow-wrap:anywhere]`}>{productLine(product)}</span>;
}

/** The next delivery as a date, or why there is none (the status is the server's, not a comparison). */
export function nextDeliveryText(row: Pick<StaffSubscriptionRow, 'status' | 'nextDeliveryOn'>): string {
  if (row.nextDeliveryOn) return formatCycleDate(row.nextDeliveryOn);
  if (row.status === 'Paused') return NO_DELIVERY_PAUSED;
  if (row.status === 'Suspended') return NO_DELIVERY_SUSPENDED;
  if (row.status === 'Cancelled') return NO_DELIVERY_CANCELLED;
  return '—';
}

export const scheduleText = (row: Pick<StaffSubscriptionRow, 'quantity' | 'intervalWeeks'>): string =>
  quantityAndIntervalLabel(row.quantity, row.intervalWeeks);

export const unpaidText = (streak: number): string => (streak > 0 ? unpaidShort(streak) : '—');

/** The last order: its number and its state as text, or a dash. */
export function LastOrder({ cycle }: { cycle: SubscriptionCycle | null }) {
  if (!cycle?.orderNumber) return <span>—</span>;
  return (
    <span>
      {cycle.orderNumber}
      <span className="block text-xs text-ink-muted">
        {orderStateLabel(cycle.orderState, { audience: 'staff' })}
      </span>
    </span>
  );
}
