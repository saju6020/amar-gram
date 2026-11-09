'use client';

import Link from 'next/link';
import { Amount } from '@/components/billing/Amount';
import { OrderTrackerCard } from '@/components/orders/OrderTrackerCard';
import type { PortalOrderItem } from '@/lib/api/portal';
import { paymentMethodLabel } from '@/lib/format/orders';
import { useMyOrder } from '@/lib/hooks/useMyOrders';
import { orderTrackerSteps } from '@/lib/orders/tracker';
import { portalOrderHref } from '@/lib/routing/portal-links';

/** Orders that are still on their way (the overview's live order card shows the newest of these). */
const OPEN_STATUSES = ['PendingPayment', 'Confirmed', 'Packing', 'Packed', 'Dispatched'];

const HEADLINES: Record<string, string> = {
  PendingPayment: 'is waiting for your transfer',
  Confirmed: 'is confirmed',
  Packing: 'is being packed',
  Packed: 'is packed',
  Dispatched: 'is on its way',
};

/** The newest open order in the dashboard's orders, or null. */
export function newestOpenOrder(items: PortalOrderItem[]): PortalOrderItem | null {
  const open = items.filter((order) => OPEN_STATUSES.includes(order.status));
  open.sort((a, b) => Date.parse(b.placedOn) - Date.parse(a.placedOn));
  return open[0] ?? null;
}

/**
 * `components/portal/dashboard/LiveOrderCard.tsx` — the overview's live order (docs/design/store/Account.dc.html
 * "Order … is on its way", HO-P3 S4): the newest open order, its tracker (server status and history only) and a
 * "View order" link. The tracker reads the order through `useMyOrder`; while that loads, or if it fails, the card
 * still names the order and links to it, so the customer is never left without the way in.
 */
export function LiveOrderCard({ order }: { order: PortalOrderItem }) {
  const detail = useMyOrder(order.orderId);
  const data = detail.data;
  const steps = data
    ? orderTrackerSteps(data, { waitingForTransfer: data.status === 'PendingPayment' })
    : null;
  const slot = data?.fulfilment.slotWindow ?? data?.fulfilment.slotDate ?? null;

  return (
    <section
      aria-labelledby="acc-track"
      data-testid="live-order"
      className="flex min-w-0 flex-col gap-4 rounded-card border-[1.5px] border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="acc-track" className="m-0 text-xl font-semibold text-ink">
          {`Order ${order.orderNumber} ${HEADLINES[order.status] ?? 'is open'}`}
        </h2>
        <Link
          href={portalOrderHref(order.orderId)}
          aria-label={`View order ${order.orderNumber}`}
          className="inline-flex min-h-11 items-center font-semibold text-accent-ink"
        >
          View order
        </Link>
      </div>
      {steps && <OrderTrackerCard steps={steps} bare />}
      {data && (
        <p className="m-0 text-[15px] text-ink-muted">
          {slot ? `${slot} · ` : ''}
          {paymentMethodLabel(data.paymentMethod)} · <Amount money={data.totals.grandTotal} />
        </p>
      )}
    </section>
  );
}
