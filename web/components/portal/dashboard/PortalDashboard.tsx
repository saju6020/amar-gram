'use client';

import { ErrorState } from '@/components/common/ErrorState';
import { GreetingHeader } from '@/components/hearth/GreetingHeader';
import { NextDeliveryCard } from '@/components/subscriptions/NextDeliveryCard';
import { usePortalDashboard } from '@/lib/hooks/usePortalDashboard';
import type { PortalDashboard as PortalDashboardData } from '@/lib/api/portal';
import { PORTAL_BILLING, PORTAL_ORDERS } from '@/lib/routing/portal-links';
import { BalancesTile } from './BalancesTile';
import { BuyAgain, newestDeliveredOrder } from './BuyAgain';
import { DashboardSection } from './DashboardSection';
import { DashboardSkeleton } from './DashboardSkeleton';
import { DefaultAddressCard } from './DefaultAddressCard';
import { LiveOrderCard, newestOpenOrder } from './LiveOrderCard';
import { OrdersTile } from './OrdersTile';

/**
 * `components/portal/dashboard/PortalDashboard.tsx` — HO-POR-002 §2, US-POR-01, restyled to
 * docs/design/store/Account.dc.html (HO-P3 S4). One dashboard request, then: the greeting, the live order card (the
 * newest open order), the default address, the next subscription delivery, Buy again (interim, gap G7), and the orders
 * and balances tiles. The "Next delivery" card (HO-P6, OQ-8) is a single subscription read from its own endpoint (C3), not
 * from the dashboard payload, and is absent when there is none; there is no multi-item "staples box" (BG-S7). Each tile goes through
 * `DashboardSection`, so an absent key, an `Unavailable` section and a `Ready` one can never be confused.
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
  const orderItems = data.orders?.state === 'Ready' ? (data.orders.data?.items ?? []) : [];
  const openOrder = newestOpenOrder(orderItems);
  const deliveredOrder = newestDeliveredOrder(orderItems);

  return (
    <div className="flex flex-col gap-5">
      <GreetingHeader title={greetingFor(data)}>
        Everything we hold for you, on one page.
      </GreetingHeader>

      {openOrder && <LiveOrderCard order={openOrder} />}

      <div className="grid items-stretch gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <DefaultAddressCard />
        <NextDeliveryCard />
      </div>

      {deliveredOrder && <BuyAgain order={deliveredOrder} />}

      <div className="grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
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
