'use client';

import { useState } from 'react';
import { useSkipSubscriptionDelivery } from '@/lib/hooks/useSubscriptions';
import { skipConfirmTitle } from '@/lib/subscriptions/copy';
import { describeSubscriptionError } from '@/lib/subscriptions/errors';
import type { ActionDialogProps } from './dialogTypes';
import { SubscriptionDialog } from './SubscriptionDialog';
import { useResetOnOpen } from './useResetOnOpen';

/**
 * "Skip the delivery on {date}?" (HO-P6 §11.2.6, US-SUB-02/03). Nothing is sent until the customer confirms; the request
 * carries exactly the date the dialog names. If the server says the delivery can no longer be skipped, its sentence is
 * shown (it names the next date that can) and the page re-reads.
 */
export function SkipDialog({
  subscription,
  cycleOn,
  open,
  onOpenChange,
  onDone,
}: ActionDialogProps & { cycleOn: string }) {
  const skip = useSkipSubscriptionDelivery(subscription.id);
  const [error, setError] = useState<string | null>(null);
  useResetOnOpen(open, () => setError(null));

  async function confirm() {
    setError(null);
    try {
      const result = await skip.mutateAsync(cycleOn);
      onOpenChange(false);
      onDone(result.message);
    } catch (caught) {
      setError(describeSubscriptionError(caught));
    }
  }

  return (
    <SubscriptionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={skipConfirmTitle(cycleOn)}
      description="We won't place an order for this delivery. Your other deliveries stay as they are."
      confirmLabel="Skip this delivery"
      pendingLabel="Skipping…"
      cancelLabel="Keep it"
      pending={skip.isPending}
      error={error}
      onConfirm={() => void confirm()}
    />
  );
}
