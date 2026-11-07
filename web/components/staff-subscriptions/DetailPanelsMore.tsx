import { Amount } from '@/components/billing/Amount';
import { Panel } from '@/components/back-office/Panel';
import type { StaffSubscriptionDetail } from '@/lib/api/staff-subscriptions';
import { estimateDiscountLabel } from '@/lib/subscriptions/copy';
import { formatCommerceInstantLong, isZeroPercent } from '@/lib/subscriptions/dates';
import { cancellationReasonLabel, suspensionReasonLabel } from '@/lib/subscriptions/labels';
import { DetailList, DetailRow } from './DetailPanels';
import { NEVER_RECORDED, NOT_CANCELLED } from './staffCopy';

/** The server's estimate as sent (SubscriptionViewModels.cs:18-19); nothing is added up here (ADR-FE-113). Absent when the SKU has no price. */
export function EstimatePanel({ estimate }: { estimate: StaffSubscriptionDetail['estimate'] }) {
  if (!estimate) return null;
  return (
    <Panel title="Estimate per delivery">
      <DetailList>
        <DetailRow label="Price">
          {estimate.quantity} × <Amount money={estimate.unitPrice} />
        </DetailRow>
        <DetailRow label="Subtotal">
          <Amount money={estimate.subtotal} />
        </DetailRow>
        {!isZeroPercent(estimate.discountPercent) && (
          <DetailRow label={estimateDiscountLabel(estimate.discountPercent)}>
            −<Amount money={estimate.discountAmount} />
          </DetailRow>
        )}
        <DetailRow label="Estimated total">
          <Amount money={estimate.estimatedTotal} className="font-semibold" />
        </DetailRow>
      </DetailList>
      <p className="mt-3 text-xs text-ink-muted">{estimate.note}</p>
    </Panel>
  );
}

/**
 * The record of what staff and the customer did: suspension, restart, cancellation. The restart shows the date and the
 * reason, never who: the server sends a staff id with no name (backend gap BG-S5, OQ-15).
 */
export function RecordsPanel({ subscription }: { subscription: StaffSubscriptionDetail }) {
  const zone = subscription.commerceTimeZoneId;
  const { suspendedOn, reinstatement, cancelledOn, cancellationReason, cancellationNote } = subscription;
  return (
    <Panel title="Records">
      <DetailList>
        <DetailRow label="Suspension">
          {suspendedOn
            ? `Suspended on ${formatCommerceInstantLong(suspendedOn, zone)}${subscription.suspensionReason ? `: ${suspensionReasonLabel(subscription.suspensionReason)}` : ''}`
            : NEVER_RECORDED}
        </DetailRow>
        <DetailRow label="Restart">
          {reinstatement
            ? `Restarted on ${formatCommerceInstantLong(reinstatement.reinstatedOn, zone)}: ${reinstatement.reason}`
            : NEVER_RECORDED}
        </DetailRow>
        <DetailRow label="Cancellation">
          {cancelledOn
            ? `Cancelled on ${formatCommerceInstantLong(cancelledOn, zone)}: ${cancellationReasonLabel(cancellationReason)}${cancellationNote ? `, ${cancellationNote}` : ''}`
            : NOT_CANCELLED}
        </DetailRow>
      </DetailList>
    </Panel>
  );
}
