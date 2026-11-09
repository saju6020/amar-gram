'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CircleCheck } from 'lucide-react';
import { Panel } from '@/components/back-office/Panel';
import { StatusPill } from '@/components/back-office/StatusPill';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { useToast } from '@/components/ui/use-toast';
import type { ApproveResult, PendingApproval } from '@/lib/api/billing-staff';
import { describeBillingError } from '@/lib/api/errors';
import { formatDateOnly } from '@/lib/format/time';
import { useApprovals } from '@/lib/hooks/billing/useBillingQueries';
import { useApprovePayment, useRejectPayment } from '@/lib/hooks/billing/useBillingMutations';
import { useStaffSession } from '@/lib/hooks/useSession';
import { AccessRefusedState } from '@/components/admin/AccessRefusedState';
import { ApiForbiddenError } from '@/lib/api/client';
import { a11yMoney } from '@/lib/money';
import { Amount } from './Amount';
import { methodLabel } from './labels';
import { PageHeader } from './PageHeader';
import { ReasonDialog } from './ReasonDialog';

/**
 * `components/billing/ApprovalsQueue.tsx` — HO-BIL-002 §11.4 (US-BIL-11 AC2), ⭐; HO-P4 §11.6.2. Payments
 * waiting for a second person at the active branch, one card each: amount, customer, method, bank
 * reference, recorder, requested allocations. **Approve** and **Reject** are replaced by the words
 * *"You recorded this one. Another staff member must approve or reject it."* when the server says the
 * caller cannot approve (`canApprove` false) or the payment's `recordedBy` is the signed-in account
 * (HO-P4 Amended (i)) — presentation only; the server refuses either from the recorder with
 * `ApproverMustDiffer`. **Reject** needs a reason.
 * What an approval did — applied, left unallocated — is shown after it, as the server reported it.
 */
export function ApprovalsQueue() {
  const approvals = useApprovals();
  const approve = useApprovePayment();
  const reject = useRejectPayment();
  const { data: session } = useStaffSession();
  const { toast } = useToast();
  const [outcomes, setOutcomes] = useState<Array<{ id: string; label: string; result: ApproveResult }>>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<PendingApproval | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function approveRow(row: PendingApproval) {
    setBusy(row.paymentId);
    setErrors((current) => ({ ...current, [row.paymentId]: '' }));
    try {
      const result = await approve.mutateAsync(row.paymentId);
      setOutcomes((current) => [...current, { id: row.paymentId, label: `${row.customerName} — ${a11yMoney(row.amount)}`, result }]);
    } catch (failure) {
      setErrors((current) => ({ ...current, [row.paymentId]: describeBillingError(failure) }));
    } finally {
      setBusy(null);
    }
  }

  if (approvals.error instanceof ApiForbiddenError) return <AccessRefusedState error={approvals.error} />;

  const rows = approvals.data;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Approvals" description="A transfer is confirmed by a second person: whoever recorded it cannot approve it." />
      {outcomes.length > 0 && (
        <Panel title="Just approved" headingLevel={3}>
          <ul role="status" className="flex flex-col gap-3 text-sm">
            {outcomes.map((o) => (
              <li key={o.id} className="flex flex-wrap items-start gap-2">
                <StatusPill tone="success" icon={<CircleCheck size={12} />}>
                  Done
                </StatusPill>
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <strong>{o.label}</strong> approved.{' '}
                  {o.result.applied.length > 0
                    ? o.result.applied.map((a) => <span key={a.invoiceId}>Applied <Amount money={a.amount} /> to {a.number}. </span>)
                    : 'Nothing was applied to an invoice. '}
                  Left unallocated: <Amount money={o.result.leftUnallocated} />.
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {approvals.isLoading ? (
        <LoadingState rows={3} label="Loading the approvals queue…" />
      ) : approvals.isError ? (
        <ErrorState description="We couldn’t load the approvals queue." onRetry={() => void approvals.refetch()} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState title="Nothing is waiting for approval." description="Payments above the approval limit appear here." />
      ) : (
        <ul aria-label="Payments waiting for approval" className="flex flex-col gap-3">
          {rows.map((r) => {
            const recordedByMe = !r.canApprove || (!!session && r.recordedBy === session.staffAccountId);
            return (
              <li
                key={r.paymentId}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex min-w-0 flex-1 basis-64 flex-col gap-0.5 leading-snug">
                  <p className="font-semibold text-ink [overflow-wrap:anywhere]">
                    <Amount money={r.amount} /> ·{' '}
                    <Link href={`/staff/billing/payments/${r.paymentId}`} className="text-ink hover:underline">
                      {r.customerName}
                    </Link>
                  </p>
                  <p className="text-sm text-ink-muted [overflow-wrap:anywhere]">
                    {methodLabel(r.method)}
                    {r.externalReference ? ` · bank ref ${r.externalReference}` : ''} · recorded by {r.recordedByName} ·{' '}
                    {formatDateOnly(r.receivedOn)}
                  </p>
                  <p className="text-sm text-ink-muted [overflow-wrap:anywhere]">
                    {r.requestedAllocations.length === 0 ? (
                      'None — kept as credit'
                    ) : (
                      <>
                        Requested:{' '}
                        {r.requestedAllocations.map((a, index) => (
                          <span key={a.invoiceId}>
                            {index > 0 ? ', ' : ''}
                            {a.invoiceNumber} — <Amount money={a.amount} />
                          </span>
                        ))}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {recordedByMe ? (
                    <p className="rounded-[var(--radius-sm)] bg-warning-bg px-3 py-1.5 text-sm text-warning-ink">
                      You recorded this one. Another staff member must approve or reject it.
                    </p>
                  ) : (
                    <>
                      <Button
                        className="min-h-11 bg-leaf px-4 text-surface hover:bg-leaf-ink"
                        disabled={busy !== null}
                        aria-busy={busy === r.paymentId}
                        onClick={() => void approveRow(r)}
                      >
                        {busy === r.paymentId ? 'Approving…' : 'Approve'}
                        <span className="sr-only"> {r.customerName}</span>
                      </Button>
                      <Button
                        variant="secondary"
                        className="min-h-11 border-danger-ink bg-surface px-4 text-danger-ink hover:bg-danger-bg"
                        disabled={busy !== null}
                        onClick={() => setRejecting(r)}
                      >
                        Reject<span className="sr-only"> {r.customerName}</span>
                      </Button>
                    </>
                  )}
                </div>
                {errors[r.paymentId] && (
                  <p role="alert" className="basis-full text-sm font-semibold text-danger-ink">
                    {errors[r.paymentId]}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ReasonDialog
        open={rejecting !== null}
        onOpenChange={(open) => !open && setRejecting(null)}
        title="Reject this payment"
        consequence={`Reject the ${rejecting ? a11yMoney(rejecting.amount) : ''} payment from ${rejecting?.customerName ?? ''}? It will not count towards any invoice or the day’s cash-up. It stays on record, marked rejected, with your reason.`}
        confirmLabel="Reject payment"
        pendingLabel="Rejecting…"
        onSubmit={async (reason) => {
          if (!rejecting) return;
          await reject.mutateAsync({ paymentId: rejecting.paymentId, reason });
          toast({ title: 'Payment rejected' });
        }}
      />
    </div>
  );
}
