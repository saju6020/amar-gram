'use client';

import { useState, type ReactNode } from 'react';
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
import { nowAsDateTimeLocal, formatDateOnly } from '@/lib/format/time';

/**
 * `components/admin/ScheduleChangeDialog.tsx` — HO-ADM-002 §11.3, ADR-FE-019. Built on
 * `components/ui/dialog.tsx` (never a hand-rolled overlay). Amount/rate kept as a **string**
 * throughout — never parsed through `Number` except by the browser's own numeric input for entry.
 * A past date/time cannot be selected (`min` on the input).
 */
export interface ScheduleChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string; // "Schedule a new price" / "Schedule a new tax rate"
  valueLabel: string; // "Amount (BDT)" / "Rate (%)"
  onSchedule: (value: string, effectiveFromIso: string, extraValue?: string) => Promise<unknown>;
  /**
   * HO-P5 S3 (Amended (ak)): an OPTIONAL second field, drawn under the value (the shop's "Was price"). Without it the
   * dialog is exactly as before and `onSchedule` is called with two arguments. With it, the typed text is the third.
   */
  extraField?: {
    /** Draws the input; the dialog owns the text and the error. */
    render: (state: {
      value: string;
      onChange: (next: string) => void;
      error: string | null;
    }) => ReactNode;
    /** A client-side check of the typed text (only when it is not blank); return the message to refuse it. */
    validate?: (value: string) => string | null;
    /** A server validation error on this property is shown under the extra field instead of at the top. */
    errorProperty?: string;
  };
  /**
   * The sentence under the title saying what scheduling changes, given the effective date as text.
   * Defaults to the generic wording (orders and invoices); the shop passes its own (S16).
   */
  consequence?: (effectiveDateLabel: string) => string;
  /** An area's own fallback sentences by error code; none by default. */
  codeMessages?: Readonly<Record<string, string>>;
}

export function ScheduleChangeDialog({
  open,
  onOpenChange,
  title,
  valueLabel,
  onSchedule,
  consequence = (date) => `Orders and invoices made before ${date} keep their price.`,
  codeMessages,
  extraField,
}: ScheduleChangeDialogProps) {
  const [extraValue, setExtraValue] = useState('');
  const [extraError, setExtraError] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [whenChoice, setWhenChoice] = useState<'now' | 'future'>('now');
  const [futureLocal, setFutureLocal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
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
    setExtraError(null);
    if (!value.trim() || !effectiveFromIso) {
      setError('Enter a value and an effective date.');
      return;
    }
    // ADM backlog 16: the native `min` is only a hint; re-check here (compared at minute resolution).
    if (whenChoice === 'future' && futureLocal < nowAsDateTimeLocal()) {
      setError('Choose an effective date and time that is not in the past.');
      return;
    }
    if (extraField?.validate && extraValue.trim()) {
      const refusal = extraField.validate(extraValue.trim());
      if (refusal) {
        setExtraError(refusal);
        return;
      }
    }
    setIsPending(true);
    try {
      if (extraField) await onSchedule(value.trim(), effectiveFromIso, extraValue.trim() || undefined);
      else await onSchedule(value.trim(), effectiveFromIso);
      setValue('');
      setExtraValue('');
      setWhenChoice('now');
      setFutureLocal('');
      onOpenChange(false);
    } catch (err) {
      const property = extraField?.errorProperty;
      if (property && err instanceof ApiValidationError && err.response.errors.some((x) => x.propertyName === property)) {
        const own = err.response.errors.filter((x) => x.propertyName === property);
        const rest = err.response.errors.filter((x) => x.propertyName !== property);
        setExtraError(describeApiError(new ApiValidationError({ ...err.response, errors: own }), codeMessages));
        if (rest.length > 0)
          setError(describeApiError(new ApiValidationError({ ...err.response, errors: rest }), codeMessages));
      } else {
        setError(describeApiError(err, codeMessages));
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent hideClose returnFocusRef={returnFocusRef}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{consequence(effectiveDateLabel)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p role="alert" aria-live="polite" className="text-sm font-semibold text-danger-ink">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="schedule-value" className="text-sm font-semibold text-ink">
              {valueLabel}
            </label>
            <input
              id="schedule-value"
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>

          {extraField?.render({ value: extraValue, onChange: setExtraValue, error: extraError })}

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
                className="w-fit rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 py-2 text-sm text-ink"
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
