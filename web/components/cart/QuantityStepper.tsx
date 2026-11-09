'use client';

import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEP_BUTTON =
  'flex size-11 flex-none items-center justify-center rounded-pill bg-transparent ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export interface QuantityStepperProps {
  /** The product (and size) the stepper changes: it ends the accessible names "One less {label}" / "One more {label}". */
  label: string;
  value: number;
  /** A **display limit the server gave** (`maxQuantityPerLine`, or the quantity left in stock). */
  max: number;
  /** Why `+` is disabled at `max`, e.g. "You can't add more — only 2 are in stock." */
  maxReason: string;
  /** The lowest quantity the buttons reach. 1 by default; a product card passes 0 so that "−" at 1 removes the line. */
  min?: number;
  disabled?: boolean;
  /** `leaf` is the filled banana-leaf pill (product cards); `outline` is the bordered one (basket, buy box). */
  tone?: 'leaf' | 'outline';
  /** `input` (default) shows an editable number; `text` shows the number as read-only text (product cards). */
  display?: 'input' | 'text';
  onChange: (quantity: number) => void;
}

/**
 * `components/cart/QuantityStepper.tsx` — HO-ORD-002 §8.5/§11.1, restyled for HO-P3 (§8.3). Real `−` / `+`
 * buttons (44 px) with names that include the product, and the quantity between them. `max` is a display
 * limit the server gave: reaching it disables `+` and says why in text, and the server remains the authority
 * (it answers `QuantityOutOfRange` for anything else).
 */
export function QuantityStepper({
  label,
  value,
  max,
  maxReason,
  min = 1,
  disabled,
  tone = 'outline',
  display = 'input',
  onChange,
}: QuantityStepperProps) {
  const hintId = useId();
  const atMax = value >= max;
  const filled = tone === 'leaf';
  const numberClass = filled ? 'text-leaf-soft' : 'text-ink';
  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          'inline-flex w-fit items-center rounded-pill border-[1.5px]',
          filled
            ? 'border-leaf bg-leaf text-leaf-soft'
            : 'border-border-strong bg-surface text-ink',
        )}
      >
        <button
          type="button"
          aria-label={`One less ${label}`}
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
          className={STEP_BUTTON}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        {display === 'text' ? (
          <span
            data-testid="stepper-value"
            className={cn('min-w-7 text-center text-[15px] font-bold tabular-nums', numberClass)}
          >
            {value}
          </span>
        ) : (
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={value}
            disabled={disabled}
            aria-label={`Quantity of ${label}`}
            aria-describedby={atMax ? hintId : undefined}
            onChange={(event) => {
              const next = event.target.valueAsNumber;
              if (Number.isInteger(next) && next >= min) onChange(Math.min(next, max));
            }}
            className={cn(
              'h-10 w-9 appearance-none border-0 bg-transparent text-center text-[15px] font-bold tabular-nums [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
              numberClass,
            )}
          />
        )}
        <button
          type="button"
          aria-label={`One more ${label}`}
          disabled={disabled || atMax}
          aria-describedby={atMax ? hintId : undefined}
          onClick={() => onChange(value + 1)}
          className={STEP_BUTTON}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      {atMax && (
        <p id={hintId} className="text-xs text-ink-muted">
          {maxReason}
        </p>
      )}
    </div>
  );
}
