'use client';

import { KpiTile } from '@/components/back-office/KpiTile';
import { CustomerNotesPanel } from '@/components/back-office-customers/CustomerNotesPanel';
import { CustomerPasswordReset } from '@/components/back-office-customers/CustomerPasswordReset';
import { CustomerTagsControl } from '@/components/back-office-customers/CustomerTagsControl';
import { CustomerSubscriptionsPanel } from '@/components/back-office-subscriptions/CustomerSubscriptionsPanel';
import { PermissionDeniedState } from '@/components/admin/PermissionDeniedState';
import { Amount } from '@/components/billing/Amount';
import { BillingSummaryPanel } from '@/components/billing/BillingSummaryPanel';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { CustomerProfile } from '@/components/customer/CustomerProfile';
import { CustomerMessagesLink } from '@/components/notifications/CustomerMessagesLink';
import { CustomerOrdersPanel } from '@/components/orders/CustomerOrdersPanel';
import { ErasePersonalDataPanel } from '@/components/retention/ErasePersonalDataPanel';
import { ApiForbiddenError, ApiNotFoundError } from '@/lib/api/client';
import { CUSTOMER_STAFF_RECORD_ROLES } from '@/lib/api/staff-customers';
import { formatDateOnly, localDateOf } from '@/lib/format/time';
import { useBranchTimeZone } from '@/lib/hooks/useBranchTimeZone';
import { useCustomerBillingSummary } from '@/lib/hooks/billing/useBillingQueries';
import { useStaffSession } from '@/lib/hooks/useSession';
import { useStaffCustomer } from '@/lib/hooks/useStaffCustomers';
import { useCustomerSubscriptionSummary } from '@/lib/hooks/useSubscriptionSummaries';

/**
 * `components/back-office-overview/CustomerProfileView.tsx` — HO-P4 §11.2.9, US-ACC-10/11,
 * US-BIL-03; HO-P5 §11.5.4 (BG-19). Loads one staff customer and renders `CustomerProfile` with the panels other areas own
 * (Messages link, Billing, Orders, Erase personal data) and this area's own: the summary figures, the staff tags, the Notes
 * tab and the staff-started password reset. The figures are the server's (`orderCount`, `lifetimeSpend`) and are shown as sent. It is the single place the customer page and
 * the Customers split view get their profile from, so the two cannot drift. `components/customer`
 * imports no hooks, so the hooks live here.
 */
export function CustomerProfileView({
  customerId,
  headingLevel = 1,
}: {
  customerId: string;
  headingLevel?: 1 | 2;
}) {
  const { data: customer, isLoading, isError, error, refetch } = useStaffCustomer(customerId);
  const { data: session } = useStaffSession();
  const balance = useCustomerBillingSummary(customerId);
  // HO-P6 S3 (ADR-FE-197): the Subscriptions tab exists only when T9 answered; a 403 (`null`) or a failed read shows no tab.
  const subscriptions = useCustomerSubscriptionSummary(customerId).data;
  const zone = useBranchTimeZone();

  if (isLoading) return <LoadingState variant="card" rows={5} label="Loading customer…" />;
  if (error instanceof ApiForbiddenError) return <PermissionDeniedState />;
  if (error instanceof ApiNotFoundError) {
    return (
      <ErrorState
        title="Customer not found"
        description="This record may have been removed or merged."
      />
    );
  }
  // ARCHITECTURE gate third pass, HIGH — render cached data when present rather than swap the whole
  // page out for an error screen on `isError` alone (see staff-accounts/[staffAccountId]/page.tsx).
  if (isError && !customer) {
    return (
      <ErrorState
        description="We couldn't load this customer just now."
        onRetry={() => refetch()}
      />
    );
  }
  if (!customer) return null;

  const roleIds = session?.roleIds ?? [];
  // Presentation only: the server decides each of these (a 403 is shown as its message).
  const canEditRecord = roleIds.some((role) => CUSTOMER_STAFF_RECORD_ROLES.includes(role));
  const active = customer.status === 'Active';
  return (
    <CustomerProfile
      customer={customer}
      headingLevel={headingLevel}
      // HO-NTF-002 §11.5/§13 — a Messages link (presentation only; the log's own 403 still decides).
      messagesLink={<CustomerMessagesLink customerId={customer.id} roleIds={roleIds} />}
      // The server's summary (BG-19) and, from Billing, what they owe. A role without Billing (`403`) or a failed
      // read shows no balance tile rather than a guess.
      figures={
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <KpiTile
            label="Customer since"
            headingLevel={3}
            value={formatDateOnly(localDateOf(customer.customerSince, zone))}
          />
          <KpiTile label="Orders" headingLevel={3} value={customer.orderCount} />
          <KpiTile label="Lifetime spend" headingLevel={3} value={<Amount money={customer.lifetimeSpend} />} />
          {balance.data && (
            <KpiTile
              label="Balance owed"
              headingLevel={3}
              value={<Amount money={balance.data.outstanding} />}
            />
          )}
        </div>
      }
      tagsControl={
        <CustomerTagsControl
          customerId={customer.id}
          tags={customer.tags}
          canEdit={canEditRecord && active}
        />
      }
      actions={
        canEditRecord && active ? (
          <CustomerPasswordReset customerId={customer.id} customerName={customer.fullName} zone={zone} />
        ) : undefined
      }
      notesPanel={<CustomerNotesPanel customerId={customer.id} canAdd={canEditRecord && active} zone={zone} />}
      subscriptionsPanel={subscriptions ? <CustomerSubscriptionsPanel summary={subscriptions} /> : undefined}
      subscriptionsCount={subscriptions?.live.length}
      // HO-ORD-002 §11.14/§13 — the Orders panel (mount only).
      ordersPanel={<CustomerOrdersPanel customerId={customerId} />}
      // HO-BIL-002 §11.1/§13 — the Billing panel (US-BIL-03): the money figures and a link to the account.
      billingPanel={<BillingSummaryPanel customerId={customerId} />}
      // HO-XCT-002 §11.5/§13 — the Erase personal data panel (US-XCT-06). Shown to Administrators
      // (presentation only: Customers.Erase is decided by the server).
      erasePanel={
        roleIds.includes('Administrator') ? <ErasePersonalDataPanel customer={customer} /> : undefined
      }
    />
  );
}
