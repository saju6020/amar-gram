'use client';

import { useState } from 'react';
import { useWithdrawPendingSubscriptionChanges } from '@/lib/hooks/useSubscriptions';
import { describeSubscriptionError } from '@/lib/subscriptions/errors';
import type { ActionDialogProps } from './dialogTypes';
import { SubscriptionDialog } from './SubscriptionDialog';
import { pendingLines } from './subscriptionText';
import { useResetOnOpen } from './useResetOnOpen';

/** Withdraw scheduled changes (HO-P6 §11.2.6): lists exactly what will not happen, from the server's `pending`. */
export function WithdrawDialog({ subscription, open, onOpenChange, onDone }: ActionDialogProps) {
  const withdraw = useWithdrawPendingSubscriptionChanges(subscription.id);
  const [error, setError] = useState<string | null>(null);
  useResetOnOpen(open, () => setError(null));
  const lines = pendingLines(subscription);

  async function confirm() {
    setError(null);
    try {
      const result = await withdraw.mutateAsync();
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
      title="Withdraw scheduled changes?"
      description="These changes will not happen, and your subscription carries on as it is now:"
      confirmLabel="Withdraw changes"
      pendingLabel="Withdrawing…"
      cancelLabel="Keep them"
      pending={withdraw.isPending}
      error={error}
      onConfirm={() => void confirm()}
    >
      <ul className="m-0 list-disc pl-5 text-sm text-ink">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </SubscriptionDialog>
  );
}
