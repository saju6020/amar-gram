'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/back-office/PageHeader';
import { StatusPill } from '@/components/back-office/StatusPill';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { buttonVariants } from '@/components/ui/button';
import type { BranchSummary } from '@/lib/api/admin-branches';
import { cn } from '@/lib/utils';

/** `components/branches/BranchTable.tsx` — HO-ADM-002 §11.2, US-ADM-01; HO-P4 §11.6.7. One outlet
 *  card per branch: name, code, active status and time zone, with links to edit, hours, holidays &
 *  closures, calendar and roster. The "+ Add outlet" action is shown only to a caller who can manage
 *  branches (presentation only). Address, type, hours summary, delivery areas and staff count are
 *  not on the branch list (BG-21), so they are not shown. */
export interface BranchTableProps {
  branches: BranchSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  canCreate: boolean;
}

const LINK_CLASS = 'inline-flex min-h-11 items-center font-semibold text-accent no-underline hover:underline';

function CardLink({ href, children, name }: { href: string; children: string; name: string }) {
  return (
    <Link href={href} className={LINK_CLASS}>
      {children}
      <span className="sr-only"> {name}</span>
    </Link>
  );
}

export function BranchTable({
  branches,
  isLoading,
  isError,
  onRetry,
  canCreate,
}: BranchTableProps) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Branches"
        description="Each outlet’s details, opening hours, closures, calendar and roster."
        actions={
          canCreate ? (
            <Link
              href="/staff/admin/branches/new"
              className={cn(buttonVariants({ variant: 'primary' }), 'min-h-11 px-4')}
            >
              <Plus size={16} aria-hidden="true" />
              Add outlet
            </Link>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingState rows={4} label="Loading branches…" />
      ) : isError ? (
        <ErrorState description="We couldn’t load the branches just now." onRetry={onRetry} />
      ) : !branches || branches.length === 0 ? (
        <EmptyState
          title="No branches yet"
          description={
            canCreate ? 'Create the first branch to get started.' : 'None have been created yet.'
          }
        />
      ) : (
        <ul aria-label="Outlets" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((branch) => (
            <li key={branch.id} className="min-w-0">
              <article className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-ink [overflow-wrap:anywhere]">
                    {branch.name}
                  </h2>
                  <StatusPill tone={branch.isActive ? 'success' : 'neutral'}>
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </StatusPill>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-ink-muted">Code</dt>
                  <dd className="text-ink [overflow-wrap:anywhere]">{branch.code}</dd>
                  <dt className="text-ink-muted">Time zone</dt>
                  <dd className="text-ink [overflow-wrap:anywhere]">{branch.timeZoneId}</dd>
                </dl>
                <div className="mt-auto flex flex-wrap gap-x-4 pt-2 text-sm">
                  <CardLink href={`/staff/admin/branches/${branch.id}`} name={branch.name}>
                    Edit
                  </CardLink>
                  <CardLink href={`/staff/admin/branches/${branch.id}/hours`} name={branch.name}>
                    Hours
                  </CardLink>
                  <CardLink href={`/staff/admin/branches/${branch.id}/closures`} name={branch.name}>
                    Holidays &amp; closures
                  </CardLink>
                  <CardLink href={`/staff/admin/branches/${branch.id}/calendar`} name={branch.name}>
                    Calendar
                  </CardLink>
                  <CardLink href={`/staff/admin/branches/${branch.id}/roster`} name={branch.name}>
                    Roster
                  </CardLink>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
