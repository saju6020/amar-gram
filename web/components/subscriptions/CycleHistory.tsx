'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { SubscriptionCycle } from '@/lib/api/subscriptions';
import { useNarrowContainer } from '@/lib/hooks/useIsNarrow';
import { useMySubscriptionCycles } from '@/lib/hooks/useSubscriptions';
import { formatCycleDate } from '@/lib/subscriptions/dates';
import { cycleOutcomeText } from '@/lib/subscriptions/labels';
import { Panel } from './DetailPanels';

/** `SubscriptionRules.CustomerCycleHistory` (SubscriptionRules.cs:23): the detail carries the latest 12; "Show more" pages C5 by 12. */
const PAGE = 12;

type Layout = 'table' | 'cards';

function OrderLink({ cycle }: { cycle: SubscriptionCycle }) {
  if (!cycle.orderId || !cycle.orderNumber) return <span className="text-ink-muted">No order</span>;
  return (
    <Link
      href={`/portal/orders/${encodeURIComponent(cycle.orderId)}`}
      className="inline-flex min-h-11 items-center font-semibold text-accent-ink"
    >
      {cycle.orderNumber}
    </Link>
  );
}

function CycleRow({ cycle, zone, layout }: { cycle: SubscriptionCycle; zone: string; layout: Layout }) {
  const what = cycleOutcomeText(cycle, { audience: 'customer', commerceTimeZoneId: zone });
  if (layout === 'table') {
    return (
      <tr className="border-t border-border align-top">
        <td className="py-2 pr-4 font-semibold text-ink">{formatCycleDate(cycle.cycleOn)}</td>
        <td className="py-2 pr-4 text-ink">{what}</td>
        <td className="py-2">
          <OrderLink cycle={cycle} />
        </td>
      </tr>
    );
  }
  return (
    <li className="flex flex-col gap-0.5 rounded-2xl border-[1.5px] border-border p-3">
      <strong className="text-ink">{formatCycleDate(cycle.cycleOn)}</strong>
      <span className="text-sm text-ink">{what}</span>
      <OrderLink cycle={cycle} />
    </li>
  );
}

/** One more page of C5, and the button for the page after it while there is one. */
function MoreCycles({ id, page, zone, layout }: { id: string; page: number; zone: string; layout: Layout }) {
  const [next, setNext] = useState(false);
  const query = useMySubscriptionCycles(id, page);
  if (!query.data) {
    // Loading, or failed: only this page is retried; the pages above stay, and "Show more" waits for it.
    const failed = !query.isFetching;
    const content = failed ? (
      <span className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
        We couldn&rsquo;t load more deliveries just now.
        <Button variant="pillSecondary" size="pillMd" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </span>
    ) : (
      'Loading more…'
    );
    return layout === 'table' ? (
      <tr>
        <td colSpan={3} role={failed ? undefined : 'status'} className="py-2 text-sm text-ink-muted">
          {content}
        </td>
      </tr>
    ) : (
      <li role={failed ? undefined : 'status'} className="text-sm text-ink-muted">
        {content}
      </li>
    );
  }
  const more = query.data.totalCount > page * query.data.pageSize;
  return (
    <>
      {query.data.items.map((cycle) => (
        <CycleRow key={cycle.id} cycle={cycle} zone={zone} layout={layout} />
      ))}
      {more && !next && <ShowMore layout={layout} onClick={() => setNext(true)} />}
      {next && <MoreCycles id={id} page={page + 1} zone={zone} layout={layout} />}
    </>
  );
}

function ShowMore({ layout, onClick }: { layout: Layout; onClick: () => void }) {
  const button = (
    <Button variant="pillSecondary" size="pillMd" onClick={onClick}>
      Show more
    </Button>
  );
  return layout === 'table' ? (
    <tr>
      <td colSpan={3} className="pt-3">
        {button}
      </td>
    </tr>
  ) : (
    <li>{button}</li>
  );
}

/**
 * History (HO-P6 §11.2.5, US-SUB-06): the latest 12 cycles the detail carries, then "Show more" pages through C5. Each row
 * is the date, what happened as text (the order's state, the pay-by deadline, or the server's sentence for a failed
 * cycle) and the order number, which opens the order page. A table when there is room, cards when there is not.
 */
export function CycleHistory({
  subscriptionId,
  cycles,
  zone,
}: {
  subscriptionId: string;
  cycles: SubscriptionCycle[];
  zone: string;
}) {
  const [ref, narrow] = useNarrowContainer<HTMLDivElement>();
  const [more, setMore] = useState(false);
  const layout: Layout = narrow ? 'cards' : 'table';
  const rows = cycles.map((cycle) => <CycleRow key={cycle.id} cycle={cycle} zone={zone} layout={layout} />);
  const tail = (
    <>
      {cycles.length >= PAGE && !more && <ShowMore layout={layout} onClick={() => setMore(true)} />}
      {more && <MoreCycles id={subscriptionId} page={2} zone={zone} layout={layout} />}
    </>
  );

  return (
    <Panel id="sub-history-h" title="Deliveries so far">
      <div ref={ref}>
        {cycles.length === 0 ? (
          <p className="m-0 text-ink-muted">No orders yet. Your first one is placed on the delivery date.</p>
        ) : layout === 'table' ? (
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Deliveries so far, newest first</caption>
            <thead>
              <tr className="text-ink-muted">
                <th scope="col" className="pb-2 pr-4 font-semibold">Delivery</th>
                <th scope="col" className="pb-2 pr-4 font-semibold">What happened</th>
                <th scope="col" className="pb-2 font-semibold">Order</th>
              </tr>
            </thead>
            <tbody>
              {rows}
              {tail}
            </tbody>
          </table>
        ) : (
          <ul aria-label="Deliveries so far, newest first" className="m-0 flex list-none flex-col gap-3 p-0">
            {rows}
            {tail}
          </ul>
        )}
      </div>
    </Panel>
  );
}
