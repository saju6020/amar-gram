'use client';

import type { KeyboardEvent, Ref } from 'react';
import { Barcode, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * HO-P4 §11.1 — a search box with a visually hidden label and a leading icon. `emphasis="scan"`
 * (counter sale, goods receiving) is the 2px `border-leaf` barcode field.
 *
 * `onChange` receives the new string value. `inputRef` and `onKeyDown` are additive to the §11.1
 * contract, for screens that focus the field on a shortcut or act on Enter (the scan field).
 */
export function SearchField({
  id,
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  emphasis,
  inputRef,
  onKeyDown,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  emphasis?: 'scan';
  inputRef?: Ref<HTMLInputElement>;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const scan = emphasis === 'scan';
  const Icon = scan ? Barcode : Search;
  return (
    <div className="relative w-full">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon
        size={18}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      <input
        id={id}
        ref={inputRef}
        type={scan ? 'text' : 'search'}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={cn(
          'min-h-11 w-full rounded-[var(--radius-md)] bg-surface pl-10 pr-3 text-sm text-ink placeholder:text-ink-muted',
          scan ? 'border-2 border-leaf' : 'border border-border-strong',
        )}
      />
    </div>
  );
}
