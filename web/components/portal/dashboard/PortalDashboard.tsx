'use client';

import { ErrorState } from '@/components/common/ErrorState';
import { usePortalDashboard } from '@/lib/hooks/usePortalDashboard';
import type { PortalDashboard as PortalDashboardData } from '@/lib/api/portal';
import { PORTAL_BILLING, PORTAL_ORDERS } from '@/lib/routing/portal-links';
import { BalancesTile } from './BalancesTile';
import { DashboardSection } from './DashboardSection';
import { DashboardSkeleton } from './DashboardSkeleton';
import { OrdersTile } from './OrdersTile';

/**
 * `components/portal/dashboard/PortalDashboard.tsx` — HO-POR-002 §2, US-POR-01. One request, two
 * tiles: recent orders and balances. There is NO subscriptions tile (not even a placeholder).
 * Each tile goes through `DashboardSection`, so an absent key, an `Unavailable` section and a
 * `Ready` one can never be confused.
 */
function greetingFor(data: PortalDashboardData): string {
  const fullName = data.customer?.state === 'Ready' ? data.customer.data?.fullName : undefined;
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? `Welcome back, ${first}` : 'Welcome back';
}

export function PortalDashboard() {
  const query = usePortalDashboard();

  if (query.isPending) return <DashboardSkeleton />;

  if (query.isError || !query.data) {
    return (
      <ErrorState
        headingLevel={1}
        title="We couldn’t load your home page just now."
        description="This does not mean there is nothing here — please try again."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const data = query.data;
  const retry = () => void query.refetch();
  const retrying = query.isFetching;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-[var(--radius-md)] bg-warm-soft px-6 py-5">
        <div className="min-w-0 flex-[1_1_320px]">
          <h1 className="font-display text-[26px] font-semibold text-ink">{greetingFor(data)}</h1>
          <p className="mt-1 text-sm text-ink">Everything we hold for you, on one page.</p>
        </div>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
        <DashboardSection
          id="orders"
          title="Recent orders"
          section={data.orders}
          link={{ href: PORTAL_ORDERS, label: 'All orders' }}
          onRetry={retry}
          retrying={retrying}
          unavailableSubject="your orders"
        >
          {(orders) => <OrdersTile data={orders} />}
        </DashboardSection>

        <DashboardSection
          id="balances"
          title="Balances"
          section={data.balances}
          link={{ href: PORTAL_BILLING, label: 'All invoices' }}
          onRetry={retry}
          retrying={retrying}
          unavailableSubject="your balances"
          className="col-span-full"
        >
          {(balances) => <BalancesTile data={balances} />}
        </DashboardSection>
      </div>
    </div>
  );
}
