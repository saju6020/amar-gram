'use client';

import { useState } from 'react';
import { pillTextareaClass } from '@/components/hearth/fields';
import type { SubscriptionCustomerCancellationReason } from '@/lib/api/subscriptions';
import { useCancelSubscription } from '@/lib/hooks/useSubscriptions';
import { CANCEL_NOTE_LABEL, CANCEL_REASON_REQUIRED, CANCEL_UNLOCKED, cancelConfirmLocked, cancelTitle } from '@/lib/subscriptions/copy';
import { subscriptionFieldErrors, type SubscriptionFieldErrors } from '@/lib/subscriptions/errors';
import { CUSTOMER_CANCELLATION_REASON_OPTIONS } from '@/lib/subscriptions/labels';
import type { ActionDialogProps } from './dialogTypes';
import { FieldError } from './FieldError';
import { SubscriptionDialog } from './SubscriptionDialog';
import { useResetOnOpen } from './useResetOnOpen';

/** `SubscriptionRules.MaxNoteLength` (Shared/Common/Constants/SubscriptionRules.cs): the note's limit, enforced by the field. */
const NOTE_LIMIT = 500;

/**
 * Cancel the subscription (HO-P6 §11.2.6, UI-3, OQ-5). A reason is **required** before anything is sent (the server refuses a
 * cancel without one); the note is optional, up to 500 characters with a counter, and shown back as plain text everywhere.
 * After the cut-off the wording says the delivery being prepared still arrives; that is chosen from `isLocked` alone.
 */
export function CancelDialog({ subscription, open, onOpenChange, onDone }: ActionDialogProps) {
  const cancel = useCancelSubscription(subscription.id);
  const [reason, setReason] = useState<SubscriptionCustomerCancellationReason | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<SubscriptionFieldErrors>({});
  useResetOnOpen(open, () => {
    setReason(null);
    setNote('');
    setErrors({});
  });
  const locked = subscription.isLocked && subscription.nextDeliveryOn;

  async function confirm() {
    if (!reason) {
      setErrors({ reason: CANCEL_REASON_REQUIRED });
      return;
    }
    setErrors({});
    try {
      const trimmed = note.trim();
      const result = await cancel.mutateAsync({ reason, ...(trimmed ? { note: trimmed } : {}) });
      onOpenChange(false);
      onDone(result.message);
    } catch (caught) {
      setErrors(subscriptionFieldErrors(caught));
    }
  }

  return (
    <SubscriptionDialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      destructive
      title={cancelTitle(subscription.product.productName)}
      description={
        locked
          ? cancelConfirmLocked(subscription.nextDeliveryOn!)
          : CANCEL_UNLOCKED
      }
      confirmLabel="Cancel subscription"
      pendingLabel="Cancelling…"
      cancelLabel="Keep my subscription"
      pending={cancel.isPending}
      error={errors.root ?? null}
      onConfirm={() => void confirm()}
    >
      <fieldset
        className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0"
        aria-describedby={errors.reason ? 'cancel-reason-error' : undefined}
      >
        <legend className="mb-1 p-0 text-[13px] font-semibold text-ink">Why are you cancelling?</legend>
        {CUSTOMER_CANCELLATION_REASON_OPTIONS.map((option) => (
          <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-ink">
            <input
              type="radio"
              name="cancel-reason"
              value={option.value}
              checked={reason === option.value}
              onChange={() => setReason(option.value)}
              className="size-5 flex-none accent-leaf"
            />
            {option.label}
          </label>
        ))}
        <FieldError id="cancel-reason-error">{errors.reason}</FieldError>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cancel-note" className="text-[13px] font-semibold text-ink">
          {CANCEL_NOTE_LABEL}
        </label>
        <textarea
          id="cancel-note"
          value={note}
          maxLength={NOTE_LIMIT}
          onChange={(event) => setNote(event.target.value)}
          aria-describedby="cancel-note-count"
          className={pillTextareaClass}
        />
        <p id="cancel-note-count" className="m-0 text-right text-xs text-ink-muted">
          {`${note.length} of ${NOTE_LIMIT} characters`}
        </p>
        <FieldError id="cancel-note-error">{errors.note}</FieldError>
      </div>
    </SubscriptionDialog>
  );
}
