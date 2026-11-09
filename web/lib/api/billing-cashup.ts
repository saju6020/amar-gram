import { apiFetch } from './client';
import type { Money } from '@/lib/format/money';
import { wireMoney } from '@/lib/money';

/**
 * `lib/api/billing-cashup.ts` — HO-BIL-002 §8.2, §11.6. The daily till count, verified against
 * `StaffCashUpController` and `BillingCashUpViewModels`. Every total and the variance are the
 * server's (`CashUpCalculator`); this module and the screens never add or subtract an amount.
 */

export interface CashUpLine {
  id: string;
  kind: string;
  method: string | null;
  collector: string | null;
  refundMethod: string | null;
  amount: Money;
  countsInCash: boolean;
  carriedIn: boolean;
  label: string | null;
  // HO-P5 BG-20 -- the source the line belongs to (Read/ViewModels/BillingCashUpViewModels.cs:3-5); null for a line that moves no cash.
  sourceKey?: string | null;
}

/**
 * HO-P5 BG-20 -- one source of cash on the day: the till (`key` "till") or one staff collector of cash on delivery
 * (`key` "staff:{staffAccountId}"). `variance` is the server's counted minus expected, signed (a negative string is short);
 * `counted` and `variance` are null while the source is not counted yet on an open day, and for a day counted by total only
 * (Read/ViewModels/BillingCashUpViewModels.cs:7-12, Domain/ValueObjects/CashUpSources.cs:21-40).
 */
export interface CashUpSource {
  key: string;
  label: string;
  expected: Money;
  counted: Money | null;
  variance: Money | null;
}

export interface CashUpCarriedIn {
  id: string;
  kind: string;
  label: string | null;
  amount: Money;
}

export interface CashUpExpected {
  cash: Money;
  cashCount: number;
  card: Money;
  cardCount: number;
  transfer: Money;
  transferCount: number;
  cashRefunds: Money;
  cashReversals: Money;
  carriedInTotal: Money;
  carriedIn: CashUpCarriedIn[];
  expectedCash: Money;
}

export interface CashUp {
  businessDate: string;
  status: 'Open' | 'Closed';
  version: number;
  expected: CashUpExpected;
  lines: CashUpLine[];
  counted: Money | null;
  variance: Money | null;
  explanation: string | null;
  pendingApprovals: number;
  countedBy: string | null;
  countedOn: string | null;
  closedBy: string | null;
  closedByName: string | null;
  closedOn: string | null;
  /** Read/ViewModels/BillingCashUpViewModels.cs:23 -- always sent (the till is always listed); optional here
   *  only so a response from before this field reads as "no sources". */
  sources?: CashUpSource[];
}

const BASE = '/api/staff/billing/cash-ups';

export async function getCashUp(date: string): Promise<CashUp> {
  return apiFetch<CashUp>(`${BASE}/${encodeURIComponent(date)}`);
}

/** Server bounds for a per-source count: at most 50 entries, a key at most 60 characters
 *  (App/CommandHandlers/Validators/BillingCashUpCommandValidators.cs:15-18). */
export const CASH_UP_MAX_SOURCE_COUNTS = 50;
export const CASH_UP_SOURCE_KEY_MAX_LENGTH = 60;

export interface CashUpSourceCountInput {
  sourceKey: string;
  /** A money string ("1250.00"); sent as a JSON number through `wireMoney`. */
  countedCash: string;
}

/**
 * `PUT …/count`. Either the total alone (`countedCash`, the HO-P4 form, kept for a day with no sources) or the
 * per-source `counts` -- then the total is the server's sum and `countedCash` is ignored
 * (Api/Contracts/Billing/BillingCashUpRequests.cs:3-17). The response is the full cash-up read.
 */
export async function recordCashCount(
  date: string,
  request:
    | { countedCash: string; explanation?: string; counts?: undefined }
    | { counts: CashUpSourceCountInput[]; explanation?: string; countedCash?: undefined },
): Promise<CashUp> {
  const body: Record<string, unknown> = { explanation: request.explanation || undefined };
  if (request.counts) {
    body.counts = request.counts.map((c) => ({ sourceKey: c.sourceKey, countedCash: wireMoney(c.countedCash) }));
  } else {
    body.countedCash = wireMoney(request.countedCash);
  }
  return apiFetch<CashUp>(`${BASE}/${encodeURIComponent(date)}/count`, { method: 'PUT', body });
}

export async function closeCashUp(date: string, expectedVersion: number): Promise<void> {
  await apiFetch<void>(`${BASE}/${encodeURIComponent(date)}/close`, {
    method: 'POST',
    body: { expectedVersion },
  });
}
