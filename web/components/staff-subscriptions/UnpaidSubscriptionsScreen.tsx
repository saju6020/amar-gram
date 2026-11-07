'use client';

import { PageHeader } from '@/components/back-office/PageHeader';
import { AccessRefusedState } from '@/components/admin/AccessRefusedState';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import { ApiForbiddenError } from '@/lib/api/client';
import type { UnpaidSubscription } from '@/lib/api/staff-subscriptions';
import { useUnpaidSubscriptions } from '@/lib/hooks/useStaffSubscriptions';
import { useUrlParams } from '@/lib/hooks/useUrlParams';
import { unpaidGroupLabel } from '@/lib/subscriptions/labels';
import { StaffSubscriptionsNav } from './StaffSubscriptionsNav';
import { UnpaidSubscriptionCard } from './UnpaidSubscriptionCard';
import { STAFF_UNPAID_INTRO, STAFF_UNPAID_TITLE } from './staffCopy';

const PAGE_SIZE = 20;
/** The server's order: Suspended first, then At risk. A group with no rows on the page is left out. */
const GROUPS = ['Suspended', 'AtRisk'] as const;

function Pager({ page, pageSize, rowCount, onPage }: { page: number; pageSize: number; rowCount: number; onPage: (n: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(rowCount / pageSize));
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
      <span>{`Page ${page} of ${pageCount} · ${rowCount} in all`}</span>
      <div className="flex gap-2">
        <Button variant="secondary" className="min-h-11" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" className="min-h-11" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}

/**
 * HO-P6 S2 (§11.3.4, US-SUB-06 AC2). The unpaid worklist: two headed groups from the server's `group`, "Suspended" then
 * "At risk". Paged with `?page=`; the server orders the rows.
 */
export function UnpaidSubscriptionsScreen() {
  const url = useUrlParams();
  const page = Math.max(1, Math.trunc(Number(url.get('page'))) || 1);
  const query = useUnpaidSubscriptions(page, PAGE_SIZE);

  if (query.error instanceof ApiForbiddenError) return <AccessRefusedState error={query.error} />;

  const items = query.data?.items ?? [];
  const byGroup = (group: string): UnpaidSubscription[] => items.filter((item) => item.group === group);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={STAFF_UNPAID_TITLE} description={STAFF_UNPAID_INTRO} />
      <StaffSubscriptionsNav current="unpaid" />
      {query.isLoading ? (
        <LoadingState variant="table" rows={5} label="Loading unpaid subscriptions…" />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : items.length === 0 && (query.data?.totalCount ?? 0) > 0 ? (
        // A page past the end (a stale or edited address): the list is not empty, so do not say it is.
        <EmptyState
          title="That page is past the end of the list."
          action={
            <Button variant="secondary" className="min-h-11" onClick={() => url.set({ page: undefined })}>
              Go to the first page
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No unpaid subscriptions."
          description="Nothing is suspended for unpaid orders, and no subscription has an unpaid order."
        />
      ) : (
        <>
          {GROUPS.map((group) => {
            const rows = byGroup(group);
            if (rows.length === 0) return null;
            return (
              <section key={group} aria-labelledby={`unpaid-${group}`} className="flex flex-col gap-3">
                <h2 id={`unpaid-${group}`} className="font-display text-lg font-semibold text-ink">
                  {unpaidGroupLabel(group)}
                </h2>
                <ul className="flex flex-col gap-3">
                  {rows.map((item) => (
                    <UnpaidSubscriptionCard key={item.id} item={item} />
                  ))}
                </ul>
              </section>
            );
          })}
          {query.data && (
            <Pager
              page={query.data.pageNumber}
              pageSize={query.data.pageSize}
              rowCount={query.data.totalCount}
              onPage={(n) => url.set({ page: String(n) })}
            />
          )}
        </>
      )}
    </div>
  );
}
