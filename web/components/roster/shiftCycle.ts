import { ApiValidationError } from '@/lib/api/client';
import { describeApiError } from '@/lib/api/errors';
import type { RosterShiftName, SettableRosterShift } from '@/lib/api/admin-rosters';

/**
 * `components/roster/shiftCycle.ts` — HO-P5 §11.5.8 (BG-23), ADR-FE-192. A roster cell cycles
 * Morning → Evening → Off → Morning with one `PUT` per click. A `Custom` day (hours that match neither preset, e.g. the weekly
 * pattern's own 09:00–17:00) is not part of the cycle: the person is asked first, and the click replaces its hours with
 * Morning. Pure, so the cycle is proved without a screen.
 */
export function nextRosterShift(current: RosterShiftName): SettableRosterShift {
  if (current === 'Morning') return 'Evening';
  if (current === 'Evening') return 'Off';
  // Off goes round to Morning; Custom is replaced by Morning once the person has agreed.
  return 'Morning';
}

/** The server's refusals of a cell, in plain language (NFR-USA-4); the code picks the sentence and is never shown. */
const SHIFT_MESSAGES: Readonly<Record<string, string>> = {
  ShiftDateInPast: "That day has passed, so its shift can't be changed.",
  StaffNotRosterable: "This person's role can't be rostered, so their shifts can't be set here.",
  BranchNotAssigned: 'This person is not assigned to this outlet. Assign them to it first.',
  BranchNotFound: "This outlet couldn't be found. Reload the page.",
};

export function describeShiftError(error: unknown): string {
  if (error instanceof ApiValidationError) {
    for (const violation of error.response.errors) {
      const message = SHIFT_MESSAGES[violation.errorCode];
      if (message) return message;
    }
  }
  return describeApiError(error);
}
