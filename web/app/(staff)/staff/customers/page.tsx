'use client';

import { Suspense } from 'react';
import { UserPlus } from 'lucide-react';
import { ActionLink } from '@/components/back-office/ActionLink';
import { PageHeader } from '@/components/back-office/PageHeader';
import { SplitView } from '@/components/back-office/SplitView';
import { CustomerProfileView } from '@/components/back-office-overview/CustomerProfileView';
import { PermissionDeniedState } from '@/components/admin/PermissionDeniedState';
import { CustomerSearchPanel } from '@/components/customer/CustomerSearchPanel';
import { ApiForbiddenError } from '@/lib/api/client';
import { useFindCustomers } from '@/lib/hooks/useStaffCustomers';
import { useUrlParams } from '@/lib/hooks/useUrlParams';

// US-ACC-10, HO-P4 §11.2.8. Customers: search (left) and the selected profile (right). The search
// term (`?q=`) and the selection (`?customer=`) live in the URL, so a reload or back/forward keeps
// them (ADR-FE-183). The lookup is by mobile number or email only: a value containing `@` is sent as
// `email`, anything else as `mobile`. There is no name search or browsable list (BG-19).
export default function StaffCustomersPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Customers"
        description="Find a customer by mobile number or email."
        actions={
          <ActionLink href="/staff/customers/new" variant="primary">
            <UserPlus size={16} aria-hidden="true" />
            Register walk-in customer
          </ActionLink>
        }
      />
      <Suspense fallback={null}>
        <CustomersSplit />
      </Suspense>
    </div>
  );
}

function CustomersSplit() {
  const url = useUrlParams();
  const term = url.get('q').trim();
  const selectedId = url.get('customer');

  const lookup = useFindCustomers(term.includes('@') ? { email: term } : { mobile: term }, !!term);

  if (lookup.error instanceof ApiForbiddenError) return <PermissionDeniedState />;

  return (
    <SplitView
      listLabel="Customer search"
      detailLabel="Customer profile"
      ratio="2:3"
      list={
        <CustomerSearchPanel
          term={term}
          onSearch={(next) => url.set({ q: next, customer: undefined })}
          results={lookup.data}
          isLoading={!!term && lookup.isLoading}
          isError={lookup.isError}
          onRetry={() => void lookup.refetch()}
          selectedId={selectedId}
          onSelect={(customerId) => url.set({ customer: customerId })}
        />
      }
      detail={selectedId ? <CustomerProfileView customerId={selectedId} headingLevel={2} /> : null}
    />
  );
}
