import { pillInputClass } from '@/components/hearth/fields';
import { FieldError } from './FieldError';

/**
 * A native date field with a visible label, the allowed range in words, and its error (UI-6). The range is the server's
 * (`min` / `max` from C1); nothing here compares a date with today (ADR-FE-110).
 */
export function FirstDeliveryField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  help,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  help: string;
  error?: string;
}) {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${helpId} ${errorId}` : helpId}
        className={`${pillInputClass} sm:max-w-[260px]`}
      />
      <p id={helpId} className="m-0 text-[13px] text-ink-muted">
        {help}
      </p>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}
