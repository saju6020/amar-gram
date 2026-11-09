import { formatInZone } from '../format/time';

/**
 * `lib/subscriptions/dates.ts` — HO-P6 S0, ADR-FE-112. Subscription dates are `yyyy-MM-dd` strings and are
 * never handed to `new Date(...)` as text (that parse is off by one day west of UTC). A date is split into
 * its parts and laid out through a UTC calendar date, the technique of `formatDateOnly`
 * (`lib/format/time.ts`); the zone is `UTC` only for layout, nothing is converted. Instants carry a zone
 * (`commerceTimeZoneId`) and go through `formatInZone`, the zone named (ADR-FE-014).
 *
 * No function here adds days to a date or compares a date with today (ADR-FE-110).
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The calendar fields of a `yyyy-MM-dd` string, or `null` when it is not one. */
function dateParts(dateText: string): { year: number; month: number; day: number } | null {
  const match = DATE_ONLY.exec(dateText);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // 2026-02-31 would roll over to 3 March: only a real calendar day is laid out.
  if (new Date(Date.UTC(year, month - 1, day)).getUTCDate() !== day) return null;
  return { year, month, day };
}

/** True when the text is a real `yyyy-MM-dd` calendar day (2026-02-31 is not). */
export function isCalendarDate(dateText: string): boolean {
  return dateParts(dateText) !== null;
}

function layout(
  dateText: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatPart[] | null {
  const parts = dateParts(dateText);
  if (!parts) return null;
  const calendarDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).formatToParts(
    calendarDate,
  );
}

function pick(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

/** `"2026-10-20"` → `"Tue 20 Oct"`, the server's own `ddd d MMM` (SubscriptionMessages.cs:26). */
export function formatCycleDate(dateText: string | null | undefined): string {
  if (!dateText) return '—';
  const parts = layout(dateText, { weekday: 'short', day: 'numeric', month: 'short' });
  if (!parts) return dateText;
  return `${pick(parts, 'weekday')} ${pick(parts, 'day')} ${pick(parts, 'month')}`;
}

/** `"2026-10-20"` → `"Tuesday 20 October 2026"`. */
export function formatCycleDateLong(dateText: string | null | undefined): string {
  if (!dateText) return '—';
  const parts = layout(dateText, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  if (!parts) return dateText;
  return `${pick(parts, 'weekday')} ${pick(parts, 'day')} ${pick(parts, 'month')} ${pick(parts, 'year')}`;
}

/**
 * An instant in the commerce zone with the zone named: `"Sun 18 Oct, 00:00 (Asia/Dhaka)"`. Used for
 * `changeCutoffOn`, `paymentExpiresOn`, `cancelledOn`, `suspendedOn` and `reinstatedOn`.
 */
export function formatCommerceInstant(
  instant: string | null | undefined,
  commerceTimeZoneId: string,
): string {
  if (!instant) return '—';
  return formatInZone(instant, commerceTimeZoneId, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

/** An instant with its date and year, e.g. `"18 Oct 2026, 00:00 (Asia/Dhaka)"`, for records (suspended, restarted, cancelled). */
export function formatCommerceInstantLong(
  instant: string | null | undefined,
  commerceTimeZoneId: string,
): string {
  if (!instant) return '—';
  return formatInZone(instant, commerceTimeZoneId);
}

/** `"10.00"` → `"10"`, `"12.50"` → `"12.5"`, `"0.00"` → `"0"`. String handling only, no arithmetic (ADR-FE-113). */
export function formatPercentText(percentText: string): string {
  const text = percentText.trim();
  if (!text.includes('.')) return text;
  return text.replace(/0+$/, '').replace(/\.$/, '');
}

/** `true` for `"0"`, `"0.00"`, `"00.0"`: no subscriber discount. String pattern only. */
export function isZeroPercent(percentText: string): boolean {
  return /^0+(\.0+)?$/.test(percentText.trim());
}
