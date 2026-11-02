'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { describeApiError } from '@/lib/api/errors';
import type { CustomerPasswordResetResult } from '@/lib/api/staff-customers';
import { formatInZone } from '@/lib/format/time';
import { useRequestCustomerPasswordReset } from '@/lib/hooks/useStaffCustomerMutations';

/**
 * `components/back-office-customers/CustomerPasswordReset.tsx` — HO-P5 §11.5.4 (BG-19), US-ACC-11. "Send password reset"
 * for a customer: a confirm that says where it goes ("their own mobile or email" — the server chooses and the person
 * cannot redirect it), then the result as the server reports it: the channel, the **masked** destination and when the link
 * expires. The reset token is never returned by the server and so is never shown. A refusal (403, or a customer with no
 * way to receive it) is shown as the server's own plain message.
 */
export function CustomerPasswordReset({
  customerId,
  customerName,
  zone,
}: {
  customerId: string;
  customerName: string;
  zone: string;
}) {
  const reset = useRequestCustomerPasswordReset(customerId);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CustomerPasswordResetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    setResult(null);
    try {
      setResult(await reset.mutateAsync());
    } catch (failure) {
      setError(describeApiError(failure));
    }
    setOpen(false);
  }

  return (
    <>
      <Button variant="secondary" className="min-h-11" onClick={() => setOpen(true)}>
        <KeyRound size={16} aria-hidden="true" />
        Send password reset
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Send a password reset?"
        consequence={`Send a password reset link to ${customerName}? It goes to their own mobile or email.`}
        confirmLabel="Send reset link"
        pendingLabel="Sending…"
        onConfirm={send}
      />
      {/* Live regions, so a screen reader hears the result of the dialog it just left. */}
      <div role="status" className="w-full text-sm">
        {result && (
          <p className="m-0 font-semibold text-ink">
            Reset link sent by {result.channel.toLowerCase()} to {result.maskedDestination}. It expires at{' '}
            {formatInZone(result.expiresOn, zone, { timeStyle: 'short' })}.
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="m-0 w-full text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
    </>
  );
}
