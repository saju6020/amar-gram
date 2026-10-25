'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionLink } from '@/components/back-office/ActionLink';
import { PageHeader } from '@/components/back-office/PageHeader';
import { Panel } from '@/components/back-office/Panel';
import { WalkInCustomerForm } from '@/components/customer/WalkInCustomerForm';
import { useRegisterWalkInCustomer } from '@/lib/hooks/useStaffCustomerMutations';
import { useFindCustomers } from '@/lib/hooks/useStaffCustomers';

// US-ACC-10.
// ARCH gate HIGH 3 (first pass) — this page wires useRegisterWalkInCustomer()/useFindCustomers();
// WalkInCustomerForm itself takes the results as props, including which mobile number (if any) is
// currently a reported duplicate, which now lives here rather than inside the form.
export default function NewWalkInCustomerPage() {
  const router = useRouter();
  const [duplicateMobile, setDuplicateMobile] = useState<string | null>(null);
  const registerMutation = useRegisterWalkInCustomer();
  const lookup = useFindCustomers({ mobile: duplicateMobile ?? undefined }, !!duplicateMobile);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Register a walk-in customer"
        description="Name and mobile number are enough; they can set a password online later."
        actions={
          <ActionLink href="/staff/customers" variant="outline">
            Find a customer
          </ActionLink>
        }
      />
      <div className="max-w-xl">
        <Panel aria-label="Walk-in customer details">
          <WalkInCustomerForm
            onRegister={(request) => registerMutation.mutateAsync(request)}
            isPending={registerMutation.isPending}
            onCreated={(customerId) => router.push(`/staff/customers/${customerId}`)}
            duplicateMobile={duplicateMobile}
            onDuplicateFound={setDuplicateMobile}
            existingCustomers={lookup.data}
          />
        </Panel>
      </div>
    </div>
  );
}
