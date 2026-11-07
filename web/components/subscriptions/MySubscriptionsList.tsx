'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { GreetingHeader } from '@/components/hearth/GreetingHeader';
import { HearthEmpty } from '@/components/hearth/HearthEmpty';
import { Button, buttonVariants } from '@/components/ui/button';
import type { SubscriptionView } from '@/lib/api/subscriptions';
import type { PagedResult } from '@/lib/api/types';
import { useMySubscriptions } from '@/lib/hooks/useSubscriptions';
import { useUrlParams } from '@/lib/hooks/useUrlParams';
import { EMPTY_SUBSCRIPTIONS_TEXT, SUBSCRIPTIONS_LIST_INTRO } from '@/lib/subscriptions/copy';
import { StateTabs } from './StateTabs';
import { SubscriptionCard } from './SubscriptionCard';

type Tab = 'live' | 'cancelled';

function Pager({
  data,
  onPage,
}: {
  data: PagedResult<SubscriptionView>;
  onPage: (page: number) => void;
}) {
  const { totalCount: rows, pageSize } = data;
  const pageCount = Math.max(1, Math.ceil(rows / pageSize));
  if (pageCount <= 1) return null;
  const current = data.pageNumber;
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-muted">
      <span>{`Page ${current} of ${pageCount}`}</span>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="pillSecondary" size="pillMd" disabled={current <= 1} onClick={() => onPage(current - 1)}>
          ← Previous
        </Button>
        <Button variant="pillSecondary" size="pillMd" disabled={current >= pageCount} onClick={() => onPage(current + 1)}>
          Next →
        </Button>
      </div>
    </nav>
  );
}

/**
 * `/portal/subscriptions` — HO-P6 §11.2.4, US-SUB-01/02/06. State tabs **Current ({n})** and **Cancelled ({n})**, each count
 * from its own query (OQ-19); the tab is component state and the page is `?page=`. A card per subscription, an empty
 * state that points at the shop, and a retry when a read fails.
 */
export function MySubscriptionsList() {
  const params = useUrlParams();
  const [tab, setTab] = useState<Tab>('live');
  const page = Math.max(1, Number(params.get('page')) || 1);
  const live = useMySubscriptions('live', tab === 'live' ? page : 1);
  const cancelled = useMySubscriptions('cancelled', tab === 'cancelled' ? page : 1);
  const active = tab === 'live' ? live : cancelled;
  const count = (query: typeof live) => (query.data ? ` (${query.data.totalCount})` : '');

  const panel = active.isPending ? (
    <LoadingState rows={4} label="Loading your subscriptions…" />
  ) : active.isError && !active.data ? (
    <ErrorState onRetry={() => void active.refetch()} />
  ) : !active.data || active.data.items.length === 0 ? (
    tab === 'live' ? (
      <HearthEmpty
        title={EMPTY_SUBSCRIPTIONS_TEXT}
        action={
          <Link href="/shop" className={buttonVariants({ variant: 'pill', size: 'pillMd' })}>
            Browse the shop
          </Link>
        }
      />
    ) : (
      <HearthEmpty title="No cancelled subscriptions." description="Subscriptions you cancel are kept here." />
    )
  ) : (
    <div className="flex flex-col gap-4">
      <ul aria-label={tab === 'live' ? 'Current subscriptions' : 'Cancelled subscriptions'} className="m-0 flex list-none flex-col gap-4 p-0">
        {active.data.items.map((subscription) => (
          <li key={subscription.id}>
            <SubscriptionCard subscription={subscription} />
          </li>
        ))}
      </ul>
      <Pager data={active.data} onPage={(next) => params.set({ page: String(next) })} />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <GreetingHeader title="My subscriptions">{SUBSCRIPTIONS_LIST_INTRO}</GreetingHeader>
      <StateTabs
        label="Subscriptions"
        idPrefix="subs"
        selected={tab}
        onSelect={(id) => {
          setTab(id as Tab);
          params.set({});
        }}
        tabs={[
          { id: 'live', label: `Current${count(live)}` },
          { id: 'cancelled', label: `Cancelled${count(cancelled)}` },
        ]}
      >
        {panel}
      </StateTabs>
    </div>
  );
}
