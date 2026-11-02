import Link from 'next/link';
import { CheckCircle2, CircleDashed, Lock } from 'lucide-react';
import { StatusPill } from '@/components/back-office/StatusPill';
import { DataTable, type DataTableColumn } from '@/components/common/DataTable';
import type { StaffAccountStatus, StaffAccountSummary } from '@/lib/api/staff-admin';

/** `components/admin/StaffAccountTable.tsx` — US-ACC-07, UI-4 (paginated, filterable); HO-P4 §11.6.8; HO-P5 §11.5.7
 *  (BG-22). Name, sign-in IDs (mobile and email), roles, the outlets the person is assigned to (the primary first, marked
 *  "(primary)"), the status the **server** derives (Active, Not set up or Locked — never worked out here from
 *  `hasPassword`) and an Edit link. The footer names the real role ids the role catalogue returns; the design's
 *  Manager / Cashier / Packer set does not exist in the backend (BG-22 residual). */

function StatusCell({ status }: { status: StaffAccountStatus }) {
  if (status === 'Active') {
    return (
      <StatusPill tone="success" icon={<CheckCircle2 size={12} />}>
        Active
      </StatusPill>
    );
  }
  if (status === 'Locked') {
    return (
      <StatusPill tone="danger" icon={<Lock size={12} />}>
        Locked
      </StatusPill>
    );
  }
  return (
    <StatusPill tone="warning" icon={<CircleDashed size={12} />}>
      Not set up
    </StatusPill>
  );
}

export interface StaffAccountTableProps {
  rows: StaffAccountSummary[] | undefined;
  totalCount: number | undefined;
  pageSize: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  roleIds: string[];
  roleFilter: string;
  onRoleFilterChange: (roleId: string) => void;
}

export function StaffAccountTable({
  rows,
  totalCount,
  pageSize,
  isLoading,
  isError,
  onRetry,
  roleIds,
  roleFilter,
  onRoleFilterChange,
}: StaffAccountTableProps) {
  const columns: Array<DataTableColumn<StaffAccountSummary>> = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => <span id={`staff-name-${row.id}`}>{row.fullName}</span>,
      sortable: true,
    },
    {
      id: 'identifier',
      header: 'Sign-in IDs',
      cell: (row) =>
        row.mobileNumber || row.emailAddress ? (
          <span className="flex flex-col text-sm">
            {row.mobileNumber && <span>{row.mobileNumber}</span>}
            {row.emailAddress && <span className="text-ink-muted">{row.emailAddress}</span>}
          </span>
        ) : (
          '—'
        ),
    },
    { id: 'roles', header: 'Roles', cell: (row) => row.roleIds.join(', ') },
    {
      id: 'outlet',
      header: 'Outlet',
      cell: (row) =>
        row.branches.length > 0 ? (
          <span className="flex min-w-40 flex-col text-sm">
            {row.branches.map((branch) => (
              <span key={branch.id} className="[overflow-wrap:break-word]">
                {branch.name}
                {branch.isPrimary ? ' (primary)' : ''}
              </span>
            ))}
          </span>
        ) : (
          '—'
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusCell status={row.status} />,
    },
    {
      id: 'edit',
      header: 'Edit',
      cell: (row) => (
        <Link
          href={`/staff/admin/staff-accounts/${row.id}`}
          aria-describedby={`staff-name-${row.id}`}
          className="inline-flex min-h-11 items-center font-semibold text-accent no-underline hover:underline"
        >
          Edit
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="role-filter" className="text-sm font-semibold text-ink">
          Filter by role
        </label>
        <select
          id="role-filter"
          value={roleFilter}
          onChange={(event) => onRoleFilterChange(event.target.value)}
          className="w-fit rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <option value="">All roles</option>
          {roleIds.map((roleId) => (
            <option key={roleId} value={roleId}>
              {roleId}
            </option>
          ))}
        </select>
      </div>

      {/* HO-ACC-002 §1 Amended (2026-09-26) — the horizontal-overflow-at-360px workaround that
          used to live here (an `overflow-x-auto` wrapper around this call site only) was fixed at
          the source instead: `components/common/DataTable` now wraps its own `<table>` in a
          keyboard-focusable scrollable region (integrator-authorised edit). */}
      <DataTable
        caption="Staff accounts"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        rowHref={(row) => `/staff/admin/staff-accounts/${row.id}`}
        search={{ label: 'Search staff accounts', placeholder: 'Name or identifier' }}
        pagination={{ totalCount: totalCount ?? 0, pageSize }}
        emptyState={{ title: 'No staff accounts match this search' }}
      />

      {roleIds.length > 0 && (
        <p className="text-sm text-ink-muted">Roles: {roleIds.join(' · ')}.</p>
      )}
    </div>
  );
}
