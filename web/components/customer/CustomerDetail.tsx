import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { CustomerStatusBadge } from './CustomerStatusBadge';
import { IncompleteCustomerNotice } from './IncompleteCustomerNotice';
import type { StaffCustomer } from '@/lib/api/staff-customers';

/**
 * `components/customer/CustomerDetail.tsx` — US-ACC-10/11. Other areas (Messages, Billing, Orders)
 * add their own sections beside this one on the page; nothing below needs to change for them.
 */
export function CustomerDetail({ customer }: { customer: StaffCustomer }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-semibold text-ink">{customer.fullName}</h1>
        <CustomerStatusBadge recordStatus={customer.recordStatus} />
        {customer.status === 'Merged' && <Badge variant="neutral">Merged</Badge>}
      </div>

      {customer.status === 'Merged' && customer.mergedIntoCustomerId && (
        <p className="text-sm text-ink-muted">
          Merged into{' '}
          <Link
            href={`/staff/customers/${customer.mergedIntoCustomerId}`}
            className="font-semibold text-accent-ink no-underline hover:underline"
          >
            the surviving record
          </Link>
          .
        </p>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="font-semibold text-ink">Mobile</dt>
        <dd className="text-ink-muted">{customer.mobileNumber ?? '—'}</dd>
        <dt className="font-semibold text-ink">Email</dt>
        <dd className="text-ink-muted">{customer.emailAddress ?? '—'}</dd>
        <dt className="font-semibold text-ink">Registration channel</dt>
        <dd className="text-ink-muted">
          {customer.registrationChannel === 'Reception' ? 'Walk-in' : 'Self-service'}
        </dd>
      </dl>

      {customer.recordStatus === 'Incomplete' && <IncompleteCustomerNotice />}
    </div>
  );
}
