'use client';

import Link from 'next/link';
import { Panel } from '@/components/back-office/Panel';
import { ApiForbiddenError } from '@/lib/api/client';
import type { StaffOrderStatusCounts } from '@/lib/api/staff-orders';
import { orderStatusLabel } from '@/lib/format/orders';
import { useStaffOrderStatusCounts } from '@/lib/hooks/useStaffOrders';

/** The statuses the design draws, in pipeline order (HO-P5 §11.3.4). Each is a link to the orders filtered by it. */
const PIPELINE: ReadonlyArray<string> = ['Confirmed', 'Packing', 'Packed', 'Dispatched'];

/**
 * `components/back-office-overview/DashboardPipeline.tsx` — HO-P5 §11.3.4 (BG-2), US-RPT-05. "Orders in
 * progress": one bar for each of Confirmed, Packing, Packed and Dispatched, its length the server's count as
 * a share of the largest of the four (geometry only), the count itself written as text, and the whole row a
 * link to `/staff/orders?status=X`. Under it, the server's `total` for all orders. Nothing is added up here.
 * The panel is absent for a role that cannot see orders (a `403` drops it with no banner) and after a failed
 * read, like "Needs attention".
 */
function PipelineBars({ counts }: { counts: StaffOrderStatusCounts }) {
  const rows = PIPELINE.map((status) => ({ status, count: counts.counts.find((c) => c.status === status)?.count ?? 0 }));
  const peak = Math.max(0, ...rows.map((row) => row.count));
  return (
    <ul aria-label="Orders in progress by status" className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map((row) => (
        <li key={row.status}>
          <Link
            href={`/staff/orders?status=${encodeURIComponent(row.status)}`}
            className="grid min-h-11 grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-1 text-sm text-ink no-underline hover:bg-surface-sunken"
          >
            <span className="font-semibold">{orderStatusLabel(row.status)}</span>
            <span aria-hidden="true" className="block h-3 overflow-hidden rounded-full bg-surface-sunken">
              <span
                className="block h-full rounded-full bg-leaf"
                style={{ width: `${peak > 0 ? Math.round((row.count / peak) * 100) : 0}%` }}
              />
            </span>
            <span className="min-w-8 text-right font-bold tabular-nums">
              {row.count}
              <span className="sr-only"> {row.count === 1 ? 'order' : 'orders'}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DashboardPipeline() {
  const counts = useStaffOrderStatusCounts({});
  if (counts.error instanceof ApiForbiddenError) return null;
  if (counts.isError && !counts.data) return null;
  return (
    <Panel title="Orders in progress">
      {counts.data ? (
        <div className="flex flex-col gap-3">
          <PipelineBars counts={counts.data} />
          <p className="m-0 border-t border-surface-sunken pt-3 text-sm text-ink-muted">
            <Link href="/staff/orders" className="font-semibold text-accent-ink underline">
              All orders
            </Link>
            : {counts.data.total}
          </p>
        </div>
      ) : (
        <p role="status" className="text-sm text-ink-muted">
          Checking…
        </p>
      )}
    </Panel>
  );
}
