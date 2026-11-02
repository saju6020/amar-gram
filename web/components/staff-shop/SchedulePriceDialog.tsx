'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialogReturnFocus,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ApiValidationError } from '@/lib/api/client';
import { describeApiError } from '@/lib/api/errors';
import { formatDateOnly, nowAsDateTimeLocal } from '@/lib/format/time';
import { MONEY_FORMAT_MESSAGE, MONEY_PATTERN } from '@/lib/money/moneyString';
import { CATALOGUE_CODE_MESSAGES } from './submitProductSection';

const inputClass =
  'rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm text-ink aria-[invalid=true]:border-danger-ink';

export interface SchedulePriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Amount (BDT)" -- the currency comes from the prices the API already shows for this pack size. */
  currencyCode: string;
  /** Amounts are strings end to end; the caller sends them through `wireMoney` (ADR-317). */
  onSchedule: (amount: string, effectiveFromIso: string, compareAt?: string) => Promise<unknown>;
}

/**
 * HO-P5 BG-13 `SchedulePriceDialog` -- HO-P4 §11.4.7. "Schedule a new price" with the optional **Was price**
 * (the compare-at amount). It stands beside `components/admin/ScheduleChangeDialog.tsx`, which is shared with the
 * tax-rate screens and outside S3's block (§14), so it cannot take the extra field. Same behaviour: the amount is a
 * string and is never parsed here, a past date cannot be chosen, and the server's refusal is shown in plain
 * language. The server decides whether the Was price exceeds the price (`CompareAtMustExceedPrice`, shown under
 * its field); nothing is compared in the browser.
 */
export function SchedulePriceDialog({
  open,
  onOpenChange,
  currencyCode,
  onSchedule,
}: SchedulePriceDialogProps) {
  const [amount, setAmount] = React.useState('');
  const [compareAt, setCompareAt] = React.useState('');
  const [whenChoice, setWhenChoice] = React.useState<'now' | 'future'>('now');
  const [futureLocal, setFutureLocal] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [compareAtError, setCompareAtError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const returnFocusRef = useDialogReturnFocus(open);
  const minFuture = nowAsDateTimeLocal();

  const effectiveFromIso =
    whenChoice === 'now'
      ? new Date().toISOString()
      : futureLocal
        ? new Date(futureLocal).toISOString()
        : null;
  const effectiveDateLabel = effectiveFromIso ? formatDateOnly(effectiveFromIso.slice(0, 10)) : '…';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setCompareAtError(null);
    if (!amount.trim() || !effectiveFromIso) {
      setError('Enter a price and an effective date.');
      return;
    }
    if (!MONEY_PATTERN.test(amount.trim())) {
      setError(MONEY_FORMAT_MESSAGE);
      return;
    }
    if (compareAt.trim() && !MONEY_PATTERN.test(compareAt.trim())) {
      setCompareAtError(MONEY_FORMAT_MESSAGE);
      return;
    }
    // ADM backlog 16: the native `min` is only a hint; re-check here (compared at minute resolution).
    if (whenChoice === 'future' && futureLocal < nowAsDateTimeLocal()) {
      setError('Choose an effective date and time that is not in the past.');
      return;
    }
    setIsPending(true);
    try {
      await onSchedule(amount.trim(), effectiveFromIso, compareAt.trim() || undefined);
      setAmount('');
      setCompareAt('');
      setWhenChoice('now');
      setFutureLocal('');
      onOpenChange(false);
    } catch (err) {
      if (
        err instanceof ApiValidationError &&
        err.response.errors.some((x) => x.propertyName === 'CompareAtAmount')
      ) {
        setCompareAtError(
          describeApiError(
            new ApiValidationError({
              ...err.response,
              errors: err.response.errors.filter((x) => x.propertyName === 'CompareAtAmount'),
            }),
            CATALOGUE_CODE_MESSAGES,
          ),
        );
        const others = err.response.errors.filter((x) => x.propertyName !== 'CompareAtAmount');
        if (others.length > 0)
          setError(
            describeApiError(
              new ApiValidationError({ ...err.response, errors: others }),
              CATALOGUE_CODE_MESSAGES,
            ),
          );
      } else {
        setError(describeApiError(err, CATALOGUE_CODE_MESSAGES));
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent hideClose returnFocusRef={returnFocusRef}>
        <DialogHeader>
          <DialogTitle>Schedule a new price</DialogTitle>
          <DialogDescription>
            {`The new price shows on the storefront from ${effectiveDateLabel}. Orders placed before then keep their price.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && (
            <p role="alert" aria-live="polite" className="text-sm font-semibold text-danger-ink">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="schedule-value" className="text-sm font-semibold text-ink">
              {`Amount (${currencyCode})`}
            </label>
            <input
              id="schedule-value"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="schedule-was" className="text-sm font-semibold text-ink">
              Was price (optional)
            </label>
            <input
              id="schedule-was"
              inputMode="decimal"
              value={compareAt}
              onChange={(event) => setCompareAt(event.target.value)}
              aria-invalid={compareAtError ? true : undefined}
              aria-describedby="schedule-was-hint"
              className={inputClass}
            />
            <p id="schedule-was-hint" className="m-0 text-xs text-ink-muted">
              The higher price this one replaces, shown struck through where the shop uses it. It must be more
              than the amount.
            </p>
            {compareAtError && (
              <p role="alert" className="m-0 text-xs font-semibold text-danger-ink">
                {compareAtError}
              </p>
            )}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold text-ink">Effective from</legend>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="schedule-when"
                checked={whenChoice === 'now'}
                onChange={() => setWhenChoice('now')}
              />
              Now
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="schedule-when"
                checked={whenChoice === 'future'}
                onChange={() => setWhenChoice('future')}
              />
              A future date and time
            </label>
            {whenChoice === 'future' && (
              <input
                type="datetime-local"
                aria-label="Effective date and time"
                min={minFuture}
                value={futureLocal}
                onChange={(event) => setFutureLocal(event.target.value)}
                className={`w-fit ${inputClass}`}
              />
            )}
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} aria-busy={isPending}>
              {isPending ? 'Scheduling…' : 'Schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
