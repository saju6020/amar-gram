'use client';

import type { StaffSubscriptionDetail } from '@/lib/api/staff-subscriptions';
import { useReinstateSubscription, useStaffCancelSubscription } from '@/lib/hooks/useStaffSubscriptions';
import {
  REINSTATE_DATE_HELP,
  STAFF_CANCELLED_MESSAGE,
  reinstateDescription,
  reinstateTitle,
  reinstatedMessage,
  staffCancelDescription,
  staffCancelLockedText,
  staffCancelScheduledMessage,
  staffCancelTitle,
} from '@/lib/subscriptions/copy';
import { SUBSCRIPTION_CODE_MESSAGES } from '@/lib/subscriptions/errors';
import { cancellationReasonLabel } from '@/lib/subscriptions/labels';
import { StaffActionDialog } from './StaffActionDialog';

interface DialogProps {
  subscription: StaffSubscriptionDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The server-derived sentence to announce once the write has succeeded. */
  onDone: (message: string) => void;
  onForbidden: () => void;
}

/** US-SUB-06: restart a suspended subscription. The first delivery date is optional and has no client bounds (OQ-16, BG-S6). */
export function ReinstateDialog({ subscription, open, onOpenChange, onDone, onForbidden }: DialogProps) {
  const reinstate = useReinstateSubscription(subscription.id);
  const customer = subscription.customer.name;
  return (
    <StaffActionDialog
      open={open}
      onOpenChange={onOpenChange}
      onForbidden={onForbidden}
      title={reinstateTitle(customer, subscription.product.productName)}
      description={reinstateDescription(customer)}
      textField="reason"
      textLabel="Reason"
      textHint="Kept on the subscription's record."
      textRequiredMessage={SUBSCRIPTION_CODE_MESSAGES.ReinstatementReasonRequired!}
      dateHint={REINSTATE_DATE_HELP}
      confirmLabel="Restart"
      dismissLabel="Keep suspended"
      onSubmit={async (reason, date) => {
        const view = await reinstate.mutateAsync({ reason, ...(date ? { firstDeliveryOn: date } : {}) });
        onDone(reinstatedMessage(view.nextDeliveryOn));
      }}
    />
  );
}

/** US-SUB-06: cancel with a required note. After the cut-off the server schedules the cancel; the answer says which. */
export function StaffCancelDialog({ subscription, open, onOpenChange, onDone, onForbidden }: DialogProps) {
  const cancel = useStaffCancelSubscription(subscription.id);
  const customer = subscription.customer.name;
  const locked = subscription.isLocked && subscription.nextDeliveryOn;
  return (
    <StaffActionDialog
      open={open}
      onOpenChange={onOpenChange}
      onForbidden={onForbidden}
      title={staffCancelTitle(customer, subscription.product.productName)}
      description={
        locked
          ? staffCancelLockedText(subscription.nextDeliveryOn!)
          : staffCancelDescription(customer)
      }
      textField="note"
      textLabel="Note"
      textHint={`Plain text. Recorded as "${cancellationReasonLabel('StaffCancelled')}".`}
      textRequiredMessage={SUBSCRIPTION_CODE_MESSAGES.CancellationReasonRequired!}
      confirmLabel="Cancel subscription"
      dismissLabel="Keep subscription"
      destructive
      onSubmit={async (note) => {
        const view = await cancel.mutateAsync({ note });
        onDone(
          view.status === 'Cancelled'
            ? STAFF_CANCELLED_MESSAGE
            : staffCancelScheduledMessage(view.pending?.appliesFromCycleOn),
        );
      }}
    />
  );
}
