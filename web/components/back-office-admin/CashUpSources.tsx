'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UnsavedChangesGuard } from '@/components/account/UnsavedChangesGuard';
import { StatusPill } from '@/components/back-office/StatusPill';
import { TableFrame } from '@/components/back-office/TableFrame';
import { Amount } from '@/components/billing/Amount';
import { FormRootError, TextAreaField } from '@/components/billing/Fields';
import { guardedText } from '@/components/billing/schemas';
import { Button } from '@/components/ui/button';
import type { CashUp, CashUpSource } from '@/lib/api/billing-cashup';
import { billingViolationCodes, submitBillingForm } from '@/lib/api/errors';
import type { Money } from '@/lib/format/money';
import { useRecordCashCount } from '@/lib/hooks/billing/useBillingMutations';
import { MONEY_FORMAT_MESSAGE, MONEY_PATTERN, a11yMoney, moneySign, normaliseMoney, withoutSign } from '@/lib/money';

/**
 * `components/back-office-admin/CashUpSources.tsx` — HO-P5 §11.5.5 (BG-20), US-BIL-12. The cash-up count **per source**: the
 * till and each staff member who collected cash on delivery. Each source shows what it was expected to hold, one labelled input
 * for what was counted, and the server's own over or short for it. Nothing here adds or subtracts: the counted total, every
 * per-source variance and the day's variance are the server's strings, shown as sent (ADR-FE-080, ADR-317); a request carries
 * each typed amount as a string through `wireMoney`. The screen it lives in (`components/billing/CashUpScreen.tsx`) owns the
 * rest of the day: the expected lines, the explanation rules and closing.
 */

/** What `UnknownCashUpSource` and `DuplicateCashUpSource` mean to the person: their list of sources is out of date. */
export const SOURCES_CHANGED_MESSAGE = 'The sources changed while you were counting. Reload and count again.';
const SOURCE_CODES = ['UnknownCashUpSource', 'DuplicateCashUpSource'];

/** Balanced / Over / Short by the sign the server's string carries, words as well as colour (UI-6). */
export function SourceVariancePill({ variance }: { variance: Money | null }) {
  if (!variance) return <StatusPill tone="neutral">Not counted yet</StatusPill>;
  const sign = moneySign(variance.amount);
  if (sign === 'zero') return <StatusPill tone="success">Balanced</StatusPill>;
  return (
    <StatusPill tone={sign === 'negative' ? 'danger' : 'warning'}>
      {sign === 'negative' ? 'Short' : 'Over'} {a11yMoney(withoutSign(variance))}
    </StatusPill>
  );
}

const HEAD = 'px-3 py-2.5 font-semibold';

/** A closed day: the sources as they were frozen, with no inputs. */
export function CashUpSourcesReadout({ sources }: { sources: CashUpSource[] }) {
  return (
    <TableFrame label="Counted cash by source" minWidth={560}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Expected, counted and over or short for each source of cash</caption>
        <thead>
          <tr className="text-left text-[13px] text-ink-muted">
            <th scope="col" className={HEAD}>Source</th>
            <th scope="col" className={`${HEAD} text-right`}>Expected</th>
            <th scope="col" className={`${HEAD} text-right`}>Counted</th>
            <th scope="col" className={HEAD}>Over or short</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.key} className="border-t border-surface-sunken">
              <th scope="row" className="px-3 py-2.5 text-left font-normal text-ink [overflow-wrap:anywhere]">{source.label}</th>
              <td className="px-3 py-2.5 text-right tabular-nums"><Amount money={source.expected} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums">{source.counted ? <Amount money={source.counted} /> : '—'}</td>
              <td className="px-3 py-2.5"><SourceVariancePill variance={source.variance} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}

const schema = z.object({
  counts: z.array(z.string().trim().min(1, 'Enter the cash you counted.').regex(MONEY_PATTERN, MONEY_FORMAT_MESSAGE)),
  explanation: guardedText(500),
});
type Values = z.infer<typeof schema>;

const INPUT =
  'w-full min-w-[7rem] rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-right text-sm text-ink ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-[invalid=true]:border-danger-ink';

/** An open day: one input per source, the explanation, and Save count / Close day. */
export function CashUpSourceCountForm({
  view,
  date,
  sources,
  nonZero,
  onClose,
  toastSaved,
}: {
  view: CashUp;
  date: string;
  sources: CashUpSource[];
  /** True when the server says the day's variance is not zero (the explanation is then required). */
  nonZero: boolean;
  onClose: () => void;
  toastSaved: () => void;
}) {
  const count = useRecordCashCount(date);
  const initial = (): Values => ({
    counts: sources.map((source) => source.counted?.amount ?? ''),
    explanation: view.explanation ?? '',
  });
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<Values>({ resolver: zodResolver(schema), mode: 'onChange', defaultValues: initial() });

  // A new read from the server (after a save, or a reload) is the truth again.
  const sourcesKey = sources.map((s) => `${s.key}=${s.counted?.amount ?? ''}`).join('|');
  useEffect(() => {
    reset(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.version, view.explanation, sourcesKey, reset]);

  const save = handleSubmit(async (values) => {
    let failure: unknown = null;
    const ok = await submitBillingForm(
      async () => {
        try {
          await count.mutateAsync({
            counts: sources.map((source, index) => ({
              sourceKey: source.key,
              countedCash: normaliseMoney(values.counts[index] ?? ''),
            })),
            explanation: values.explanation.trim() || undefined,
          });
          return true as const;
        } catch (error) {
          failure = error;
          throw error;
        }
      },
      setError,
      { knownFields: ['explanation'] },
    );
    if (ok) toastSaved();
    else if (billingViolationCodes(failure).some((code) => SOURCE_CODES.includes(code))) {
      setError('root', { type: 'server', message: SOURCES_CHANGED_MESSAGE });
    }
  });

  const countedTotal = view.counted;
  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-4">
      <UnsavedChangesGuard when={isDirty} />
      <FormRootError message={errors.root?.message} />
      <TableFrame label="Count cash by source" minWidth={560}>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Enter what you counted for each source of cash</caption>
          <thead>
            <tr className="text-left text-[13px] text-ink-muted">
              <th scope="col" className={HEAD}>Source</th>
              <th scope="col" className={`${HEAD} text-right`}>Expected</th>
              <th scope="col" className={`${HEAD} text-right`}>Counted</th>
              <th scope="col" className={HEAD}>Over or short</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source, index) => {
              const error = errors.counts?.[index]?.message;
              const id = `cashup-source-${index}`;
              return (
                <tr key={source.key} className="border-t border-surface-sunken align-top">
                  <th scope="row" className="px-3 py-3 text-left font-normal text-ink [overflow-wrap:anywhere]">{source.label}</th>
                  <td className="px-3 py-3 text-right tabular-nums"><Amount money={source.expected} /></td>
                  <td className="px-3 py-2 text-right">
                    <label htmlFor={id} className="sr-only">Counted for {source.label}</label>
                    <input
                      id={id}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${id}-error` : undefined}
                      className={INPUT}
                      {...register(`counts.${index}` as const)}
                    />
                    {error && (
                      <p id={`${id}-error`} role="alert" className="mt-1 text-left text-xs font-semibold text-danger-ink">{error}</p>
                    )}
                  </td>
                  <td className="px-3 py-3"><SourceVariancePill variance={source.variance} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableFrame>

      {/* The totals are the server's: it sums the sources, and its variance is counted minus expected for the whole day. */}
      <p aria-live="polite" role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
        Counted in total: {countedTotal ? <Amount money={countedTotal} /> : '—'}
        {view.variance && (
          <>
            <span aria-hidden="true">·</span> Variance: <SourceVariancePill variance={view.variance} />
          </>
        )}
      </p>

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
        <Button type="button" disabled={!view.counted || isDirty || isSubmitting} onClick={onClose}>
          Close day
        </Button>
      </div>
      {isDirty && view.counted && <p className="text-xs text-ink-muted">Save your changes before closing the day.</p>}
    </form>
  );
}
