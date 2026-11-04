'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { SearchField } from '@/components/back-office/SearchField';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/button';
import type { CustomerListSort, StaffCustomerListItem } from '@/lib/api/staff-customers';
import { cn } from '@/lib/utils';
import { CustomerStatusBadge } from './CustomerStatusBadge';
import { initialsOf } from './initials';

/**
 * `components/customer/CustomerBrowsePanel.tsx` — HO-P5 §11.5.3 (BG-19, OQ-14), US-ACC-10. The left column of the
 * Customers screen: a search box ("Name, mobile or email"), a tag filter, the sort, the customers as buttons (initials,
 * name, mobile, area, tags, record status) and a pager. The page owns every value (they live in the URL) and runs the
 * read; this component holds only the text being typed. Search runs on Enter or the Search button. Tags are staff-typed
 * free text, so they are only ever rendered as text.
 */
const SORTS: Array<{ value: CustomerListSort; label: string }> = [
  { value: 'recent', label: 'Most recent' },
  { value: 'name', label: 'Name' },
];

const SELECT =
  'min-h-11 w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm text-ink ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function CustomerBrowsePanel({
  search,
  onSearch,
  tag,
  tagOptions,
  onTag,
  sort,
  onSort,
  page,
  onPage,
  items,
  totalCount,
  pageSize,
  isLoading,
  isRefreshing = false,
  isError,
  onRetry,
  selectedId,
  onSelect,
}: {
  /** The term the list is for (empty = everyone). */
  search: string;
  onSearch: (term: string) => void;
  tag: string;
  /** The tags the filter offers: the ones on the current page plus the one in the URL. */
  tagOptions: string[];
  onTag: (tag: string) => void;
  sort: CustomerListSort;
  onSort: (sort: CustomerListSort) => void;
  page: number;
  onPage: (page: number) => void;
  items: StaffCustomerListItem[] | undefined;
  totalCount: number | undefined;
  pageSize: number;
  isLoading: boolean;
  /** The previous page is still shown while the next one loads. */
  isRefreshing?: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedId: string;
  onSelect: (customerId: string) => void;
}) {
  const [draft, setDraft] = useState(search);
  // Back/forward changes the URL's term; the box follows it.
  useEffect(() => setDraft(search), [search]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSearch(draft.trim());
  }

  const total = totalCount ?? 0;
  const filtered = !!search || !!tag;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4">
      <form onSubmit={submit} role="search" aria-label="Find a customer" className="flex flex-col gap-2 sm:flex-row">
        <SearchField
          id="customer-search"
          label="Name, mobile or email"
          placeholder="Name, mobile or email"
          value={draft}
          onChange={setDraft}
        />
        <Button type="submit" className="min-h-11 w-full flex-none sm:w-auto">
          Search
        </Button>
      </form>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="customer-tag" className="text-sm font-semibold text-ink">
            Tag
          </label>
          <select id="customer-tag" value={tag} onChange={(event) => onTag(event.target.value)} className={SELECT}>
            <option value="">All customers</option>
            {tagOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="customer-sort" className="text-sm font-semibold text-ink">
            Sort by
          </label>
          <select
            id="customer-sort"
            value={sort}
            onChange={(event) => onSort(event.target.value as CustomerListSort)}
            className={SELECT}
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && !items ? (
        <LoadingState variant="table" rows={4} label="Loading customers…" />
      ) : isError && !items ? (
        <ErrorState onRetry={onRetry} />
      ) : !items || items.length === 0 ? (
        <EmptyState
          title={page > 1 ? 'Nothing on this page' : filtered ? 'No customer matches' : 'No customers yet'}
          description={
            page > 1
              ? 'The list is shorter than this page. Go back to the first page.'
              : filtered
                ? 'Check the spelling, clear the tag, or register them as a walk-in customer.'
                : 'Register a walk-in customer to start the list.'
          }
          action={
            page > 1 ? (
              <Button variant="secondary" className="min-h-11" onClick={() => onPage(1)}>
                Back to the first page
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul aria-label="Customers" className="m-0 flex list-none flex-col gap-1 p-0">
            {items.map((customer) => {
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
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm font-bold [overflow-wrap:anywhere]">{customer.fullName}</span>
                      {/* Under the name, not beside it: beside it the pill squeezed the text to a letter a line at 360 px (HO-P5 Amended (am)). */}
                      {customer.recordStatus === 'Incomplete' && (
                        <span className="flex">
                          <CustomerStatusBadge recordStatus="Incomplete" />
                        </span>
                      )}
                      <span className="text-[13px] [overflow-wrap:anywhere]">
                        {customer.mobileNumber ?? customer.emailAddress ?? '—'}
                        {customer.area ? ` · ${customer.area}` : ''}
                      </span>
                      {customer.tags.length > 0 && (
                        <span className="flex flex-wrap gap-1">
                          {customer.tags.map((label) => (
                            <span
                              key={label}
                              className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-ink-muted"
                            >
                              {label}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p role="status" className="m-0 text-xs text-ink-muted">
            {isRefreshing ? 'Updating the list…' : total <= pageSize ? (total === 1 ? '1 customer' : `${total} customers`) : ''}
          </p>
          <BrowsePager page={page} pageSize={pageSize} total={total} onPage={onPage} />
        </>
      )}
    </div>
  );
}

/** Previous / Next for the customers list, at the 44 px target size (HO-P3 UI-6); `SimplePager`'s `sm` buttons are 32 px. */
function BrowsePager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted">
      <span>
        Page {page} of {pageCount} · {total} total
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" className="min-h-11" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" className="min-h-11" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}
