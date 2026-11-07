'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Panel } from '@/components/back-office/Panel';
import { ResponsiveTable, type Column } from '@/components/billing/ResponsiveTable';
import { Button } from '@/components/ui/button';
import type { SubscriptionCycle } from '@/lib/api/subscriptions';
import { STAFF_CYCLES_PAGE_SIZE, useStaffSubscriptionMoreCycles } from '@/lib/hooks/useStaffSubscriptions';
import { formatCommerceInstant, formatCycleDate } from '@/lib/subscriptions/dates';
import { LINK_TARGET } from './SubscriptionRowCells';
import { cycleOutcomeText } from '@/lib/subscriptions/labels';

/** What happened at a cycle: the order's state as text, the server's sentence for a failure, and the pay-by time when there is one. */
function outcomeCell(cycle: SubscriptionCycle, zone: string) {
  return (
    <span>
      {cycleOutcomeText(cycle, { audience: 'staff', commerceTimeZoneId: zone })}
      {cycle.paymentExpiresOn && (
        <span className="block text-xs text-ink-muted">Pay by {formatCommerceInstant(cycle.paymentExpiresOn, zone)}</span>
      )}
    </span>
  );
}

/**
 * HO-P6 S2 (§11.3.5). The order history: the latest 50 cycles the detail carries, and "Show more" for the pages after them
 * (T6). An order number links to the staff order page; if that order was raised at another branch the order page shows its
 * own refusal (§20.9) and the link is kept.
 */
export function CycleHistory({ subscriptionId, cycles, zone }: { subscriptionId: string; cycles: SubscriptionCycle[]; zone: string }) {
  const [lastPage, setLastPage] = useState(1);
  const more = useStaffSubscriptionMoreCycles(subscriptionId, lastPage);
  const shown = [...cycles, ...more.cycles];
  // The detail's 50 may be everything; a full page is the only sign there could be more.
  const mayHaveMore =
    lastPage === 1
      ? cycles.length >= STAFF_CYCLES_PAGE_SIZE
      : more.isFetching || (more.totalCount !== null && shown.length < more.totalCount);

  const columns: Array<Column<SubscriptionCycle>> = [
    { id: 'date', header: 'Delivery date', primary: true, cell: (c) => formatCycleDate(c.cycleOn) },
    {
      id: 'order',
      header: 'Order',
      cell: (c) =>
        c.orderId && c.orderNumber ? (
          <Link href={`/staff/orders/${encodeURIComponent(c.orderId)}`} className={`${LINK_TARGET} text-accent-ink hover:underline`}>
            {c.orderNumber}
          </Link>
        ) : (
          '—'
        ),
    },
    { id: 'outcome', header: 'What happened', cell: (c) => outcomeCell(c, zone) },
  ];

  return (
    <Panel title="Order history">
      <div className="flex flex-col gap-3">
        <ResponsiveTable
          caption="Order history"
          columns={columns}
          rows={shown}
          getRowId={(c) => c.id}
          emptyState={{ title: 'No orders yet.', description: 'The first order is placed on the first delivery date.' }}
        />
        {more.isError && (
          <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className="text-sm font-semibold text-danger-ink">
              We couldn&rsquo;t load more orders.
            </p>
            <Button variant="secondary" className="min-h-11" onClick={more.retry}>
              Try again
            </Button>
          </div>
        )}
        {mayHaveMore && !more.isError && (
          <div>
            <Button
              variant="secondary"
              className="min-h-11"
              disabled={more.isFetching}
              aria-busy={more.isFetching}
              onClick={() => setLastPage((page) => page + 1)}
            >
              {more.isFetching ? 'Loading…' : 'Show more'}
            </Button>
          </div>
        )}
        {!mayHaveMore && !more.isError && shown.length > 0 && (
          <p className="text-sm text-ink-muted">{`All ${shown.length} ${shown.length === 1 ? 'entry' : 'entries'} shown. Order numbers open the staff order page.`}</p>
        )}
      </div>
    </Panel>
  );
}
