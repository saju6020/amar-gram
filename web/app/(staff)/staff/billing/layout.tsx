'use client';

import { PageHeader } from '@/components/back-office/PageHeader';
import { ActionLink } from '@/components/back-office/ActionLink';
import { BillingNav } from '@/components/billing/BillingNav';
import { useStaffSession } from '@/lib/hooks/useSession';

const EXPORT_ROLES = ['Administrator', 'Accountant'];

/**
 * `app/(staff)/staff/billing/layout.tsx` — HO-BIL-002 §8.1, ADR-FE-079; HO-P4 §11.6.1. A route-based
 * section with the customer billing account as its hub; every screen is a deep-linkable route.
 * The section title is a level-2 heading: each screen below owns the page's single `<h1>`.
 * "Export for accounts" is shown to the accounts roles as presentation only; the server still decides.
 */
export default function BillingLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useStaffSession();
  const roleIds = session?.roleIds ?? [];
  const canExport = roleIds.some((role) => EXPORT_ROLES.includes(role));
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Billing & cash-up"
        headingLevel={2}
        actions={
          canExport ? (
            <ActionLink href="/staff/billing/exports" variant="outline">
              Export for accounts
            </ActionLink>
          ) : undefined
        }
      />
      <BillingNav roleIds={roleIds} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
