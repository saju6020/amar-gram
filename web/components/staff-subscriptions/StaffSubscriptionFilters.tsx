'use client';

import { SearchField } from '@/components/back-office/SearchField';
import { SelectField } from '@/components/billing/Fields';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SUBSCRIPTION_PAYMENT_METHODS,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_SUSPENSION_REASONS,
} from '@/lib/api/subscriptions';
import { formatCycleDate, isCalendarDate } from '@/lib/subscriptions/dates';
import {
  subscriptionPaymentMethodLabel,
  subscriptionStatusLabel,
  suspensionReasonLabel,
} from '@/lib/subscriptions/labels';

export const STAFF_FILTER_FIELDS = ['status', 'suspensionReason', 'paymentMethod', 'q', 'nextDeliveryOn', 'sort', 'page'] as const;
export type StaffFilterField = (typeof STAFF_FILTER_FIELDS)[number];
export type StaffFilterValues = Record<StaffFilterField, string>;

/** The sorts the server knows (SubscriptionStaffQueryHandlers.cs:37-43); the first is the default (a blank `sort`). */
const SORTS = [
  { value: '', label: 'Next delivery (soonest)' },
  { value: '-nextDeliveryOn', label: 'Next delivery (latest)' },
  { value: 'status', label: 'Status' },
  { value: 'product', label: 'Product' },
] as const;

const CONTROL_HEIGHT = 'min-h-11';

/**
 * HO-P6 S2 (§11.3.3, UI-4). Status, suspension reason, payment method, search and sort, all kept in the address by the
 * caller. The reason select is enabled only when Status is Suspended or empty (a reason means nothing for the others).
 */
export function StaffSubscriptionFilters({
  values,
  onChange,
  onFlush,
  onClear,
}: {
  values: StaffFilterValues;
  onChange: (field: StaffFilterField, value: string) => void;
  /** Writes the debounced search to the address now (on blur). */
  onFlush: (field: StaffFilterField) => void;
  onClear: () => void;
}) {
  const reasonEnabled = values.status === '' || values.status === 'Suspended';
  const hasFilter = Boolean(values.status || values.suspensionReason || values.paymentMethod || values.q || values.nextDeliveryOn || values.sort);
  return (
    <form
      role="search"
      aria-label="Subscription filters"
      className="flex flex-col gap-3"
      onSubmit={(event) => event.preventDefault()}
    >
      <SearchField
        id="subscriptions-q"
        label="Customer, mobile or product"
        placeholder="Customer, mobile or product"
        value={values.q}
        onChange={(value) => onChange('q', value)}
        onBlur={() => onFlush('q')}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          id="subscriptions-status"
          label="Status"
          className={CONTROL_HEIGHT}
          value={values.status}
          onChange={(event) => onChange('status', event.target.value)}
        >
          <option value="">Any status</option>
          {SUBSCRIPTION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {subscriptionStatusLabel(status)}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="subscriptions-reason"
          label="Suspension reason"
          className={CONTROL_HEIGHT}
          value={values.suspensionReason}
          disabled={!reasonEnabled}
          onChange={(event) => onChange('suspensionReason', event.target.value)}
        >
          <option value="">Any reason</option>
          {SUBSCRIPTION_SUSPENSION_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {suspensionReasonLabel(reason)}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="subscriptions-method"
          label="Payment method"
          className={CONTROL_HEIGHT}
          value={values.paymentMethod}
          onChange={(event) => onChange('paymentMethod', event.target.value)}
        >
          <option value="">Any method</option>
          {SUBSCRIPTION_PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {subscriptionPaymentMethodLabel(method)}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="subscriptions-sort"
          label="Sort by"
          className={CONTROL_HEIGHT}
          value={values.sort}
          onChange={(event) => onChange('sort', event.target.value)}
        >
          {SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>
              {sort.label}
            </option>
          ))}
        </SelectField>
      </div>
      {isCalendarDate(values.nextDeliveryOn) && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="min-h-11"
            aria-label={`Remove filter: Next delivery ${formatCycleDate(values.nextDeliveryOn)}`}
            onClick={() => onChange('nextDeliveryOn', '')}
          >
            Next delivery: {formatCycleDate(values.nextDeliveryOn)}
            <X size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-muted">
          Filters are kept in the address, so the view can be shared or reloaded.
        </p>
        {hasFilter && (
          <Button variant="ghost" className="min-h-11" onClick={onClear}>
            Clear filters
          </Button>
        )}
      </div>
    </form>
  );
}
