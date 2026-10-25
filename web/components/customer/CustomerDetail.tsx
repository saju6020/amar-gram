import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { CustomerStatusBadge } from './CustomerStatusBadge';
import { IncompleteCustomerNotice } from './IncompleteCustomerNotice';
import { initialsOf } from './initials';
import type { StaffCustomer } from '@/lib/api/staff-customers';

/**
 * `components/customer/CustomerDetail.tsx` — US-ACC-10/11, HO-P4 §11.2.9. The profile's identity
 * block: initials avatar, the name in the display face, record status, and the contact facts. Other
 * areas (Messages, Billing, Orders) add their own sections beside this one; `CustomerProfile`
 * composes them. `headingLevel` is 1 on the customer's own page and 2 beside the search list.
 */
export function CustomerDetail({
  customer,
  headingLevel = 1,
}: {
  customer: StaffCustomer;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h1';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-12 flex-none place-items-center rounded-full bg-leaf-soft text-base font-bold text-leaf-ink"
        >
          {initialsOf(customer.fullName)}
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <Heading className="font-display text-2xl font-bold text-ink [overflow-wrap:anywhere]">
            {customer.fullName}
          </Heading>
          <CustomerStatusBadge recordStatus={customer.recordStatus} />
          {customer.status === 'Merged' && <Badge variant="neutral">Merged</Badge>}
        </div>
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
        <dd className="text-ink-muted [overflow-wrap:anywhere]">{customer.mobileNumber ?? '—'}</dd>
        <dt className="font-semibold text-ink">Email</dt>
        <dd className="text-ink-muted [overflow-wrap:anywhere]">{customer.emailAddress ?? '—'}</dd>
        <dt className="font-semibold text-ink">Registration channel</dt>
        <dd className="text-ink-muted">
          {customer.registrationChannel === 'Reception' ? 'Walk-in' : 'Self-service'}
        </dd>
      </dl>

      {customer.recordStatus === 'Incomplete' && <IncompleteCustomerNotice />}
    </div>
  );
}
