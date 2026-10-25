'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Amount, AmountCell } from '@/components/billing/Amount';
import { ResponsiveTable, type Column } from '@/components/billing/ResponsiveTable';
import { Panel } from '@/components/back-office/Panel';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { ApiForbiddenError } from '@/lib/api/client';
import type { StaffOrderRow } from '@/lib/api/staff-orders';
import { useStaffOrderQueue } from '@/lib/hooks/useStaffOrders';

const LATEST_ORDERS = { pageSize: 5 } as const;

/** The screen width from which the five-column table fits the panel beside the sidebar. */
const TABLE_MIN_WIDTH_PX = 1024;

const CHANNEL_LABELS: Record<string, string> = { Online: 'Online', Counter: 'Counter' };
const channelLabel = (order: StaffOrderRow) => CHANNEL_LABELS[order.channel] ?? order.channel;

const columns: Array<Column<StaffOrderRow>> = [
  {
    id: 'number',
    header: 'Order',
    primary: true,
    cell: (order) => <OrderLink order={order} />,
  },
  { id: 'customer', header: 'Customer', cell: (order) => order.customerName },
  { id: 'channel', header: 'Channel', cell: channelLabel },
  { id: 'status', header: 'Status', cell: (order) => <OrderStatusBadge status={order.status} /> },
  { id: 'total', header: 'Total', numeric: true, cell: (order) => <AmountCell money={order.grandTotal} /> },
];

function OrderLink({ order }: { order: StaffOrderRow }) {
  return (
    <Link href={`/staff/orders/${order.id}`} className="font-semibold text-ink underline">
      {order.orderNumber}
    </Link>
  );
}

/** True from `minWidth` px up; true where `matchMedia` does not exist (the table, as `ResponsiveTable` does). */
function useWideScreen(minWidth: number): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(`(min-width: ${minWidth}px)`);
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [minWidth]);
  return wide;
}

/**
 * `components/back-office-overview/DashboardLatestOrders.tsx` — HO-P4 §11.2.4, US-ORD-09. The five
 * newest rows of the staff order list (the server sorts newest first) and an "All orders" link. The
 * table needs room the panel only has from 1024 px, so narrower screens get one compact card per
 * order (status and total on their own lines). A `403` (a role without Orders) drops the whole
 * panel; any other failure shows inside it, with Try again, and never replaces the dashboard.
 */
export function DashboardLatestOrders() {
  const orders = useStaffOrderQueue(LATEST_ORDERS);
  const wide = useWideScreen(TABLE_MIN_WIDTH_PX);
  if (orders.error instanceof ApiForbiddenError) return null;

  const rows = orders.data?.items.slice(0, LATEST_ORDERS.pageSize);

  return (
    <Panel
      title="Latest orders"
      actions={
        <Link href="/staff/orders" className="text-sm font-semibold text-accent-ink underline">
          All orders
        </Link>
      }
    >
      {wide ? (
        <ResponsiveTable
          caption="Latest orders"
          columns={columns}
          rows={rows}
          getRowId={(order) => order.id}
          isLoading={orders.isPending}
          isError={orders.isError}
          onRetry={() => void orders.refetch()}
          emptyState={{ title: 'No orders yet', description: 'New orders appear here as they come in.' }}
          minDesktopWidth={0}
        />
      ) : orders.isPending ? (
        <LoadingState variant="table" rows={5} label="Loading Latest orders…" />
      ) : orders.isError && !rows ? (
        <ErrorState onRetry={() => void orders.refetch()} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState title="No orders yet" description="New orders appear here as they come in." />
      ) : (
        <ul aria-label="Latest orders" className="m-0 flex list-none flex-col gap-3 p-0">
          {rows.map((order) => (
            <li
              key={order.id}
              className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <OrderLink order={order} />
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-ink-muted">
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {order.customerName} · {channelLabel(order)}
                </span>
                <span className="font-semibold text-ink">
                  <Amount money={order.grandTotal} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
