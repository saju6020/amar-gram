'use client';

import { use } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CustomerProfileView } from '@/components/back-office-overview/CustomerProfileView';

// US-ACC-10/11, HO-P4 §11.2.9. The same profile as the Customers screen's right-hand panel, as a
// page of its own (reached from a link, and from a narrow screen where the panel is not beside the list).
export default function StaffCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = use(params);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/staff/customers"
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-accent-ink no-underline hover:underline"
      >
        <ChevronLeft size={14} aria-hidden="true" />
        All customers
      </Link>
      <CustomerProfileView customerId={customerId} />
    </div>
  );
}
