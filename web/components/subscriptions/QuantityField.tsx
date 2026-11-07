'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { pillInputClass } from '@/components/hearth/fields';
import { cn } from '@/lib/utils';
import { FieldError } from './FieldError';

const STEP_BUTTON =
  'grid size-11 flex-none place-items-center rounded-pill border-[1.5px] border-border-strong bg-surface text-ink hover:bg-surface-sunken disabled:cursor-not-allowed disabled:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/**
 * "Per delivery": a number input with − and + buttons, 1 to `max`, the range written out (HO-P6 §11.2.3). The typed text
 * is kept apart from the number so a half-typed value is not rewritten under the customer's fingers.
 */
export function QuantityField({
  id,
  value,
  max,
  onChange,
  error,
}: {
  id: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  error?: string;
}) {
  const [text, setText] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    // Changed from outside (a reset, a stepper press): show it.
    setLastValue(value);
    setText(String(value));
  }
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;

  function type(next: string) {
    setText(next);
    if (/^\d{1,3}$/.test(next)) {
      setLastValue(Number(next));
      onChange(Number(next));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">
        Quantity per delivery
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={STEP_BUTTON}
          aria-label="One less"
          disabled={value <= 1}
          onClick={() => onChange(value - 1)}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          step={1}
          value={text}
          onChange={(event) => type(event.target.value)}
          onBlur={() => setText(String(value))}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(helpId, error && errorId)}
          className={cn(pillInputClass, 'w-24 text-center')}
        />
        <button
          type="button"
          className={STEP_BUTTON}
          aria-label="One more"
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      <p id={helpId} className="m-0 text-[13px] text-ink-muted">{`Choose 1 to ${max}.`}</p>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}
