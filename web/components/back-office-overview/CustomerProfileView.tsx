'use client';

import { KpiTile } from '@/components/back-office/KpiTile';
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
import { useCustomerBillingSummary } from '@/lib/hooks/billing/useBillingQueries';
import { useStaffSession } from '@/lib/hooks/useSession';
import { useStaffCustomer } from '@/lib/hooks/useStaffCustomers';

/**
 * `components/back-office-overview/CustomerProfileView.tsx` — HO-P4 §11.2.9, US-ACC-10/11,
 * US-BIL-03. Loads one staff customer and renders `CustomerProfile` with the panels other areas own
 * (Messages link, Billing, Orders, Erase personal data). It is the single place the customer page and
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
  return (
    <CustomerProfile
      customer={customer}
      headingLevel={headingLevel}
      // HO-NTF-002 §11.5/§13 — a Messages link (presentation only; the log's own 403 still decides).
      messagesLink={<CustomerMessagesLink customerId={customer.id} roleIds={roleIds} />}
      // The one key figure the API has for a customer: what they owe, from Billing. A role without
      // Billing (`403`) or a failed read shows no tile rather than a guess (BG-19).
      figures={
        balance.data ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <KpiTile
              label="Balance owed"
              headingLevel={3}
              value={<Amount money={balance.data.outstanding} />}
            />
          </div>
        ) : undefined
      }
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
