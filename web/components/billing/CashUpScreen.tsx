'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AccessRefusedState } from '@/components/admin/AccessRefusedState';
import { PermissionDeniedState } from '@/components/admin/PermissionDeniedState';
import { CashUpSourceCountForm, CashUpSourcesReadout, SourceVariancePill } from '@/components/back-office-admin/CashUpSources';
import { UnsavedChangesGuard } from '@/components/account/UnsavedChangesGuard';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Panel } from '@/components/back-office/Panel';
import { TableFrame } from '@/components/back-office/TableFrame';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { CashUp } from '@/lib/api/billing-cashup';
import { ApiForbiddenError } from '@/lib/api/client';
import { describeBillingError, submitBillingForm } from '@/lib/api/errors';
import { formatDateOnly, formatInZone, todayInZone } from '@/lib/format/time';
import { MONEY_FORMAT_MESSAGE, MONEY_PATTERN, a11yMoney, moneySign, normaliseMoney, withoutSign } from '@/lib/money';
import { useActiveBranchZone } from '@/lib/hooks/billing/useActiveBranchZone';
import { useActiveBranchId } from '@/lib/hooks/useActiveBranch';
import { useAdminBranches } from '@/lib/hooks/useAdminBranches';
import { useCashUp } from '@/lib/hooks/billing/useBillingQueries';
import { useCloseCashUp, useRecordCashCount } from '@/lib/hooks/billing/useBillingMutations';
import { useUrlFilterState } from '@/lib/hooks/useUrlFilterState';
import { Amount } from './Amount';
import { FormRootError, MoneyField, TextAreaField, TextField } from './Fields';
import { humanise } from './labels';
import { PageHeader, Stat } from './PageHeader';
import { QueryBoundary } from './QueryBoundary';
import { guardedText } from './schemas';

/**
 * `components/billing/CashUpScreen.tsx` — HO-BIL-002 §11.6 (US-BIL-12, US-BIL-06 AC3), ⭐. The day's till
 * for a date (default today in the branch's zone, never in the future). **Expected** — cash, card,
 * transfer, cash refunds, reversals and carried-in items — is the server's, each line listed. Enter the
 * **counted cash**; the **variance** comes back from the server and reads *Short BDT 10.00* /
 * *Over …* / *Balanced*. A non-zero variance makes the **explanation** required (the server refuses
 * a close without it). Pending approvals show a banner. **Close day** is a UI-3 confirm and cannot
 * be undone; a closed day is read-only with who and when.
 *
 * HO-P5 §11.5.5 (BG-20): when the server lists `sources` (the till, and each staff member who collected cash on
 * delivery) the count is one input per source and the over or short is the server's, per source and in total
 * (`CashUpSources.tsx`). With none, the single total input of HO-P4 stays.
 */
const schema = z.object({
  countedCash: z.string().trim().min(1, 'Enter the cash you counted.').regex(MONEY_PATTERN, MONEY_FORMAT_MESSAGE),
  explanation: guardedText(500),
});
type Values = z.infer<typeof schema>;

/** The day's variance as the server states it; the same pill each source row uses (`CashUpSources.tsx`). */
function VarianceText({ view }: { view: CashUp }) {
  return <SourceVariancePill variance={view.variance} />;
}

function CashUpBody({ view, date, zone, branchName }: { view: CashUp; date: string; zone: string; branchName: string | undefined }) {
  const { toast } = useToast();
  const count = useRecordCashCount(date);
  const close = useCloseCashUp(date);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeError, setCloseError] = useState<unknown>(null);
  const closed = view.status === 'Closed';
  const nonZero = !!view.variance && moneySign(view.variance.amount) !== 'zero';

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { countedCash: view.counted?.amount ?? '', explanation: view.explanation ?? '' },
  });

  useEffect(() => {
    reset({ countedCash: view.counted?.amount ?? '', explanation: view.explanation ?? '' });
  }, [view.version, view.counted?.amount, view.explanation, reset]);

  const save = handleSubmit(async (values) => {
    const ok = await submitBillingForm(
      async () => {
        await count.mutateAsync({ countedCash: normaliseMoney(values.countedCash), explanation: values.explanation.trim() || undefined });
        return true as const;
      },
      setError,
      { knownFields: ['countedCash', 'explanation'] },
    );
    if (ok) toast({ title: 'Count saved' });
  });

  async function closeDay() {
    setCloseError(null);
    try {
      await close.mutateAsync(view.version);
      toast({ title: 'Day closed', description: 'It can no longer be changed.' });
    } catch (failure) {
      setCloseError(failure);
    }
    setCloseOpen(false);
  }

  const lines = view.lines;
  const sources = view.sources ?? [];
  const perSource = sources.length > 0;
  return (
    <div className="flex flex-col gap-5">
      <UnsavedChangesGuard when={isDirty && !closed} />
      {closed && (
        <p role="status" className="rounded-[var(--radius-sm)] border border-border bg-surface-sunken p-3 text-sm text-ink">
          This day is closed and read-only. Closed by <strong>{view.closedByName ?? 'a colleague'}</strong>
          {view.closedOn ? ` on ${formatInZone(view.closedOn, zone)}` : ''}.
        </p>
      )}
      {!closed && view.pendingApprovals > 0 && (
        <p role="alert" className="rounded-[var(--radius-sm)] border border-border bg-warning-bg p-3 text-sm font-semibold text-warning-ink">
          {view.pendingApprovals === 1 ? '1 payment' : `${view.pendingApprovals} payments`} recorded for this day{' '}
          {view.pendingApprovals === 1 ? 'is' : 'are'} still waiting for approval.{' '}
          <Link href="/staff/billing/approvals" className="underline">Open the approvals queue</Link>. The day cannot be closed until they are decided.
        </p>
      )}

      <Panel title={`End-of-day cash-up${branchName ? ` · ${branchName}` : ''} · ${formatDateOnly(date)}`}>
       <div className="flex flex-col gap-6">
       <section aria-labelledby="cashup-expected" className="flex flex-col gap-3">
        <h3 id="cashup-expected" className="text-base font-semibold text-ink">Expected</h3>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label={`Cash payments (${view.expected.cashCount})`}><Amount money={view.expected.cash} /></Stat>
          <Stat label={`Card payments (${view.expected.cardCount})`}><Amount money={view.expected.card} /></Stat>
          <Stat label={`Bank transfers (${view.expected.transferCount})`}><Amount money={view.expected.transfer} /></Stat>
          <Stat label="Cash refunds"><Amount money={view.expected.cashRefunds} /></Stat>
          <Stat label="Cash reversals"><Amount money={view.expected.cashReversals} /></Stat>
          <Stat label="Carried in"><Amount money={view.expected.carriedInTotal} /></Stat>
        </dl>
        <p className="text-base font-semibold text-ink">
          Expected cash in the till: <Amount money={view.expected.expectedCash} />
        </p>
        {view.expected.carriedIn.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-ink">Carried in from earlier</h3>
            <ul className="mt-1 flex flex-col gap-1 text-sm">
              {view.expected.carriedIn.map((c) => (
                <li key={c.id}>{c.label ?? humanise(c.kind)} — <Amount money={c.amount} /></li>
              ))}
            </ul>
          </div>
        )}
        <TableFrame label="Cash-up lines by source" minWidth={520}>
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              The {lines.length === 1 ? '1 line' : `${lines.length} lines`} behind these totals
            </caption>
            <thead>
              <tr className="text-left text-[13px] text-ink-muted">
                <th scope="col" className="px-3 py-2.5 font-semibold">Source</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Collected by</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-t border-surface-sunken">
                  <th scope="row" className="px-3 py-2.5 text-left font-normal text-ink [overflow-wrap:anywhere]">
                    {humanise(l.kind)}
                    {l.method ? ` · ${humanise(l.method)}` : ''}
                    {l.label ? ` · ${l.label}` : ''}
                    {l.carriedIn ? ' · carried in' : ''}
                    {l.countsInCash ? '' : ' · not cash'}
                  </th>
                  <td className="px-3 py-2.5 text-ink-muted">{l.collector ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums"><Amount money={l.amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableFrame>
       </section>

       <section aria-labelledby="cashup-count" className="flex flex-col gap-3">
        <h3 id="cashup-count" className="text-base font-semibold text-ink">Count</h3>
        {closed ? (
          <>
            {perSource && <CashUpSourcesReadout sources={sources} />}
            <dl className="grid gap-3 sm:grid-cols-3">
              <Stat label="Counted cash">{view.counted ? <Amount money={view.counted} /> : '—'}</Stat>
              <Stat label="Variance"><VarianceText view={view} /></Stat>
              <Stat label="Explanation">{view.explanation ?? '—'}</Stat>
            </dl>
          </>
        ) : perSource ? (
          <CashUpSourceCountForm
            view={view}
            date={date}
            sources={sources}
            nonZero={nonZero}
            onClose={() => setCloseOpen(true)}
            toastSaved={() => toast({ title: 'Count saved' })}
          />
        ) : (
          <form onSubmit={save} noValidate className="flex max-w-xl flex-col gap-4">
            <FormRootError message={errors.root?.message} />
            <MoneyField id="cashup-counted" label="Counted cash" required error={errors.countedCash?.message} {...register('countedCash')} />
            {view.variance && (
              <p aria-live="polite" role="status" className="flex items-center gap-2 text-sm">
                Variance: <VarianceText view={view} />
              </p>
            )}
            <TextAreaField
              id="cashup-explanation"
              label="Explanation"
              required={nonZero}
              hint={nonZero ? 'Required because the count differs from the expected cash.' : 'Needed only if the count differs from the expected cash.'}
              error={errors.explanation?.message}
              {...register('explanation')}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="secondary" disabled={isSubmitting} aria-busy={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save count'}
              </Button>
              <Button disabled={!view.counted || isDirty || isSubmitting} onClick={() => setCloseOpen(true)}>
                Close day
              </Button>
            </div>
            {isDirty && view.counted && <p className="text-xs text-ink-muted">Save your changes before closing the day.</p>}
          </form>
        )}
        {closeError instanceof ApiForbiddenError ? (
          <PermissionDeniedState />
        ) : closeError ? (
          <p role="alert" className="text-sm font-semibold text-danger-ink">{describeBillingError(closeError)}</p>
        ) : null}
       </section>
       </div>
      </Panel>

      <ConfirmDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title="Close the day"
        variant="destructive"
        consequence={`Close ${formatDateOnly(date)}? Expected ${a11yMoney(view.expected.expectedCash)}, counted ${view.counted ? a11yMoney(view.counted) : 'nothing'}${view.variance && nonZero ? `, ${moneySign(view.variance.amount) === 'negative' ? 'short' : 'over'} ${a11yMoney(withoutSign(view.variance))}` : ''}. A closed day cannot be reopened or changed.`}
        confirmLabel="Close day"
        pendingLabel="Closing…"
        onConfirm={closeDay}
      />
    </div>
  );
}

export function CashUpScreen() {
  const { zone, ready } = useActiveBranchZone();
  const { values, setValue } = useUrlFilterState(['date'] as const);
  const today = todayInZone(zone);
  const date = values.date || (ready ? today : '');
  const query = useCashUp(date);
  const branches = useAdminBranches();
  const activeBranchId = useActiveBranchId();
  const branchName = branches.data?.find((b) => b.id === activeBranchId)?.name;

  if (query.error instanceof ApiForbiddenError) return <AccessRefusedState error={query.error} />;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Daily cash-up" description="Count the till against what the system expects." />
      <form role="search" aria-label="Cash-up date" className="max-w-xs" onSubmit={(e) => e.preventDefault()}>
        <TextField id="cashup-date" label="Day" type="date" value={date} max={ready ? today : undefined} onChange={(e) => setValue('date', e.target.value)} />
      </form>
      {date === '' ? null : (
        <QueryBoundary query={query} loadingLabel="Loading the cash-up…">
          {(view) => <CashUpBody key={view.businessDate} view={view} date={date} zone={zone} branchName={branchName} />}
        </QueryBoundary>
      )}
    </div>
  );
}
