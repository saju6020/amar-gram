'use client';

import { useId } from 'react';
import { Banknote, Landmark, Store, TriangleAlert } from 'lucide-react';
import { bannerWarnClass } from '@/components/hearth/card';
import { pillInputClass } from '@/components/hearth/fields';
import { OptionCard } from '@/components/hearth/OptionCard';
import type { FulfilmentChoice, PaymentMethodChoice, PaymentOption } from '@/lib/api/checkout';
import { paymentMethodExplanation, paymentMethodLabel } from '@/lib/format/orders';
import { cn } from '@/lib/utils';
import { CheckoutSection } from './CheckoutSection';

function MethodIcon({ method }: { method: PaymentMethodChoice }) {
  if (method === 'BankTransfer') return <Landmark size={20} aria-hidden="true" />;
  if (method === 'PayOnCollection') return <Store size={22} aria-hidden="true" />;
  return <Banknote size={20} aria-hidden="true" />;
}

/** The longest note the server accepts (`Shared/Constants/OrderRules.cs:16`). */
export const RIDER_NOTE_MAX_LENGTH = 300;

/**
 * `components/checkout/PaymentSection.tsx` — section 3 of the single-page checkout (HO-P3 S3, ADR-FE-175;
 * HO-ORD-002 US-ORD-07). **There is no payment step in the card sense** (ADR-FE-092): this is a choice of
 * *how you will pay a person later* — *Cash on delivery*, *Bank transfer*, *Pay when you collect*. Options
 * come from the quote; an unavailable one is shown **disabled with the server's reason**. When bank
 * transfer is chosen, the option's own server `message` is shown as a notice. No card option, no online
 * payment control exists anywhere. For a Delivery order the section ends with the optional "Note for the
 * rider" (HO-P5 G4, ADR-FE-186): a labelled text input with a live count, held in the screen's state only.
 */
export function PaymentSection({
  options,
  selected,
  onSelect,
  loading,
  error,
  fulfilment,
  riderNote,
  onRiderNote,
  riderNoteError,
}: {
  options: PaymentOption[];
  selected: PaymentMethodChoice | undefined;
  onSelect: (method: PaymentMethodChoice) => void;
  loading: boolean;
  error?: string | null;
  /** The note field is for Delivery only; the server drops a note on a Pickup order. */
  fulfilment?: FulfilmentChoice;
  riderNote?: string;
  onRiderNote?: (value: string) => void;
  /** The server's refusal of the note, shown under the field. */
  riderNoteError?: string | null;
}) {
  const noteId = useId();
  const noteHintId = `${noteId}-hint`;
  const noteErrorId = `${noteId}-error`;
  const showNote = fulfilment === 'Delivery' && !!onRiderNote;
  const transferNotice = options.find(
    (option) => option.method === 'BankTransfer' && option.available && selected === 'BankTransfer',
  )?.message;
  return (
    <CheckoutSection id="co-pay" step={3} title="Payment">
      <p className="m-0 text-sm text-ink-muted">
        You pay a person later: the courier, our bank, or the counter. Nothing is charged on this
        website.
      </p>
      {options.length === 0 && loading && (
        <p role="status" className="m-0 text-sm text-ink-muted">
          Checking payment options…
        </p>
      )}
      <div role="radiogroup" aria-label="How will you pay?" className="flex flex-col gap-3">
        {options.map((option) => {
          const whyId = `pay-${option.method}-why`;
          return (
            <OptionCard
              key={option.method}
              name="payment-method"
              checked={selected === option.method}
              disabled={!option.available}
              onChange={() => onSelect(option.method)}
              icon={<MethodIcon method={option.method} />}
              title={paymentMethodLabel(option.method)}
              whyId={whyId}
              why={
                option.available ? undefined : (
                  <>
                    <TriangleAlert size={15} aria-hidden="true" className="mt-0.5 flex-none" />
                    {option.message ?? 'This payment method is not available for this order.'}
                  </>
                )
              }
            >
              {paymentMethodExplanation(option.method)}
            </OptionCard>
          );
        })}
      </div>
      {transferNotice && (
        <p role="status" className={cn(bannerWarnClass, 'm-0')}>
          {transferNotice}
        </p>
      )}
      {showNote && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={noteId} className="text-sm font-semibold text-ink">
            Note for the rider (optional)
          </label>
          <input
            id={noteId}
            type="text"
            name="rider-note"
            autoComplete="off"
            maxLength={RIDER_NOTE_MAX_LENGTH}
            value={riderNote ?? ''}
            placeholder="e.g. call before you come up"
            aria-invalid={riderNoteError ? true : undefined}
            aria-describedby={riderNoteError ? `${noteHintId} ${noteErrorId}` : noteHintId}
            onChange={(event) => onRiderNote(event.target.value)}
            className={pillInputClass}
          />
          <p id={noteHintId} className="m-0 text-xs text-ink-muted">
            {(riderNote ?? '').length} of {RIDER_NOTE_MAX_LENGTH}
          </p>
          {riderNoteError && (
            <p id={noteErrorId} role="alert" className="m-0 text-sm font-semibold text-danger-ink">
              {riderNoteError}
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="m-0 text-sm font-semibold text-danger-ink">
          {error}
        </p>
      )}
    </CheckoutSection>
  );
}
