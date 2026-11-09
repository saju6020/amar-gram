'use client';

import { useMemo } from 'react';
import { PageHeader } from '@/components/back-office/PageHeader';
import { Panel } from '@/components/back-office/Panel';
import { AccessRefusedState } from '@/components/admin/AccessRefusedState';
import { ResponsiveTable, type Column } from '@/components/billing/ResponsiveTable';
import { ApiForbiddenError } from '@/lib/api/client';
import {
  SUBSCRIPTION_PAYMENT_METHODS,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_SUSPENSION_REASONS,
} from '@/lib/api/subscriptions';
import type { StaffSubscriptionFilters, StaffSubscriptionRow } from '@/lib/api/staff-subscriptions';
import { useCanExportSubscriptions, useStaffSubscriptions } from '@/lib/hooks/useStaffSubscriptions';
import { useUrlFilterState } from '@/lib/hooks/useUrlFilterState';
import { isCalendarDate } from '@/lib/subscriptions/dates';
import { subscriptionPaymentMethodLabel } from '@/lib/subscriptions/labels';
import { ExportCsvButton } from './ExportCsvButton';
import {
  STAFF_FILTER_FIELDS,
  StaffSubscriptionFilters as FilterBar,
  type StaffFilterField,
} from './StaffSubscriptionFilters';
import { StaffSubscriptionsNav } from './StaffSubscriptionsNav';
import { SubscriptionStatusPill } from './SubscriptionStatusPill';
import {
  CustomerLink,
  LastOrder,
  nextDeliveryText,
  ProductCell,
  scheduleText,
  unpaidText,
} from './SubscriptionRowCells';
import { STAFF_LIST_INTRO, STAFF_LIST_TITLE } from './staffCopy';

const PAGE_SIZE = 25;

/** A value from the address is used only when the server knows it; a hand-edited one is dropped, not sent. */
const known = <T extends string>(value: string, all: readonly T[]): T | undefined =>
  (all as readonly string[]).includes(value) ? (value as T) : undefined;

const COLUMNS: Array<Column<StaffSubscriptionRow>> = [
  { id: 'customer', header: 'Customer', cell: (r) => <CustomerLink id={r.customer.id} name={r.customer.name} /> },
  { id: 'mobile', header: 'Mobile', nowrap: true, cell: (r) => r.customer.mobile ?? '—' },
  { id: 'product', header: 'Product', primary: true, cell: (r) => <ProductCell product={r.product} /> },
  { id: 'schedule', header: 'Each delivery', nowrap: true, cell: scheduleText },
  {
    id: 'status',
    header: 'Status',
    cell: (r) => <SubscriptionStatusPill status={r.status} suspensionReason={r.suspensionReason} showReason />,
  },
  { id: 'next', header: 'Next delivery', nowrap: true, cell: nextDeliveryText },
  { id: 'payment', header: 'Payment', cell: (r) => subscriptionPaymentMethodLabel(r.paymentMethod) },
  { id: 'unpaid', header: 'Unpaid in a row', nowrap: true, cell: (r) => unpaidText(r.unpaidStreak) },
  { id: 'last', header: 'Last order', cell: (r) => <LastOrder cycle={r.lastCycle} /> },
];

/**
 * HO-P6 S2 (§11.3.3, US-SUB-06, UI-4). The staff subscription list. Status, suspension reason, payment method, search,
 * sort and page live in the address (ADR-FE-183), so a reload or a shared link shows the same view; the server filters,
 * sorts and pages. Export covers the same filters without paging.
 */
export function StaffSubscriptionsList() {
  const { values, setValue, flush } = useUrlFilterState(STAFF_FILTER_FIELDS, {}, ['q']);
  const canExport = useCanExportSubscriptions();

  const filters = useMemo<StaffSubscriptionFilters>(() => {
    const status = known(values.status, SUBSCRIPTION_STATUSES);
    return {
      status,
      // A reason only means something for a suspended subscription (the select is disabled otherwise), so a stale one in the address is not sent.
      suspensionReason:
        !status || status === 'Suspended' ? known(values.suspensionReason, SUBSCRIPTION_SUSPENSION_REASONS) : undefined,
      paymentMethod: known(values.paymentMethod, SUBSCRIPTION_PAYMENT_METHODS),
      q: values.q.trim() || undefined,
      // A hand-edited date that is not a real day is dropped, not sent (the server would answer 400).
      nextDeliveryOn: isCalendarDate(values.nextDeliveryOn) ? values.nextDeliveryOn : undefined,
      sort: values.sort || undefined,
    };
  }, [values.status, values.suspensionReason, values.paymentMethod, values.q, values.nextDeliveryOn, values.sort],
  );
  const page = Math.max(1, Math.trunc(Number(values.page)) || 1);
  const query = useStaffSubscriptions({ ...filters, pageNumber: page, pageSize: PAGE_SIZE });

  function change(field: StaffFilterField, value: string) {
    setValue(field, value);
    if (field !== 'page') setValue('page', '');
    // A reason only means something for a suspended subscription.
    if (field === 'status' && value !== '' && value !== 'Suspended') setValue('suspensionReason', '');
  }

  if (query.error instanceof ApiForbiddenError) return <AccessRefusedState error={query.error} />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={STAFF_LIST_TITLE}
        description={STAFF_LIST_INTRO}
        actions={canExport ? <ExportCsvButton filters={filters} /> : undefined}
      />
      <StaffSubscriptionsNav current="all" />
      <Panel as="div">
        <FilterBar
          values={values}
          onChange={change}
          onFlush={(field) => flush(field)}
          onClear={() => STAFF_FILTER_FIELDS.forEach((field) => setValue(field, ''))}
        />
      </Panel>
      <ResponsiveTable
        caption="Subscriptions"
        columns={COLUMNS}
        rows={query.data?.items}
        getRowId={(r) => r.id}
        rowHref={(r) => `/staff/subscriptions/${encodeURIComponent(r.id)}`}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        emptyState={{
          title: 'No subscriptions match.',
          description: 'Change or clear the filters.',
        }}
        pager={
          query.data
            ? {
                pageNumber: query.data.pageNumber,
                pageSize: query.data.pageSize,
                totalCount: query.data.totalCount,
                onPageChange: (n) => setValue('page', String(n)),
              }
            : undefined
        }
      />
    </div>
  );
}
