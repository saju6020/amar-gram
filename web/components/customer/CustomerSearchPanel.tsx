'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { SearchField } from '@/components/back-office/SearchField';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import type { StaffCustomerSummary } from '@/lib/api/staff-customers';
import { cn } from '@/lib/utils';
import { CustomerStatusBadge } from './CustomerStatusBadge';
import { initialsOf } from './initials';

/**
 * `components/customer/CustomerSearchPanel.tsx` — HO-P4 §11.2.8, US-ACC-10. The left column of the
 * Customers screen: one search box ("Mobile number or email" — the lookup is by those two only, no
 * name search, BG-19) and the matches as buttons with initials, name, mobile and record status. The
 * page owns the term and the selection (both live in the URL) and runs the lookup; this component
 * holds only the text being typed. Search runs on Enter or the Search button, because the server
 * matches a whole number or address, not a prefix.
 */
export function CustomerSearchPanel({
  term,
  onSearch,
  results,
  isLoading,
  isError,
  onRetry,
  selectedId,
  onSelect,
}: {
  /** The term the results are for (empty before the first search). */
  term: string;
  onSearch: (term: string) => void;
  results: StaffCustomerSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedId: string;
  onSelect: (customerId: string) => void;
}) {
  const [draft, setDraft] = useState(term);
  // Back/forward changes the URL's term; the box follows it.
  useEffect(() => setDraft(term), [term]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSearch(draft.trim());
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
      <form onSubmit={submit} role="search" aria-label="Find a customer" className="flex gap-2">
        <SearchField
          id="customer-search"
          label="Mobile number or email"
          placeholder="Mobile number or email"
          value={draft}
          onChange={setDraft}
        />
        <Button type="submit" className="min-h-11 flex-none">
          Search
        </Button>
      </form>

      {!term ? (
        <EmptyState
          title="Search by mobile number or email."
          description="Enter the whole number or address, then press Enter."
        />
      ) : isLoading ? (
        <LoadingState variant="table" rows={3} label="Searching customers…" />
      ) : isError ? (
        <ErrorState onRetry={onRetry} />
      ) : !results || results.length === 0 ? (
        <EmptyState
          title={`No customer matches “${term}”`}
          description="Check the number or address, or register them as a walk-in customer."
        />
      ) : (
        <ul aria-label="Matching customers" className="m-0 flex list-none flex-col gap-1 p-0">
          {results.map((customer) => {
            const selected = customer.id === selectedId;
            return (
              <li key={customer.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(customer.id)}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-left',
                    selected
                      ? 'border-leaf bg-leaf-soft text-leaf-ink'
                      : 'border-transparent text-ink hover:bg-surface-sunken',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-10 flex-none place-items-center rounded-full bg-surface-sunken text-sm font-bold text-ink"
                  >
                    {initialsOf(customer.fullName)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-bold [overflow-wrap:anywhere]">
                      {customer.fullName}
                    </span>
                    <span className="text-[13px] [overflow-wrap:anywhere]">
                      {customer.mobileNumber ?? customer.emailAddress ?? '—'}
                    </span>
                  </span>
                  {customer.recordStatus === 'Incomplete' && (
                    <CustomerStatusBadge recordStatus="Incomplete" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
