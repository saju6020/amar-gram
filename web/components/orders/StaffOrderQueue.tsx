'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/back-office/PageHeader';
import { Panel } from '@/components/back-office/Panel';
import { PillTabs } from '@/components/back-office/PillTabs';
import { SearchField } from '@/components/back-office/SearchField';
import { SplitView } from '@/components/back-office/SplitView';
import { AccessRefusedState } from '@/components/admin/AccessRefusedState';
import { AmountCell } from '@/components/billing/Amount';
import { SelectField, TextField } from '@/components/billing/Fields';
import { type Column, ResponsiveTable } from '@/components/billing/ResponsiveTable';
import { ManifestDownload } from '@/components/fulfilment/ManifestDownload';
import { Button } from '@/components/ui/button';
import { ApiForbiddenError } from '@/lib/api/client';
import type { StaffOrderRow } from '@/lib/api/staff-orders';
import {
  dayEndInstant,
  dayStartInstant,
  fulfilmentLabel,
  orderChannelLabel,
  formatAgeMinutes,
  orderStatusLabel,
  paymentMethodLabel,
} from '@/lib/format/orders';
import { useBranchTimeZone } from '@/lib/hooks/useBranchTimeZone';
import { formatDateOnly } from '@/lib/format/time';
import { useStaffOrderQueue, useStaffOrderStatusCounts } from '@/lib/hooks/useStaffOrders';
import { useUrlFilterState } from '@/lib/hooks/useUrlFilterState';
import { cn } from '@/lib/utils';
import { OrderFlagBadge, OrderStatusBadge } from './OrderStatusBadge';
import { StaffOrderSidePanel } from './StaffOrderSidePanel';
import { StaffOrdersTabs } from './StaffOrdersTabs';

/**
 * `components/orders/StaffOrderQueue.tsx` — ⭐ HO-ORD-002 §11.8, US-ORD-09, UI-4/UI-5; HO-P4 S2 (§11.3.1-2)
 * made it the orders workbench. Filters (status, fulfilment, payment method, channel, date range, search)
 * live in the URL; the loaded page sorts by order number or customer; paging is the server's. The
 * status pills are the `status` filter, each with the server's count for that status under the other
 * filters ("All" shows the server's `total`; HO-P5 BG-2), and the less-used filters sit in "More filters".
 * The Fulfilment cell shows a delivery's area and slot (BG-3). The list and the counts refetch every 30 s
 * (the filters and the selection are URL state, so a refetch never touches what the person typed or chose).
 *
 * From 1024 px the list and the selected order sit side by side: choosing a row writes `?order=<id>`
 * (ADR-FE-183) and the side panel reads that order. Below 1024 px a row links to the full order page,
 * and the list becomes cards below 768 px.
 */
const FIELDS = ['status', 'fulfilment', 'paymentMethod', 'channel', 'from', 'to', 'search', 'page', 'order'] as const;
/** The filters that are not the page, the selection or the pills / search (those have their own controls). */
const MORE_FIELDS = ['status', 'fulfilment', 'paymentMethod', 'channel', 'from', 'to'] as const;
const PAGE_SIZE = 25;
const STATUSES = ['PendingPayment', 'Confirmed', 'Packing', 'Packed', 'Dispatched', 'Delivered', 'Cancelled', 'Returned', 'Refunded'];
const PILL_STATUSES = ['PendingPayment', 'Confirmed', 'Packing', 'Packed', 'Dispatched'];
const FULFILMENTS = ['Delivery', 'Pickup', 'Counter'];
const PAYMENTS = ['CashOnDelivery', 'BankTransfer', 'PayOnCollection', 'InStore'];
const ALL_PILL = 'all';
const WIDE_QUERY = '(min-width: 1024px)';

/**
 * HO-P5 BG-3 (11.3.7): under "Delivery", the area ({district, else zone}) and, when the order has a slot, "{date} · {window}".
 * A pickup or counter order shows nothing extra. A subscription order (display only, OQ-11) names its channel.
 */
function fulfilmentDetail(o: StaffOrderRow): string[] {
  const lines: string[] = [];
  if (o.fulfilmentMethod === 'Delivery') {
    const area = o.deliveryDistrict ?? o.deliveryZone;
    if (area) lines.push(area);
    if (o.slotDate) lines.push(o.slotWindowLabel ? `${formatDateOnly(o.slotDate)} · ${o.slotWindowLabel}` : formatDateOnly(o.slotDate));
  }
  if (o.channel === 'Subscription') lines.push(orderChannelLabel(o.channel));
  return lines;
}

/** True from 1024 px. Starts true (like `ResponsiveTable`) and is corrected on mount; true where there is no `matchMedia`. */
function useIsWide(): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide;
}

export function StaffOrderQueue() {
  const { values, setValue, flush } = useUrlFilterState(FIELDS, {}, ['search']);
  const zone = useBranchTimeZone();
  const wide = useIsWide();
  const filters = {
    status: values.status || undefined,
    fulfilment: values.fulfilment || undefined,
    paymentMethod: values.paymentMethod || undefined,
    channel: values.channel || undefined,
    // The date inputs give a calendar day; the API takes instants - read the day in the branch's zone.
    from: values.from ? dayStartInstant(values.from, zone) : undefined,
    to: values.to ? dayEndInstant(values.to, zone) : undefined,
    search: values.search.trim() || undefined,
  };
  const query = useStaffOrderQueue({ ...filters, pageNumber: Number(values.page) || 1, pageSize: PAGE_SIZE });
  // HO-P5 BG-2: the pills' counts are the server's, under every filter but `status`; they refetch with the queue (UI-5).
  const counts = useStaffOrderStatusCounts({
    fulfilment: filters.fulfilment,
    paymentMethod: filters.paymentMethod,
    channel: filters.channel,
    from: filters.from,
    to: filters.to,
    search: filters.search,
  });
  const countOf = (status: string) => counts.data?.counts.find((c) => c.status === status)?.count;

  function set(name: (typeof FIELDS)[number], value: string) {
    setValue(name, value);
    if (name !== 'page' && name !== 'order') setValue('page', '');
  }

  const selectedId = values.order;
  const columns: Array<Column<StaffOrderRow>> = [
    {
      id: 'number',
      header: 'Order',
      primary: true,
      sortValue: (o) => o.orderNumber,
      cell: (o) => {
        const selected = wide && selectedId === o.id;
        return (
          <span className="flex flex-col items-start">
            {wide ? (
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => set('order', selected ? '' : o.id)}
                className={cn(
                  'min-h-8 rounded-[var(--radius-sm)] px-1.5 font-bold text-ink underline',
                  selected && 'bg-leaf-soft text-leaf-ink',
                )}
              >
                {o.orderNumber}
              </button>
            ) : (
              o.orderNumber
            )}
            <span className="px-1.5 text-xs font-normal text-ink-muted">{formatAgeMinutes(o.ageMinutes)} ago</span>
          </span>
        );
      },
    },
    { id: 'customer', header: 'Customer', sortValue: (o) => o.customerName, cell: (o) => o.customerName },
    {
      id: 'fulfilment',
      header: 'Fulfilment',
      cell: (o) => {
        const detail = fulfilmentDetail(o);
        return (
          <span className="flex flex-col items-start">
            {fulfilmentLabel(o.fulfilmentMethod)}
            {detail.map((line) => (
              <span key={line} className="text-xs font-normal text-ink-muted [overflow-wrap:anywhere]">{line}</span>
            ))}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      nowrap: true,
      cell: (o) => (
        <span className="flex flex-col items-start gap-1">
          <OrderStatusBadge status={o.status} />
          {o.flags.length === 0 ? (
            <span className="sr-only">No flags</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {o.flags.map((flag) => (
                <OrderFlagBadge key={flag} flag={flag} />
              ))}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'total',
      header: 'Total',
      numeric: true,
      cell: (o) => (
        <span className="flex flex-col items-end">
          <AmountCell money={o.grandTotal} />
          <span className="text-xs font-normal text-ink-muted">{paymentMethodLabel(o.paymentMethod)}</span>
        </span>
      ),
    },
  ];

  if (query.error instanceof ApiForbiddenError) return <AccessRefusedState error={query.error} />;
  const filtered = FIELDS.some((name) => name !== 'page' && name !== 'order' && values[name]);
  const moreActive = MORE_FIELDS.some((name) => name !== 'status' && values[name]) || (!!values.status && !PILL_STATUSES.includes(values.status));
  const pillValue = values.status === '' ? ALL_PILL : values.status;

  const list = (
    <ResponsiveTable
      caption="Orders"
      columns={columns}
      rows={query.data?.items}
      getRowId={(o) => o.id}
      rowHref={wide ? undefined : (o) => `/staff/orders/${o.id}`}
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      emptyState={{ title: 'No orders match.', description: filtered ? 'Change or clear the filters.' : 'New orders appear here as they are placed.' }}
      pager={
        query.data
          ? { pageNumber: query.data.pageNumber, pageSize: query.data.pageSize, totalCount: query.data.totalCount, onPageChange: (n) => setValue('page', String(n)) }
          : undefined
      }
    />
  );

  const detail = !wide ? null : selectedId ? (
    <StaffOrderSidePanel orderId={selectedId} />
  ) : (
    <Panel aria-label="No order selected">
      <p className="text-sm text-ink-muted">Choose an order in the list to see its pick list and the next step.</p>
    </Panel>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Orders"
        description="Every order at the active branch, newest first. The list refreshes every 30 seconds."
        actions={
          <form role="search" aria-label="Order search" className="w-full sm:w-[340px]" onSubmit={(event) => event.preventDefault()}>
            <SearchField
              id="oq-search"
              label="Search orders"
              placeholder="Order no., customer or mobile"
              value={values.search}
              onChange={(value) => set('search', value)}
              onBlur={() => flush('search')}
            />
          </form>
        }
      />
      <StaffOrdersTabs />
      <PillTabs
        mode="state"
        label="Order status"
        value={pillValue}
        onChange={(key) => set('status', key === ALL_PILL ? '' : key)}
        items={[
          ...PILL_STATUSES.map((status) => ({ key: status, label: orderStatusLabel(status), count: countOf(status) })),
          { key: ALL_PILL, label: 'All', count: counts.data?.total },
        ]}
      />
      <div className="grid items-start gap-3 md:grid-cols-2">
        <details open={moreActive} className="rounded-2xl border border-border bg-surface p-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink">More filters</summary>
          <form role="search" aria-label="Order filters" className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
            <SelectField id="oq-status" label="Status" value={values.status} onChange={(e) => set('status', e.target.value)}>
              <option value="">Any status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{orderStatusLabel(s)}</option>
              ))}
            </SelectField>
            <SelectField id="oq-fulfilment" label="Fulfilment" value={values.fulfilment} onChange={(e) => set('fulfilment', e.target.value)}>
              <option value="">Any</option>
              {FULFILMENTS.map((f) => (
                <option key={f} value={f}>{fulfilmentLabel(f)}</option>
              ))}
            </SelectField>
            <SelectField id="oq-payment" label="Payment method" value={values.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
              <option value="">Any</option>
              {PAYMENTS.map((p) => (
                <option key={p} value={p}>{paymentMethodLabel(p)}</option>
              ))}
            </SelectField>
            <SelectField id="oq-channel" label="Channel" value={values.channel} onChange={(e) => set('channel', e.target.value)}>
              <option value="">Online and counter</option>
              <option value="Online">Online</option>
              <option value="Counter">Counter</option>
            </SelectField>
            <TextField id="oq-from" label="Placed from" type="date" value={values.from} onChange={(e) => set('from', e.target.value)} />
            <TextField id="oq-to" label="Placed to" type="date" value={values.to} onChange={(e) => set('to', e.target.value)} />
          </form>
        </details>
        <ManifestDownload />
      </div>
      {filtered && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => FIELDS.forEach((name) => name !== 'order' && setValue(name, ''))}
          >
            Clear filters
          </Button>
        </div>
      )}
      <SplitView list={list} detail={detail} listLabel="Order list" detailLabel="Selected order" />
    </div>
  );
}
