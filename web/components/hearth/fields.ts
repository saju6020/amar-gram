/**
 * Customer (Hearth) form-control classes. Pill-shaped text inputs and selects at least 44px high with
 * the design's 1.5px border; a textarea takes the card radius. Staff screens do not use these.
 */
export const pillInputClass =
  'min-h-11 w-full rounded-pill border-[1.5px] border-border-strong bg-surface px-4 text-[15px] text-ink placeholder:text-ink-faint disabled:bg-surface-sunken disabled:text-ink-muted';

export const pillSelectClass = pillInputClass;

export const pillTextareaClass =
  'min-h-24 w-full rounded-3xl border-[1.5px] border-border-strong bg-surface px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint disabled:bg-surface-sunken disabled:text-ink-muted';
