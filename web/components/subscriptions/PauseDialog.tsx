'use client';

import { useState } from 'react';
import { usePauseSubscription } from '@/lib/hooks/useSubscriptions';
import { PAUSE_CONFIRM_UNLOCKED, pauseConfirmLocked, pauseTitle } from '@/lib/subscriptions/copy';
import { describeSubscriptionError } from '@/lib/subscriptions/errors';
import type { ActionDialogProps } from './dialogTypes';
import { SubscriptionDialog } from './SubscriptionDialog';
import { useResetOnOpen } from './useResetOnOpen';

/**
 * Pause (HO-P6 §11.2.6, UI-3). The wording is chosen only from `isLocked`: before the cut-off it pauses now; after it, the
 * delivery being prepared still arrives and the pause starts after it. The result's sentence says which.
 */
export function PauseDialog({ subscription, open, onOpenChange, onDone }: ActionDialogProps) {
  const pause = usePauseSubscription(subscription.id);
  const [error, setError] = useState<string | null>(null);
  useResetOnOpen(open, () => setError(null));
  const locked = subscription.isLocked && subscription.nextDeliveryOn;

  async function confirm() {
    setError(null);
    try {
      const result = await pause.mutateAsync();
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
      title={pauseTitle(subscription.product.productName)}
      description={locked ? pauseConfirmLocked(subscription.nextDeliveryOn!) : PAUSE_CONFIRM_UNLOCKED}
      confirmLabel="Pause subscription"
      pendingLabel="Pausing…"
      cancelLabel="Keep it going"
      pending={pause.isPending}
      error={error}
      onConfirm={() => void confirm()}
    />
  );
}
