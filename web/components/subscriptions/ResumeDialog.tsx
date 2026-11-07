'use client';

import { useState } from 'react';
import { useResumeSubscription, useSubscriptionOptions } from '@/lib/hooks/useSubscriptions';
import { RESUME_DATE_FALLBACK_HELP, RESUME_DESCRIPTION, firstDeliveryHelp, resumeTitle } from '@/lib/subscriptions/copy';
import { subscriptionFieldErrors, type SubscriptionFieldErrors } from '@/lib/subscriptions/errors';
import type { ActionDialogProps } from './dialogTypes';
import { FirstDeliveryField } from './FirstDeliveryField';
import { SubscriptionDialog } from './SubscriptionDialog';
import { useResetOnOpen } from './useResetOnOpen';

/**
 * Resume a paused subscription (HO-P6 §11.2.6) with an optional date for the next delivery. The range is the server's
 * (C1 for this product); a date outside it, a suspension and a product that can no longer be bought come back as the
 * server's sentence, the date's on the date field.
 */
export function ResumeDialog({ subscription, open, onOpenChange, onDone }: ActionDialogProps) {
  const resume = useResumeSubscription(subscription.id);
  const options = useSubscriptionOptions(subscription.product.skuId, open);
  const [date, setDate] = useState('');
  const [errors, setErrors] = useState<SubscriptionFieldErrors>({});
  useResetOnOpen(open, () => {
    setDate('');
    setErrors({});
  });
  const range = options.data;

  async function confirm() {
    setErrors({});
    try {
      const result = await resume.mutateAsync(date || undefined);
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
      title={resumeTitle(subscription.product.productName)}
      description={RESUME_DESCRIPTION}
      confirmLabel="Resume subscription"
      pendingLabel="Resuming…"
      pending={resume.isPending}
      error={errors.root ?? null}
      onConfirm={() => void confirm()}
    >
      <FirstDeliveryField
        id="resume-date"
        label="First delivery date (optional)"
        value={date}
        onChange={setDate}
        min={range?.earliestFirstDeliveryOn}
        max={range?.latestFirstDeliveryOn}
        help={
          range ? firstDeliveryHelp(range) : RESUME_DATE_FALLBACK_HELP
        }
        error={errors.firstDeliveryOn}
      />
    </SubscriptionDialog>
  );
}
