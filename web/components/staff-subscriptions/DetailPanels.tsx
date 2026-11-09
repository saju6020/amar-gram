import type { ReactNode } from 'react';
import { Panel } from '@/components/back-office/Panel';
import type { StaffSubscriptionDetail } from '@/lib/api/staff-subscriptions';
import {
  ADDRESS_REMOVED_STAFF,
  cutoffSentence,
  placeRowLabel,
  pendingChangeLines,
  staffScheduleLockedText,
} from '@/lib/subscriptions/copy';
import {
  intervalLabel,
  subscriptionPaymentMethodLabel,
} from '@/lib/subscriptions/labels';
import { CustomerLink, nextDeliveryText } from './SubscriptionRowCells';

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-0.5 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export function DetailList({ children }: { children: ReactNode }) {
  return <dl className="flex flex-col gap-3">{children}</dl>;
}

export function CustomerPanel({ customer }: { customer: StaffSubscriptionDetail['customer'] }) {
  return (
    <Panel title="Customer">
      <DetailList>
        <DetailRow label="Name">
          <CustomerLink id={customer.id} name={customer.name} />
        </DetailRow>
        <DetailRow label="Mobile">{customer.mobile ?? '—'}</DetailRow>
      </DetailList>
    </Panel>
  );
}

export function SchedulePanel({ subscription }: { subscription: StaffSubscriptionDetail }) {
  const lines = pendingChangeLines(subscription, 'staff');
  const { nextDeliveryOn, changeCutoffOn, isLocked, commerceTimeZoneId } = subscription;
  return (
    <Panel title="Schedule">
      <DetailList>
        <DetailRow label="Next delivery">{nextDeliveryText(subscription)}</DetailRow>
        {nextDeliveryOn && changeCutoffOn && (
          <DetailRow label="Changes">
            {cutoffSentence({ changeCutoffOn, nextDeliveryOn, commerceTimeZoneId })}
            {isLocked && <span className="mt-1 block font-semibold">{staffScheduleLockedText(nextDeliveryOn)}</span>}
          </DetailRow>
        )}
        <DetailRow label="Scheduled changes">
          {lines.length === 0 ? (
            'None'
          ) : (
            <ul className="flex flex-col gap-1">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </DetailRow>
      </DetailList>
    </Panel>
  );
}

export function TermsPanel({ subscription }: { subscription: StaffSubscriptionDetail }) {
  const t = subscription.terms;
  return (
    <Panel title="Terms">
      <DetailList>
        <DetailRow label="Per delivery">{t.quantity}</DetailRow>
        <DetailRow label="How often">{intervalLabel(t.intervalWeeks)}</DetailRow>
        <DetailRow label={placeRowLabel(t)}>
          {t.fulfilment === 'Pickup'
            ? (t.pickupBranch?.name ?? '—')
            : t.deliveryAddress
              ? `${t.deliveryAddress.label}: ${t.deliveryAddress.line1}, ${t.deliveryAddress.city}`
              : '—'}
          {t.deliveryAddressMissing && <span className="mt-1 block font-semibold">{ADDRESS_REMOVED_STAFF}</span>}
        </DetailRow>
        <DetailRow label="Payment">{subscriptionPaymentMethodLabel(t.paymentMethod)}, for each order</DetailRow>
      </DetailList>
    </Panel>
  );
}
