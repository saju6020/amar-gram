import {
  clearPersisted,
  loadPersisted,
  savePersisted,
  zonedTimeToUtcIso,
} from '../admin/fixtures';
import { getBranchSnapshot } from '../admin/branches';
import { findCustomerAddress } from '../areas/accounts';
import { findSku } from '../shop/store';
import {
  customerDirectory,
  paymentExpiresOn as seededPaymentExpiresOn,
  cycleOrderRef,
  subscriptionSeeds,
  type CycleOutcomeName,
  type FailureReasonName,
  type OrderStateName,
} from './fixtures';
import {
  COMMERCE_ZONE,
  CUSTOMER_CYCLE_HISTORY,
  DEFAULT_MAX_EXPORT_ROWS,
  MAX_FIRST_DELIVERY_DAYS,
  MAX_NOTE_LENGTH,
  STAFF_CYCLE_HISTORY,
  STREAK_WINDOW,
  SUBSCRIPTION_SETTINGS,
  ALLOWED_INTERVAL_WEEKS,
  MAX_QUANTITY,
  ScheduleViolation,
  addDays,
  allowedActions,
  cancel as scheduleCancel,
  changeTerms as scheduleChangeTerms,
  createClock,
  describe,
  followingCycleOn,
  isLocked,
  pause as schedulePause,
  resume as scheduleResume,
  skip as scheduleSkip,
  skippableCycleOn,
  validFirstDate,
  withdrawPending as scheduleWithdraw,
  type ScheduleChange,
  type ScheduleClock,
  type ScheduleState,
  type ScheduleTerms,
  type SubscriptionStatusName,
} from './schedule';

/**
 * `mocks/handlers/subscriptions/store.ts` — HO-P6 S0, ADR-FE-193. The subscriptions mock's database (kept in
 * `sessionStorage` under `__amargram_subscriptions_mock_db__v2`, like the other mock stores) and the view
 * builders that shape it into the server's view models. The builders produce exactly the shapes of
 * `src/Read/AmarGram.Read/ViewModels/SubscriptionViewModels.cs`, including the flattened detail objects of
 * `SubscriptionHttp.Flatten`. The handlers (slices S1, S2, S3) validate a request as the server does and
 * then call the mutations here, which are the aggregate's (`SubscriptionAggregate.cs`) and apply
 * `schedule.ts` for every schedule change.
 *
 * The catalogue (names, prices, stock, `isSubscribable`) is the shop mock's; the address book is the accounts
 * mock's (`findCustomerAddress`), read, never copied (HO-P6 Amended (b)).
 */

// v2: the seeded ids became real GUIDs (HO-P6 S0 CODE_REVIEW).
const PERSIST_KEY = '__amargram_subscriptions_mock_db__v2';
const CURRENCY = 'BDT';
const DISCOUNT_SEED = '10.00';

// ---- database types ---------------------------------------------------------------------------------------

export interface DbCycle {
  id: string;
  subscriptionId: string;
  cycleOn: string;
  outcome: CycleOutcomeName;
  failureReason: FailureReasonName | null;
  orderId: string | null;
  orderNumber: string | null;
  orderState: OrderStateName | null;
  paymentExpiresOn: string | null;
  discountPercent: string;
  /** Instant; the unpaid streak counts only cycles processed after a reinstatement. */
  processedOn: string;
}

export interface DbSubscription {
  id: string;
  customerId: string;
  version: number;
  skuId: string;
  /** The creation snapshot (`SubscribedProduct`); the live name wins in a view. */
  productName: string;
  variantLabel: string;
  status: SubscriptionStatusName;
  suspensionReason: 'UnpaidCycles' | 'ProductUnavailable' | null;
  terms: ScheduleTerms;
  pendingTerms: ScheduleTerms | null;
  pendingSkip: boolean;
  pendingStatusChange: 'Pause' | 'Cancel' | null;
  nextDeliveryOn: string | null;
  nextDeliverySetOn: string | null;
  lastCycleOn: string | null;
  lastSkippedOn: string | null;
  startedOn: string;
  cancelledOn: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  cancellationNote: string | null;
  suspendedOn: string | null;
  reinstatedOn: string | null;
  reinstatedBy: string | null;
  reinstatementReason: string | null;
}

interface Db {
  /** The local date the seeds were made for; a copy from another day is reseeded (seeds are relative to today). */
  seededOn: string;
  /** The subscriber discount (`subscription.discountPercent`); seeded at "10.00" (OQ-17). */
  discountPercent: string;
  subscriptions: DbSubscription[];
  cycles: DbCycle[];
}

// ---- seed -------------------------------------------------------------------------------------------------

const cycleId = (n: number) => `5c000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

function seed(now: Date = new Date()): Db {
  const clock = createClock(now);
  const today = clock.today;
  const subscriptions: DbSubscription[] = [];
  const cycles: DbCycle[] = [];
  let cycleCounter = 0;

  for (const s of subscriptionSeeds()) {
    const own = s.cycles
      .map((c) => ({ ...c, cycleOn: addDays(today, c.dayOffset) }))
      .sort((a, b) => (a.cycleOn < b.cycleOn ? 1 : -1));
    const endedOn =
      s.endedDaysAgo === undefined ? null : new Date(now.getTime() - s.endedDaysAgo * 86_400_000).toISOString();

    subscriptions.push({
      id: s.id,
      customerId: s.customerId,
      version: 1,
      skuId: s.skuId,
      productName: s.productName,
      variantLabel: s.variantLabel,
      status: s.status,
      suspensionReason: s.suspensionReason ?? null,
      terms: s.terms,
      pendingTerms: s.pendingTerms ?? null,
      pendingSkip: s.pendingSkip ?? false,
      pendingStatusChange: s.pendingStatusChange ?? null,
      nextDeliveryOn: s.nextDayOffset === undefined ? null : addDays(today, s.nextDayOffset),
      nextDeliverySetOn: s.nextDayOffset === undefined ? null : today,
      lastCycleOn: own[0]?.cycleOn ?? null,
      lastSkippedOn: null,
      startedOn: addDays(today, s.startedDayOffset),
      cancelledOn: s.status === 'Cancelled' ? endedOn : null,
      cancelledBy: s.status === 'Cancelled' ? s.customerId : null,
      cancellationReason: s.cancellationReason ?? null,
      cancellationNote: s.cancellationNote ?? null,
      suspendedOn: s.status === 'Suspended' ? endedOn : null,
      reinstatedOn: null,
      reinstatedBy: null,
      reinstatementReason: null,
    });

    for (const c of s.cycles) {
      cycleCounter += 1;
      const generated = c.outcome === 'Generated';
      const ref = generated ? cycleOrderRef(s.id, c.dayOffset) : null;
      const cycleOn = addDays(today, c.dayOffset);
      cycles.push({
        id: cycleId(cycleCounter),
        subscriptionId: s.id,
        cycleOn,
        outcome: c.outcome,
        failureReason: c.failureReason ?? null,
        orderId: ref?.orderId ?? null,
        orderNumber: ref?.orderNumber ?? null,
        orderState: generated ? (c.orderState ?? null) : null,
        paymentExpiresOn: generated ? seededPaymentExpiresOn(c.orderState!, c.dayOffset, now) : null,
        discountPercent: DISCOUNT_SEED,
        processedOn: zonedTimeToUtcIso(cycleOn, '00:00', COMMERCE_ZONE),
      });
    }
  }

  return {
    seededOn: today,
    discountPercent: DISCOUNT_SEED,
    subscriptions,
    cycles,
  };
}

function loadOrSeed(): Db {
  const persisted = loadPersisted<Db>(PERSIST_KEY);
  return persisted && persisted.seededOn === createClock().today ? persisted : seed();
}

export const db: Db = loadOrSeed();

export function persist(): void {
  savePersisted(PERSIST_KEY, db);
}

export function resetSubscriptionsMockData(): void {
  Object.assign(db, seed());
  maxExportRows = DEFAULT_MAX_EXPORT_ROWS;
  clearPersisted(PERSIST_KEY);
}

// ---- export cap (test-only override, so the mock need not hold 50,001 rows) ---------------------------------

/** `SubscriptionRules.MaxExportRows`, Shared/Common/Constants/SubscriptionRules.cs:26. */
export const MAX_EXPORT_ROWS = DEFAULT_MAX_EXPORT_ROWS;
let maxExportRows = DEFAULT_MAX_EXPORT_ROWS;
export const getMaxExportRows = (): number => maxExportRows;
/** Test-only: lower the cap so a spec can prove the 413. `null` restores 50,000. */
export function setMaxExportRows(rows: number | null): void {
  maxExportRows = rows ?? DEFAULT_MAX_EXPORT_ROWS;
}

// ---- clock, settings, small helpers -------------------------------------------------------------------------

export const commerceClock = (now: Date = new Date()): ScheduleClock => createClock(now);

export const customerName = (customerId: string): string =>
  customerDirectory.find((c) => c.id === customerId)?.name ?? 'Customer';

export function customerView(customerId: string): { id: string; name: string; mobile: string | null } {
  const found = customerDirectory.find((c) => c.id === customerId);
  return { id: customerId, name: found?.name ?? 'Customer', mobile: found?.mobile ?? null };
}

/** `yyyy-MM-dd` of the latest first delivery (`Today + 90`). */
export const latestFirstDeliveryOn = (clock: ScheduleClock): string =>
  addDays(clock.today, MAX_FIRST_DELIVERY_DAYS);

export function findSubscription(id: string): DbSubscription | undefined {
  return db.subscriptions.find((s) => s.id === id);
}

/** The customer's own subscription, or `undefined` for a missing one or someone else's (the same 404, ADR-248). */
export function findOwnSubscription(customerId: string, id: string): DbSubscription | undefined {
  return db.subscriptions.find((s) => s.id === id && s.customerId === customerId);
}

/** Live = not cancelled (`SubscriptionAggregate.IsLive`). */
export const isLive = (s: DbSubscription): boolean => s.status !== 'Cancelled';

export const findLiveFor = (customerId: string, skuId: string): DbSubscription | undefined =>
  db.subscriptions.find((s) => s.customerId === customerId && s.skuId === skuId && isLive(s));

export const countLive = (customerId: string): number =>
  db.subscriptions.filter((s) => s.customerId === customerId && isLive(s)).length;

/** Accounts' address book is the single source (SubscriptionViews.cs:93-102): an address added or deleted there is what this sees. */
export const findAddress = findCustomerAddress;

export const cyclesOf = (subscriptionId: string): DbCycle[] =>
  db.cycles
    .filter((c) => c.subscriptionId === subscriptionId)
    .sort((a, b) => (a.cycleOn < b.cycleOn ? 1 : a.cycleOn > b.cycleOn ? -1 : 0));

// ---- money (integer minor units here, strings on the wire) --------------------------------------------------

function toCents(text: string): number {
  const [whole = '0', fraction = ''] = text.replace(/[^0-9.]/g, '').split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
}

function centsText(cents: number): string {
  const digits = String(Math.trunc(cents)).padStart(3, '0');
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

const money = (cents: number) => ({ amount: centsText(cents), currencyCode: CURRENCY });

/** A percent text ("10.00") in basis points, by string handling. */
function basisPoints(percentText: string): number {
  return toCents(percentText);
}

// ---- view builders ---------------------------------------------------------------------------------------

/** SubscriptionProductViewModel. The live catalogue wins; the creation snapshot is the fallback. */
export function productViewOf(sub: Pick<DbSubscription, 'skuId' | 'productName' | 'variantLabel'>) {
  const found = findSku(sub.skuId);
  return {
    skuId: sub.skuId,
    productName: found?.product.name ?? sub.productName,
    variantLabel: found?.sku.sizeOrWeight ?? sub.variantLabel,
    imageUrl: null as string | null,
    isAvailable: isPurchasable(sub.skuId),
  };
}

/** `ISubscribableCatalogue` `IsPurchasable`: an active product and SKU, in stock, with a price. */
export function isPurchasable(skuId: string): boolean {
  const found = findSku(skuId);
  if (!found) return false;
  return (
    found.product.status === 'Active' &&
    found.sku.status === 'Active' &&
    found.sku.inStock &&
    found.sku.price !== null
  );
}

export const isSubscribableSku = (skuId: string): boolean =>
  findSku(skuId)?.product.isSubscribable === true;

export function termsViewOf(customerId: string, t: ScheduleTerms) {
  const address = t.deliveryAddressId ? findAddress(customerId, t.deliveryAddressId) : undefined;
  // The Administration mock's branches are the one source (SubscriptionViews.cs:109-114 reads the Branches table).
  const branch = t.pickupBranchId ? getBranchSnapshot(t.pickupBranchId) : undefined;
  return {
    quantity: t.quantity,
    intervalWeeks: t.intervalWeeks,
    fulfilment: t.fulfilment,
    deliveryAddress: address
      ? { id: address.id, label: address.label, line1: address.line1, city: address.city }
      : null,
    deliveryAddressMissing: t.deliveryAddressId !== null && !address,
    pickupBranch: branch ? { id: branch.id, name: branch.name } : null,
    paymentMethod: t.paymentMethod,
  };
}

/** `SubscriptionEstimate.Compute` over the live price; `null` when the SKU has none. Integer cents, round half up. */
export function estimateOf(sub: DbSubscription) {
  const price = findSku(sub.skuId)?.sku.price ?? null;
  if (price === null) return null;
  const unit = toCents(price);
  const quantity = sub.terms.quantity;
  const subtotal = unit * quantity;
  const discount = Math.round((subtotal * basisPoints(db.discountPercent)) / 10_000);
  return {
    unitPrice: money(unit),
    quantity,
    subtotal: money(subtotal),
    discountPercent: db.discountPercent,
    discountAmount: money(discount),
    estimatedTotal: money(subtotal - discount),
    note: 'Delivery and tax are added when each order is placed.',
  };
}

export function cycleViewOf(c: DbCycle) {
  return {
    id: c.id,
    cycleOn: c.cycleOn,
    outcome: c.outcome,
    failureReason: c.failureReason,
    orderId: c.orderId,
    orderNumber: c.orderNumber,
    orderState: c.orderState,
    paymentExpiresOn: c.paymentExpiresOn,
    discountPercent: c.discountPercent,
  };
}

export function scheduleStateOf(s: DbSubscription): ScheduleState {
  return {
    status: s.status,
    terms: s.terms,
    pendingTerms: s.pendingTerms,
    pendingSkip: s.pendingSkip,
    pendingStatusChange: s.pendingStatusChange,
    nextDeliveryOn: s.nextDeliveryOn,
    nextDeliverySetOn: s.nextDeliverySetOn,
    lastCycleOn: s.lastCycleOn,
    lastSkippedOn: s.lastSkippedOn,
  };
}

function applyState(s: DbSubscription, state: ScheduleState): void {
  s.status = state.status;
  s.terms = state.terms;
  s.pendingTerms = state.pendingTerms;
  s.pendingSkip = state.pendingSkip;
  s.pendingStatusChange = state.pendingStatusChange;
  s.nextDeliveryOn = state.nextDeliveryOn;
  s.nextDeliverySetOn = state.nextDeliverySetOn;
  s.lastCycleOn = state.lastCycleOn;
  s.lastSkippedOn = state.lastSkippedOn;
}

/** SubscriptionViewModel, built as `SubscriptionViews.ViewOf` does (SubscriptionViews.cs:42-76). */
export function subscriptionViewOf(s: DbSubscription, clock: ScheduleClock = commerceClock()) {
  const state = scheduleStateOf(s);
  const last = cyclesOf(s.id)[0] ?? null;

  let pending = null as null | {
    terms: ReturnType<typeof termsViewOf> | null;
    skip: boolean;
    statusChange: 'Pause' | 'Cancel' | null;
    appliesFromCycleOn: string | null;
  };
  if (s.pendingTerms !== null || s.pendingSkip || s.pendingStatusChange !== null) {
    pending = {
      terms: s.pendingTerms ? termsViewOf(s.customerId, s.pendingTerms) : null,
      skip: s.pendingSkip,
      statusChange: s.pendingStatusChange,
      appliesFromCycleOn: s.pendingStatusChange === 'Cancel' ? s.nextDeliveryOn : followingCycleOn(state),
    };
  }

  return {
    id: s.id,
    version: s.version,
    status: s.status,
    suspensionReason: s.suspensionReason,
    product: productViewOf(s),
    terms: termsViewOf(s.customerId, s.terms),
    nextDeliveryOn: s.nextDeliveryOn,
    changeCutoffOn:
      s.status === 'Active' && s.nextDeliveryOn ? clock.cutoffInstant(s.nextDeliveryOn).toISOString() : null,
    isLocked: isLocked(state, clock),
    followingDeliveryOn: s.status === 'Active' ? followingCycleOn(state) : null,
    skippableCycleOn: skippableCycleOn(state, clock),
    pending,
    estimate: estimateOf(s),
    allowedActions: allowedActions(state, clock),
    lastCycle: last ? cycleViewOf(last) : null,
    startedOn: s.startedOn,
    cancelledOn: s.cancelledOn,
    commerceTimeZoneId: clock.zone,
  };
}

/** C4: `SubscriptionView` plus `cycles` (the latest 12, newest first) as one flat object. */
export function customerDetailOf(s: DbSubscription, clock: ScheduleClock = commerceClock()) {
  return {
    ...subscriptionViewOf(s, clock),
    cycles: cyclesOf(s.id).slice(0, CUSTOMER_CYCLE_HISTORY).map(cycleViewOf),
  };
}

/** T5: `SubscriptionView` plus the staff fields as one flat object (SubscriptionStaffQueryHandlers.cs:155-181). */
export function staffDetailOf(s: DbSubscription, clock: ScheduleClock = commerceClock()) {
  const allowedStaffActions: string[] = [];
  if (s.status === 'Suspended') allowedStaffActions.push('Reinstate');
  if (s.status !== 'Cancelled') allowedStaffActions.push('Cancel');
  return {
    ...subscriptionViewOf(s, clock),
    customer: customerView(s.customerId),
    cycles: cyclesOf(s.id).slice(0, STAFF_CYCLE_HISTORY).map(cycleViewOf),
    cancellationReason: s.cancellationReason,
    cancellationNote: s.cancellationNote,
    suspendedOn: s.suspendedOn,
    reinstatement:
      s.reinstatedOn && s.reinstatedBy
        ? { reinstatedOn: s.reinstatedOn, reinstatedBy: s.reinstatedBy, reason: s.reinstatementReason ?? '' }
        : null,
    allowedStaffActions,
  };
}

/** The unpaid streak (`UnpaidCycleRule.Streak` over the latest `STREAK_WINDOW` cycles processed after a reinstatement). */
export function streakOf(s: DbSubscription): number {
  const window = cyclesOf(s.id)
    .slice(0, STREAK_WINDOW)
    .filter((c) => s.reinstatedOn === null || c.processedOn > s.reinstatedOn);
  let streak = 0;
  for (const c of window) {
    if (c.outcome === 'Failed') continue;
    if (c.orderState === 'AwaitingPayment' || c.orderState === 'Cancelled' || c.orderState === null) continue;
    if (c.orderState !== 'Expired' && c.orderState !== 'Refused') break;
    streak += 1;
  }
  return streak;
}

/** StaffSubscriptionRowViewModel. */
export function staffRowOf(s: DbSubscription, clock: ScheduleClock = commerceClock()) {
  const view = subscriptionViewOf(s, clock);
  return {
    id: s.id,
    customer: customerView(s.customerId),
    product: view.product,
    quantity: s.terms.quantity,
    intervalWeeks: s.terms.intervalWeeks,
    status: s.status,
    suspensionReason: s.suspensionReason,
    nextDeliveryOn: s.nextDeliveryOn,
    paymentMethod: s.terms.paymentMethod,
    unpaidStreak: streakOf(s),
    lastCycle: view.lastCycle,
  };
}

/** T2 in the server's order: Suspended first, then by streak (SubscriptionStaffQueryHandlers.cs:114-153). */
export function unpaidItems() {
  const isUnpaid = (state: string | null) => state === 'Expired' || state === 'Refused';
  const candidates = db.subscriptions.filter(
    (s) =>
      (s.status === 'Suspended' && s.suspensionReason === 'UnpaidCycles') ||
      (s.status === 'Active' &&
        db.cycles.some(
          (c) =>
            c.subscriptionId === s.id &&
            (c.orderState === 'AwaitingPayment' || isUnpaid(c.orderState)),
        )),
  );
  return candidates
    .map((s) => {
      const window = cyclesOf(s.id).slice(0, STREAK_WINDOW);
      return { s, streak: streakOf(s), window };
    })
    .filter(
      ({ s, streak, window }) =>
        s.status === 'Suspended' || streak >= 1 || window.some((c) => c.orderState === 'AwaitingPayment'),
    )
    .sort(
      (a, b) =>
        Number(a.s.status !== 'Suspended') - Number(b.s.status !== 'Suspended') ||
        b.streak - a.streak ||
        (a.s.id < b.s.id ? -1 : 1),
    )
    .map(({ s, streak, window }) => ({
      id: s.id,
      customer: customerView(s.customerId),
      product: productViewOf(s),
      status: s.status,
      group: s.status === 'Suspended' ? ('Suspended' as const) : ('AtRisk' as const),
      unpaidStreak: streak,
      unpaidCycles: window
        .filter((c) => c.orderState === 'AwaitingPayment' || isUnpaid(c.orderState))
        .map(cycleViewOf),
    }));
}

/** T3: Active with `nextDeliveryOn` = tomorrow in the commerce zone, plus the live and suspended counts. */
export function dueTomorrowOf(clock: ScheduleClock = commerceClock()) {
  const tomorrow = addDays(clock.today, 1);
  return {
    dueOn: tomorrow,
    count: db.subscriptions.filter((s) => s.status === 'Active' && s.nextDeliveryOn === tomorrow).length,
    liveCount: db.subscriptions.filter(isLive).length,
    suspendedCount: db.subscriptions.filter((s) => s.status === 'Suspended').length,
    commerceTimeZoneId: clock.zone,
  };
}

/** T9: every non-cancelled subscription (soonest delivery first, none last), and the two counts. */
export function customerSummaryOf(customerId: string, clock: ScheduleClock = commerceClock()) {
  const mine = db.subscriptions.filter((s) => s.customerId === customerId);
  const live = mine
    .filter(isLive)
    .sort(
      (a, b) =>
        Number(a.nextDeliveryOn === null) - Number(b.nextDeliveryOn === null) ||
        (a.nextDeliveryOn ?? '').localeCompare(b.nextDeliveryOn ?? '') ||
        a.id.localeCompare(b.id),
    );
  return {
    live: live.map((s) => subscriptionViewOf(s, clock)),
    cancelledCount: mine.filter((s) => s.status === 'Cancelled').length,
    suspendedCount: live.filter((s) => s.status === 'Suspended').length,
  };
}

/** C1: `null` for an unknown SKU (404). */
export function optionsOf(customerId: string, skuId: string, clock: ScheduleClock = commerceClock()) {
  const found = findSku(skuId);
  if (!found) return null;
  const purchasable = isPurchasable(skuId);
  const subscribable = purchasable && found.product.isSubscribable === true;
  const reason = subscribable
    ? null
    : !purchasable
      ? 'This product is not available to subscribe to right now.'
      : 'This product is not offered as a subscription.';
  return {
    sku: productViewOf({ skuId, productName: found.product.name, variantLabel: found.sku.sizeOrWeight ?? '' }),
    unitPrice: found.sku.price === null ? null : money(toCents(found.sku.price)),
    subscribable,
    notSubscribableReason: reason,
    allowedIntervalWeeks: [...ALLOWED_INTERVAL_WEEKS],
    maxQuantity: MAX_QUANTITY,
    discountPercent: db.discountPercent,
    earliestFirstDeliveryOn: clock.earliestDeliveryOn,
    latestFirstDeliveryOn: latestFirstDeliveryOn(clock),
    changeCutoffDays: SUBSCRIPTION_SETTINGS.changeCutoffDays,
    preChargeNoticeDays: SUBSCRIPTION_SETTINGS.preChargeNoticeDays,
    existingSubscriptionId: findLiveFor(customerId, skuId)?.id ?? null,
    commerceTimeZoneId: clock.zone,
  };
}

// ---- mutations (the aggregate's methods; the handlers validate before calling) ------------------------------

export interface ChangeOutcome {
  appliedImmediately: boolean;
  appliesFromCycleOn: string | null;
  message: string;
}

const productLabelOf = (s: DbSubscription): string =>
  s.variantLabel.trim() === '' ? s.productName : `${s.productName} ${s.variantLabel}`;

function commit(s: DbSubscription, change: ScheduleChange): ChangeOutcome {
  applyState(s, change.state);
  s.version += 1;
  persist();
  return {
    appliedImmediately: change.appliedImmediately,
    appliesFromCycleOn: change.appliesFromCycleOn,
    message: describe(change, productLabelOf(s)),
  };
}

/** `SubscriptionChangeResult`: `{ subscription, appliedImmediately, appliesFromCycleOn, message }`. */
export function changeResultOf(s: DbSubscription, outcome: ChangeOutcome, clock: ScheduleClock = commerceClock()) {
  return {
    subscription: subscriptionViewOf(s, clock),
    appliedImmediately: outcome.appliedImmediately,
    appliesFromCycleOn: outcome.appliesFromCycleOn,
    message: outcome.message,
  };
}

/** `SubscriptionAggregate.Create`: Active, started on and due on the first delivery date. */
export function startSubscription(
  input: { customerId: string; skuId: string; terms: ScheduleTerms; firstDeliveryOn?: string | null },
  clock: ScheduleClock = commerceClock(),
): DbSubscription {
  const first = validFirstDate(input.firstDeliveryOn, clock);
  const found = findSku(input.skuId);
  const sub: DbSubscription = {
    id: crypto.randomUUID(),
    customerId: input.customerId,
    version: 1,
    skuId: input.skuId,
    productName: found?.product.name ?? 'Product',
    variantLabel: found?.sku.sizeOrWeight ?? '',
    status: 'Active',
    suspensionReason: null,
    terms: input.terms,
    pendingTerms: null,
    pendingSkip: false,
    pendingStatusChange: null,
    nextDeliveryOn: first,
    nextDeliverySetOn: clock.today,
    lastCycleOn: null,
    lastSkippedOn: null,
    startedOn: first,
    cancelledOn: null,
    cancelledBy: null,
    cancellationReason: null,
    cancellationNote: null,
    suspendedOn: null,
    reinstatedOn: null,
    reinstatedBy: null,
    reinstatementReason: null,
  };
  db.subscriptions.push(sub);
  persist();
  return sub;
}

export const changeTermsOf = (s: DbSubscription, terms: ScheduleTerms, clock = commerceClock()) =>
  commit(s, scheduleChangeTerms(scheduleStateOf(s), terms, clock));

export const skipDeliveryOf = (s: DbSubscription, cycleOn: string, clock = commerceClock()) =>
  commit(s, scheduleSkip(scheduleStateOf(s), cycleOn, clock));

export const pauseOf = (s: DbSubscription, clock = commerceClock()) =>
  commit(s, schedulePause(scheduleStateOf(s), clock));

export const resumeOf = (s: DbSubscription, firstDeliveryOn: string | null | undefined, clock = commerceClock()) =>
  commit(s, scheduleResume(scheduleStateOf(s), firstDeliveryOn, clock));

/** `SubscriptionAggregate.Cancel`: a note above 500 characters is `CancellationReasonRequired` (property `note`). */
export function cancelOf(
  s: DbSubscription,
  by: string,
  reason: string,
  note: string | null | undefined,
  clock = commerceClock(),
): ChangeOutcome {
  if (note && note.length > MAX_NOTE_LENGTH) {
    throw new ScheduleViolation(
      'CancellationReasonRequired',
      `A cancellation note is up to ${MAX_NOTE_LENGTH} characters.`,
      'note',
    );
  }
  const change = scheduleCancel(scheduleStateOf(s), clock);
  s.cancelledBy = by;
  s.cancellationReason = reason;
  s.cancellationNote = note && note.trim() !== '' ? note.trim() : null;
  const outcome = commit(s, change);
  if (s.status === 'Cancelled') s.cancelledOn = clock.now.toISOString();
  persist();
  return outcome;
}

/** `SubscriptionAggregate.WithdrawPendingChanges`: a withdrawn scheduled cancel forgets its reason too. */
export function withdrawPendingOf(s: DbSubscription): ChangeOutcome {
  const outcome = commit(s, scheduleWithdraw(scheduleStateOf(s)));
  if (s.status !== 'Cancelled' && s.cancelledOn === null) {
    s.cancelledBy = null;
    s.cancellationReason = null;
    s.cancellationNote = null;
    persist();
  }
  return outcome;
}

/** `SubscriptionAggregate.Suspend` (idempotent). */
export function suspendOf(
  s: DbSubscription,
  reason: 'UnpaidCycles' | 'ProductUnavailable',
  clock = commerceClock(),
): boolean {
  if (s.status === 'Suspended') return false;
  if (s.status !== 'Active' && s.status !== 'Paused') {
    throw new ScheduleViolation(
      'InvalidSubscriptionTransition',
      `A ${s.status.toLowerCase()} subscription cannot be suspended.`,
      'Status',
    );
  }
  s.status = 'Suspended';
  s.suspensionReason = reason;
  s.suspendedOn = clock.now.toISOString();
  s.nextDeliveryOn = null;
  s.nextDeliverySetOn = null;
  s.pendingTerms = null;
  s.pendingSkip = false;
  s.pendingStatusChange = null;
  s.version += 1;
  persist();
  return true;
}

/** `SubscriptionAggregate.Reinstate` (SubscriptionAggregate.cs:256-277). */
export function reinstateOf(
  s: DbSubscription,
  by: string,
  reason: string,
  firstDeliveryOn: string | null | undefined,
  clock = commerceClock(),
): void {
  if (s.status !== 'Suspended') {
    throw new ScheduleViolation(
      'SubscriptionCannotBeReinstated',
      `A ${s.status.toLowerCase()} subscription cannot be reinstated.`,
      'Status',
    );
  }
  if (reason.trim() === '' || reason.trim().length > MAX_NOTE_LENGTH) {
    throw new ScheduleViolation(
      'ReinstatementReasonRequired',
      'Give a reason for restarting this subscription.',
      'reason',
    );
  }
  const date = validFirstDate(firstDeliveryOn, clock);
  s.status = 'Active';
  s.suspensionReason = null;
  s.suspendedOn = null;
  s.nextDeliveryOn = date;
  s.nextDeliverySetOn = clock.today;
  s.reinstatedOn = clock.now.toISOString();
  s.reinstatedBy = by;
  s.reinstatementReason = reason.trim();
  s.version += 1;
  persist();
}
