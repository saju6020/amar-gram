import { zonedTimeToUtcIso } from '../admin/fixtures';

/**
 * `mocks/handlers/subscriptions/schedule.ts` — HO-P6 S0, ADR-FE-193. A port of
 * `src/Domain/AmarGram.Domain/DomainServices/SubscriptionSchedule.cs` (the schedule, the cut-off and the
 * pending changes, pure) with `SubscriptionClock.cs` and `SubscriptionTerms.Create`. The aggregate and the
 * read side apply one set of rules there; the mock applies the same set here, with the server's exact
 * sentences. Dates are `yyyy-MM-dd` strings. The mock IS the server, so it may do date arithmetic; the real
 * screens may not (ADR-FE-110, ADR-FE-112).
 *
 * Every function names the C# member it mirrors. A refusal throws `ScheduleViolation`, the mock's
 * `DomainRuleViolationException`: a code, the server's sentence and the property the server names.
 */

export const COMMERCE_ZONE = 'Asia/Dhaka';

// ---- Shared/Common/Constants/SubscriptionRules.cs ---------------------------------------------------------

export const ALLOWED_INTERVAL_WEEKS: readonly number[] = [2, 4, 6, 8, 12];
export const MAX_QUANTITY = 20;
export const MAX_LIVE_SUBSCRIPTIONS_PER_CUSTOMER = 20;
export const MAX_FIRST_DELIVERY_DAYS = 90;
export const MAX_NOTE_LENGTH = 500;
export const STREAK_WINDOW = 10;
export const CUSTOMER_CYCLE_HISTORY = 12;
export const STAFF_CYCLE_HISTORY = 50;
export const DEFAULT_MAX_EXPORT_ROWS = 50_000;

// ---- Shared/Common/Constants/SettingDefinitions.Subscriptions.cs defaults (OQ-17: fixed in the mock) --------

export const SUBSCRIPTION_SETTINGS = {
  changeCutoffDays: 2,
  preChargeNoticeDays: 3,
  paymentReminderHours: 24,
  maxConsecutiveUnpaidCycles: 2,
} as const;

// ---- types ------------------------------------------------------------------------------------------------

export type SubscriptionStatusName = 'Active' | 'Paused' | 'Suspended' | 'Cancelled';
export type PendingStatusChangeName = 'Pause' | 'Cancel';
export type FulfilmentName = 'Delivery' | 'Pickup';
export type PaymentMethodName = 'CashOnDelivery' | 'BankTransfer' | 'PayAtPickup';

/** Domain/ValueObjects/SubscriptionTerms.cs */
export interface ScheduleTerms {
  quantity: number;
  intervalWeeks: number;
  fulfilment: FulfilmentName;
  deliveryAddressId: string | null;
  pickupBranchId: string | null;
  paymentMethod: PaymentMethodName;
}

/** SubscriptionSchedule.cs:9-18 `ScheduleState` */
export interface ScheduleState {
  status: SubscriptionStatusName;
  terms: ScheduleTerms;
  pendingTerms: ScheduleTerms | null;
  pendingSkip: boolean;
  pendingStatusChange: PendingStatusChangeName | null;
  nextDeliveryOn: string | null;
  nextDeliverySetOn: string | null;
  lastCycleOn: string | null;
  lastSkippedOn: string | null;
}

export type ChangeKind = 'TermsChanged' | 'Skipped' | 'Paused' | 'Resumed' | 'Cancelled' | 'Withdrawn';

/** SubscriptionSchedule.cs:21 `ScheduleChange` */
export interface ScheduleChange {
  state: ScheduleState;
  appliedImmediately: boolean;
  appliesFromCycleOn: string | null;
  lockedCycleOn: string | null;
  kind: ChangeKind;
}

export type ScheduleAction =
  | 'ChangeTerms'
  | 'Skip'
  | 'Pause'
  | 'Resume'
  | 'Cancel'
  | 'WithdrawPending';

/** The mock's `DomainRuleViolationException`: `code` is the `errorCode`, `propertyName` the `propertyName`. */
export class ScheduleViolation extends Error {
  readonly code: string;
  readonly propertyName: string;

  constructor(code: string, message: string, propertyName: string) {
    super(message);
    this.name = 'ScheduleViolation';
    this.code = code;
    this.propertyName = propertyName;
  }
}

// ---- dates ------------------------------------------------------------------------------------------------

function parts(dateText: string): [number, number, number] {
  const [y = 1970, m = 1, d = 1] = dateText.split('-').map(Number);
  return [y, m, d];
}

/** `DateOnly.AddDays`. */
export function addDays(dateText: string, days: number): string {
  const [y, m, d] = parts(dateText);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The local date of an instant in a zone (`SubscriptionClock.LocalDateOf`). */
export function localDateOf(instant: Date, zone: string = COMMERCE_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(instant);
}

/** `SubscriptionMessages.Day`: `ddd d MMM`, e.g. `Tue 20 Oct`. */
export function day(dateText: string): string {
  const [y, m, d] = parts(dateText);
  const at = new Date(Date.UTC(y, m - 1, d));
  const text = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).formatToParts(at);
  const pick = (type: Intl.DateTimeFormatPartTypes) => text.find((p) => p.type === type)?.value ?? '';
  return `${pick('weekday')} ${pick('day')} ${pick('month')}`;
}

// ---- Domain/ValueObjects/SubscriptionClock.cs -------------------------------------------------------------

export interface ScheduleClock {
  now: Date;
  zone: string;
  cutoffDays: number;
  /** The local date of `now` in the commerce zone. */
  today: string;
  /** Local midnight at the start of `cycleOn - cutoffDays`, as an instant. */
  cutoffInstant(cycleOn: string): Date;
  /** The cycle's order is committed: its terms are fixed and later changes wait. */
  isLocked(cycleOn: string): boolean;
  /** `Today + CutoffDays + 1`: the earliest date a person may choose. */
  earliestDeliveryOn: string;
}

export function createClock(
  now: Date = new Date(),
  cutoffDays: number = SUBSCRIPTION_SETTINGS.changeCutoffDays,
  zone: string = COMMERCE_ZONE,
): ScheduleClock {
  const today = localDateOf(now, zone);
  const cutoffInstant = (cycleOn: string): Date =>
    new Date(zonedTimeToUtcIso(addDays(cycleOn, -cutoffDays), '00:00', zone));
  return {
    now,
    zone,
    cutoffDays,
    today,
    cutoffInstant,
    isLocked: (cycleOn) => now.getTime() >= cutoffInstant(cycleOn).getTime(),
    earliestDeliveryOn: addDays(today, cutoffDays + 1),
  };
}

// ---- Domain/ValueObjects/SubscriptionTerms.cs :: Create ---------------------------------------------------

/** `SubscriptionTerms.Create`: the same four refusals in the same order. */
export function createTerms(input: {
  quantity: number;
  intervalWeeks: number;
  fulfilment: FulfilmentName;
  deliveryAddressId: string | null;
  pickupBranchId: string | null;
  paymentMethod: PaymentMethodName;
}): ScheduleTerms {
  const { quantity, intervalWeeks, fulfilment, deliveryAddressId, pickupBranchId, paymentMethod } =
    input;
  if (quantity < 1 || quantity > MAX_QUANTITY) {
    throw new ScheduleViolation(
      'InvalidSubscriptionQuantity',
      `Quantity must be between 1 and ${MAX_QUANTITY}.`,
      'Quantity',
    );
  }
  if (!ALLOWED_INTERVAL_WEEKS.includes(intervalWeeks)) {
    throw new ScheduleViolation(
      'InvalidSubscriptionInterval',
      `Choose a delivery every ${ALLOWED_INTERVAL_WEEKS.join(', ')} weeks.`,
      'IntervalWeeks',
    );
  }
  const isDelivery = fulfilment === 'Delivery';
  if (isDelivery && (!deliveryAddressId || pickupBranchId)) {
    throw new ScheduleViolation(
      'FulfilmentDetailsInvalid',
      'A delivery needs a delivery address and no collection branch.',
      'DeliveryAddressId',
    );
  }
  if (!isDelivery && (!pickupBranchId || deliveryAddressId)) {
    throw new ScheduleViolation(
      'FulfilmentDetailsInvalid',
      'A collection needs a branch and no delivery address.',
      'PickupBranchId',
    );
  }
  if (
    (paymentMethod === 'PayAtPickup' && isDelivery) ||
    (paymentMethod === 'CashOnDelivery' && !isDelivery)
  ) {
    throw new ScheduleViolation(
      'PaymentMethodNotAllowedForFulfilment',
      isDelivery
        ? 'Pay at the shop only goes with collection.'
        : 'Cash on delivery only goes with delivery.',
      'PaymentMethod',
    );
  }
  return {
    quantity,
    intervalWeeks,
    fulfilment,
    deliveryAddressId: deliveryAddressId ?? null,
    pickupBranchId: pickupBranchId ?? null,
    paymentMethod,
  };
}

/** C# record equality of `SubscriptionTerms`. */
export function termsEqual(a: ScheduleTerms, b: ScheduleTerms): boolean {
  return (
    a.quantity === b.quantity &&
    a.intervalWeeks === b.intervalWeeks &&
    a.fulfilment === b.fulfilment &&
    a.deliveryAddressId === b.deliveryAddressId &&
    a.pickupBranchId === b.pickupBranchId &&
    a.paymentMethod === b.paymentMethod
  );
}

// ---- SubscriptionSchedule.cs ------------------------------------------------------------------------------

/** `IsLocked`, :44-45. */
export function isLocked(s: ScheduleState, clock: ScheduleClock): boolean {
  return s.status === 'Active' && s.nextDeliveryOn !== null && clock.isLocked(s.nextDeliveryOn);
}

/** `FollowingCycleOn`, :48-49: `NextDeliveryOn + 7 x (pending interval ?? current interval)`. */
export function followingCycleOn(s: ScheduleState): string | null {
  if (s.nextDeliveryOn === null) return null;
  return addDays(s.nextDeliveryOn, 7 * (s.pendingTerms?.intervalWeeks ?? s.terms.intervalWeeks));
}

/** `SkippableCycleOn`, :52-58. */
export function skippableCycleOn(s: ScheduleState, clock: ScheduleClock): string | null {
  if (s.status !== 'Active' || s.nextDeliveryOn === null || s.pendingStatusChange !== null) {
    return null;
  }
  if (!clock.isLocked(s.nextDeliveryOn)) return s.nextDeliveryOn;
  return s.pendingSkip ? null : followingCycleOn(s);
}

/** `NoticeDateFor`, :60: `cycleOn - max(noticeDays, cutoffDays + 1)`. */
export function noticeDateFor(cycleOn: string, noticeDays: number, cutoffDays: number): string {
  return addDays(cycleOn, -Math.max(noticeDays, cutoffDays + 1));
}

/** `AllowedActions`, :62-86. */
export function allowedActions(s: ScheduleState, clock: ScheduleClock): ScheduleAction[] {
  const actions: ScheduleAction[] = [];
  const hasPending = s.pendingTerms !== null || s.pendingSkip || s.pendingStatusChange !== null;
  const cancelPending = s.pendingStatusChange === 'Cancel';

  if (s.status === 'Active' && !cancelPending) {
    actions.push('ChangeTerms');
    if (skippableCycleOn(s, clock) !== null) actions.push('Skip');
    if (s.pendingStatusChange === null) actions.push('Pause');
    actions.push('Cancel');
  } else if (s.status === 'Paused') {
    actions.push('ChangeTerms', 'Resume', 'Cancel');
  } else if (s.status === 'Suspended') {
    actions.push('Cancel');
  }

  if (hasPending && s.status !== 'Cancelled') actions.push('WithdrawPending');
  return actions;
}

/** `SubscriptionMessages.TransitionNotAllowed` (SubscriptionMessages.cs:31-32) wrapped as `Invalid` (:256-257). */
function invalid(status: SubscriptionStatusName, action: string): ScheduleViolation {
  return new ScheduleViolation(
    'InvalidSubscriptionTransition',
    `A ${status.toLowerCase()} subscription cannot be ${action}.`,
    'Status',
  );
}

/** `NotSkippable`, :253-254, with `SubscriptionMessages.CycleNoLongerSkippable` (SubscriptionMessages.cs:41-44). */
function notSkippable(requested: string, nextSkippable: string | null): ScheduleViolation {
  return new ScheduleViolation(
    'CycleNoLongerSkippable',
    nextSkippable
      ? `The delivery on ${day(requested)} can no longer be skipped. You can skip the one on ${day(nextSkippable)}.`
      : `The delivery on ${day(requested)} can no longer be skipped.`,
    'CycleOn',
  );
}

/** `ChangeTerms`, :90-115. */
export function changeTerms(
  s: ScheduleState,
  terms: ScheduleTerms,
  clock: ScheduleClock,
): ScheduleChange {
  if (s.status !== 'Active' && s.status !== 'Paused') throw invalid(s.status, 'changed');
  if (s.pendingStatusChange === 'Cancel') {
    throw invalid(s.status, 'changed after it has been cancelled');
  }
  if (termsEqual(terms, s.pendingTerms ?? s.terms)) {
    throw new ScheduleViolation(
      'NoChangeRequested',
      'Nothing was changed - these are already the terms of your subscription.',
      'terms',
    );
  }

  // A paused subscription has no locked cycle: the change is immediate and applies when it is resumed.
  if (s.status === 'Paused') {
    return {
      state: { ...s, terms, pendingTerms: null },
      appliedImmediately: true,
      appliesFromCycleOn: null,
      lockedCycleOn: null,
      kind: 'TermsChanged',
    };
  }

  const next = s.nextDeliveryOn!;
  if (!clock.isLocked(next)) {
    let changed: ScheduleState = { ...s, terms, pendingTerms: null };
    if (terms.intervalWeeks !== s.terms.intervalWeeks && s.lastCycleOn !== null) {
      const recomputed = addDays(s.lastCycleOn, 7 * terms.intervalWeeks);
      changed = {
        ...changed,
        nextDeliveryOn: recomputed > clock.earliestDeliveryOn ? recomputed : clock.earliestDeliveryOn,
        nextDeliverySetOn: clock.today,
      };
    }
    return {
      state: changed,
      appliedImmediately: true,
      appliesFromCycleOn: changed.nextDeliveryOn,
      lockedCycleOn: null,
      kind: 'TermsChanged',
    };
  }

  const pending = termsEqual(terms, s.terms) ? null : terms;
  return {
    state: { ...s, pendingTerms: pending },
    appliedImmediately: false,
    appliesFromCycleOn: addDays(next, 7 * terms.intervalWeeks),
    lockedCycleOn: next,
    kind: 'TermsChanged',
  };
}

/** `Skip`, :117-136. */
export function skip(s: ScheduleState, cycleOn: string, clock: ScheduleClock): ScheduleChange {
  if (s.status !== 'Active') throw invalid(s.status, 'skipped');
  if (s.pendingStatusChange !== null) {
    throw invalid(s.status, `skipped while it is about to ${s.pendingStatusChange.toLowerCase()}`);
  }

  const next = s.nextDeliveryOn!;
  if (!clock.isLocked(next)) {
    if (cycleOn !== next) throw notSkippable(cycleOn, next);
    const moved: ScheduleState = {
      ...s,
      nextDeliveryOn: addDays(next, 7 * s.terms.intervalWeeks),
      lastSkippedOn: cycleOn,
    };
    return {
      state: moved,
      appliedImmediately: true,
      appliesFromCycleOn: moved.nextDeliveryOn,
      lockedCycleOn: null,
      kind: 'Skipped',
    };
  }

  const following = followingCycleOn(s)!;
  if (cycleOn === following && s.pendingSkip) {
    throw new ScheduleViolation(
      'SkipAlreadyScheduled',
      `The delivery on ${day(following)} is already set to be skipped.`,
      'cycleOn',
    );
  }
  if (cycleOn !== following) throw notSkippable(cycleOn, s.pendingSkip ? null : following);

  return {
    state: { ...s, pendingSkip: true },
    appliedImmediately: false,
    appliesFromCycleOn: following,
    lockedCycleOn: next,
    kind: 'Skipped',
  };
}

/** `Pause`, :138-149. */
export function pause(s: ScheduleState, clock: ScheduleClock): ScheduleChange {
  if (s.status !== 'Active') throw invalid(s.status, 'paused');
  if (s.pendingStatusChange !== null) {
    throw invalid(s.status, `paused while it is about to ${s.pendingStatusChange.toLowerCase()}`);
  }

  const next = s.nextDeliveryOn!;
  if (!clock.isLocked(next)) {
    return {
      state: {
        ...s,
        status: 'Paused',
        nextDeliveryOn: null,
        nextDeliverySetOn: null,
        pendingTerms: null,
        pendingSkip: false,
      },
      appliedImmediately: true,
      appliesFromCycleOn: null,
      lockedCycleOn: null,
      kind: 'Paused',
    };
  }
  return {
    state: { ...s, pendingStatusChange: 'Pause' },
    appliedImmediately: false,
    appliesFromCycleOn: followingCycleOn(s),
    lockedCycleOn: next,
    kind: 'Paused',
  };
}

/** `ValidFirstDate`, :207-216. A first or restart date must lie in `[EarliestDeliveryOn, Today + 90]`; none given = the earliest. */
export function validFirstDate(requested: string | null | undefined, clock: ScheduleClock): string {
  const date = requested ?? clock.earliestDeliveryOn;
  const latest = addDays(clock.today, MAX_FIRST_DELIVERY_DAYS);
  if (date < clock.earliestDeliveryOn || date > latest) {
    throw new ScheduleViolation(
      'InvalidFirstDeliveryDate',
      `Choose a delivery date between ${day(clock.earliestDeliveryOn)} and ${day(latest)}.`,
      'FirstDeliveryOn',
    );
  }
  return date;
}

/** `Resume`, :151-160 (from `Paused` only; a suspension is lifted by staff). */
export function resume(
  s: ScheduleState,
  firstDeliveryOn: string | null | undefined,
  clock: ScheduleClock,
): ScheduleChange {
  if (s.status === 'Suspended') {
    // SubscriptionMessages.SubscriptionSuspendedMessage(null, 0): not the unpaid reason, so the product text.
    throw new ScheduleViolation(
      'SubscriptionSuspended',
      'This subscription was paused because the product is no longer available. Please contact the shop.',
      'Status',
    );
  }
  if (s.status !== 'Paused') throw invalid(s.status, 'resumed');

  const date = validFirstDate(firstDeliveryOn, clock);
  return {
    state: { ...s, status: 'Active', nextDeliveryOn: date, nextDeliverySetOn: clock.today },
    appliedImmediately: true,
    appliesFromCycleOn: date,
    lockedCycleOn: null,
    kind: 'Resumed',
  };
}

function ended(s: ScheduleState): ScheduleState {
  return {
    ...s,
    status: 'Cancelled',
    nextDeliveryOn: null,
    nextDeliverySetOn: null,
    pendingTerms: null,
    pendingSkip: false,
    pendingStatusChange: null,
  };
}

/** `Cancel`, :162-174 (from Active immediately or scheduled after a locked cycle, Paused or Suspended). */
export function cancel(s: ScheduleState, clock: ScheduleClock): ScheduleChange {
  if (s.status === 'Cancelled') throw invalid(s.status, 'cancelled');

  if (s.status === 'Active' && s.nextDeliveryOn !== null && clock.isLocked(s.nextDeliveryOn)) {
    const next = s.nextDeliveryOn;
    if (s.pendingStatusChange === 'Cancel') {
      throw new ScheduleViolation(
        'NoChangeRequested',
        'This subscription is already set to end after your next delivery.',
        'PendingStatusChange',
      );
    }
    return {
      state: { ...s, pendingStatusChange: 'Cancel', pendingSkip: false },
      appliedImmediately: false,
      appliesFromCycleOn: next,
      lockedCycleOn: next,
      kind: 'Cancelled',
    };
  }
  return {
    state: ended(s),
    appliedImmediately: true,
    appliesFromCycleOn: null,
    lockedCycleOn: null,
    kind: 'Cancelled',
  };
}

/** `WithdrawPending`, :176-183. */
export function withdrawPending(s: ScheduleState): ScheduleChange {
  if (s.status === 'Cancelled') throw invalid(s.status, 'changed');
  if (s.pendingTerms === null && !s.pendingSkip && s.pendingStatusChange === null) {
    throw new ScheduleViolation(
      'NoPendingChange',
      'There is no scheduled change to withdraw.',
      'PendingTerms',
    );
  }
  return {
    state: { ...s, pendingTerms: null, pendingSkip: false, pendingStatusChange: null },
    appliedImmediately: true,
    appliesFromCycleOn: null,
    lockedCycleOn: null,
    kind: 'Withdrawn',
  };
}

/** `ProcessCycle`, :187-205: the cycle's order has been raised or failed. A pending cancel wins over a suspension. */
export function processCycle(s: ScheduleState, cycleOn: string): ScheduleState {
  const terms = s.pendingTerms ?? s.terms;
  let next = addDays(cycleOn, 7 * terms.intervalWeeks);
  let skipped = s.lastSkippedOn;
  if (s.pendingSkip) {
    skipped = next;
    next = addDays(next, 7 * terms.intervalWeeks);
  }

  const processed: ScheduleState = {
    ...s,
    terms,
    pendingTerms: null,
    pendingSkip: false,
    lastCycleOn: cycleOn,
    lastSkippedOn: skipped,
    nextDeliveryOn: next,
  };
  if (s.pendingStatusChange === 'Pause') {
    return {
      ...processed,
      status: 'Paused',
      nextDeliveryOn: null,
      nextDeliverySetOn: null,
      pendingStatusChange: null,
    };
  }
  if (s.pendingStatusChange === 'Cancel') return ended(processed);
  return processed;
}

/** `Describe`, :221-246: the sentence a change answers with; it names the date the change takes effect. */
export function describe(change: ScheduleChange, productLabel: string): string {
  const s = change.state;
  const from = change.appliesFromCycleOn ? day(change.appliesFromCycleOn) : null;
  const locked = change.lockedCycleOn ? day(change.lockedCycleOn) : null;
  const applied = change.appliedImmediately;

  switch (change.kind) {
    case 'TermsChanged':
      if (applied && s.nextDeliveryOn) {
        return `Done. Your next delivery on ${day(s.nextDeliveryOn)} will be ${s.terms.quantity} × ${productLabel}.`;
      }
      if (applied) return 'Done. Your changes are saved and apply when you resume.';
      return `Your delivery on ${locked} is already being prepared, so this change starts with the delivery on ${from}.`;
    case 'Skipped':
      if (applied) {
        return `Done. That delivery is skipped. Your next delivery is on ${day(s.nextDeliveryOn!)}.`;
      }
      return `Your delivery on ${locked} is already being prepared, so we will skip the one on ${from} instead.`;
    case 'Paused':
      if (applied) return 'Done. Your subscription is paused. Resume it any time.';
      return `Your delivery on ${locked} is already being prepared and will still arrive. Your subscription pauses after it, from ${from}.`;
    case 'Resumed':
      return `Done. Your subscription is back on. Your next delivery is on ${day(s.nextDeliveryOn!)}.`;
    case 'Cancelled':
      if (applied) return 'Done. Your subscription is cancelled.';
      return `Your delivery on ${locked} is already being prepared and will still arrive. Your subscription ends after it.`;
    default:
      return 'Done. The scheduled change has been withdrawn.';
  }
}
