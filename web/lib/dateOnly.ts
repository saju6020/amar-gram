import { format } from 'date-fns';

/**
 * Helpers for the first API handover's `DateOnly` fields (`yyyy-MM-dd` strings — `expiresOn`,
 * `receivedOn`, `startsOn`, ...). the scaffold handover §9: never parse one with
 * `new Date(isoString)`, which applies the browser's timezone and can shift the calendar day in
 * a negative-UTC-offset browser. Always go through `parseDateOnly` instead, which builds the
 * `Date` from local year/month/day components with no timezone conversion involved.
 *
 * Shared by every component that renders or diffs a date-only value, and every form's zod schema.
 */
export function parseDateOnly(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year!, (month ?? 1) - 1, day ?? 1);
}

/** `dd MMM yyyy` — the scaffold handover §9's date convention. */
export function formatDateOnly(dateOnly: string | null | undefined, fallback = 'Unknown'): string {
  if (!dateOnly) return fallback;
  return format(parseDateOnly(dateOnly), 'dd MMM yyyy');
}

/** Today as a `DateOnly` string — the shape every "administered on" / "recorded on" default uses. */
export function todayAsDateOnly(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
