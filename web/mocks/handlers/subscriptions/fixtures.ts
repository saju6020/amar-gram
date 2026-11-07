import { accountsFixtureIds } from '../areas/accounts';
import { administrationFixtureIds, zonedTimeToUtcIso } from '../admin/fixtures';
import { seedProducts, shopFixtureIds } from '../shop/fixtures';
import {
  COMMERCE_ZONE,
  SUBSCRIPTION_SETTINGS,
  addDays,
  localDateOf,
  type FulfilmentName,
  type PaymentMethodName,
  type PendingStatusChangeName,
  type ScheduleTerms,
  type SubscriptionStatusName,
} from './schedule';

/**
 * `mocks/handlers/subscriptions/fixtures.ts` — HO-P6 S0 (§11.1.4, §11.1.5). Ids and the seed definitions
 * of the subscriptions mock, as plain data with no store dependency (the ordering store reads the order
 * seeds from here, so this file must not import it). Every date is relative to today in `Asia/Dhaka`
 * (ADR-FE-193); `seedDates()` returns the ones a spec needs so a spec never computes them.
 *
 * Products are existing catalogue fixtures (`shopFixtureIds`, `mocks/handlers/shop/fixtures.ts`): food and
 * household items whose `isSubscribable` is true there.
 */

const id = (prefix: string, n: number) => `${prefix}0000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

// ---- ids ----------------------------------------------------------------------------------------------------

const skuId = (n: number) => id('b', n);

export const subscriptionFixtureIds = {
  /** The signed-in customer (the accounts mock's). */
  customerId: accountsFixtureIds.customerId,
  /** Other customers: the ids the ordering mock's seeded orders already use. */
  otherCustomers: {
    farhana: 'c0000000-0000-0000-0000-0000000000a2',
    nusrat: 'c0000000-0000-0000-0000-0000000000a3',
    tanvir: 'c0000000-0000-0000-0000-0000000000a4',
    mizanur: 'c0000000-0000-0000-0000-0000000000a5',
    shirin: 'c0000000-0000-0000-0000-0000000000a6',
  },
  /** The signed-in customer's subscriptions, by situation. */
  mine: {
    activeUnlocked: id('5b', 1),
    activeLocked: id('5b', 2),
    paused: id('5b', 3),
    suspendedUnpaid: id('5b', 4),
    suspendedProductUnavailable: id('5b', 5),
    cancelled: id('5b', 6),
    addressMissing: id('5b', 7),
    awaitingPayment: id('5b', 8),
  },
  /** Other customers' subscriptions. */
  others: {
    active: id('5b', 11),
    activePickup: id('5b', 12),
    dueTomorrow: id('5b', 13),
    atRisk: id('5b', 14),
    suspendedUnpaid: id('5b', 15),
    paused: id('5b', 16),
    cancelled: id('5b', 17),
  },
  addresses: {
    samHome: id('5a', 1),
    samOffice: id('5a', 2),
    /** In no address book: the "address removed" case. */
    removed: id('5a', 9),
    farhana: id('5a', 11),
    tanvir: id('5a', 13),
    mizanur: id('5a', 14),
    shirin: id('5a', 15),
  },
  mainBranchId: administrationFixtureIds.mainBranchId,
  mainBranchName: 'Dhanmondi outlet',
  skus: {
    oats400: shopFixtureIds.skuOats400,
    oats2kg: shopFixtureIds.skuOats2kg,
    oats4kg: shopFixtureIds.skuOats4kg,
    rice: shopFixtureIds.skuJasmineRice,
    gur: skuId(301),
    masala250: skuId(401),
    masala750: skuId(402),
    mustardOil: skuId(501),
    honey: skuId(601),
    lentils: skuId(801),
    pickle: skuId(901),
    dates: skuId(1001),
  },
} as const;

/**
 * The SKUs the shop mock marks `isSubscribable`: the single list lives in `shop/fixtures.ts`
 * (`SUBSCRIBABLE_PRODUCT_NUMBERS`; this file already imports that module, so the shop cannot import this one)
 * and this is derived from it. The seeds below are built on `subscriptionFixtureIds.skus`, which a test pins to this list.
 */
export const SUBSCRIBABLE_SKU_IDS: readonly string[] = seedProducts()
  .filter((p) => p.isSubscribable)
  .flatMap((p) => p.skus.map((s) => s.skuId));

export const customerDirectory: ReadonlyArray<{ id: string; name: string; mobile: string | null }> = [
  { id: subscriptionFixtureIds.customerId, name: 'Sam Rahman', mobile: accountsFixtureIds.customerMobile },
  { id: subscriptionFixtureIds.otherCustomers.farhana, name: 'Farhana Yasmin', mobile: '01712000002' },
  { id: subscriptionFixtureIds.otherCustomers.nusrat, name: 'Nusrat Jahan', mobile: '01712000003' },
  { id: subscriptionFixtureIds.otherCustomers.tanvir, name: 'Tanvir Ahmed', mobile: '01712000004' },
  { id: subscriptionFixtureIds.otherCustomers.mizanur, name: 'Mizanur Rahman', mobile: '01712000005' },
  { id: subscriptionFixtureIds.otherCustomers.shirin, name: 'Shirin Akter', mobile: '01712000006' },
];


// ---- seed shapes ------------------------------------------------------------------------------------------

export type CycleOutcomeName = 'Generated' | 'Failed';
export type FailureReasonName =
  | 'OutOfStock'
  | 'ProductUnavailable'
  | 'PaymentMethodUnavailable'
  | 'DeliveryUnavailable'
  | 'DeliveryAddressMissing'
  | 'OrderRefused';
export type OrderStateName = 'AwaitingPayment' | 'Confirmed' | 'Expired' | 'Cancelled' | 'Delivered' | 'Refused';

export interface SeedCycle {
  /** Days from today (negative = past); the cycle date. */
  dayOffset: number;
  outcome: CycleOutcomeName;
  failureReason?: FailureReasonName;
  orderState?: OrderStateName;
}

export interface SeedSubscription {
  id: string;
  customerId: string;
  skuId: string;
  productName: string;
  variantLabel: string;
  status: SubscriptionStatusName;
  suspensionReason?: 'UnpaidCycles' | 'ProductUnavailable';
  terms: ScheduleTerms;
  pendingTerms?: ScheduleTerms;
  pendingSkip?: boolean;
  pendingStatusChange?: PendingStatusChangeName;
  /** Days from today; absent = no next delivery (paused, suspended, cancelled). */
  nextDayOffset?: number;
  startedDayOffset: number;
  /** Days ago the subscription was suspended or cancelled. */
  endedDaysAgo?: number;
  cancellationReason?: string;
  cancellationNote?: string;
  cycles: SeedCycle[];
}

const home = subscriptionFixtureIds.addresses;
const sku = subscriptionFixtureIds.skus;

function terms(
  quantity: number,
  intervalWeeks: number,
  paymentMethod: PaymentMethodName,
  where: { address: string } | { branch: string },
): ScheduleTerms {
  const fulfilment: FulfilmentName = 'address' in where ? 'Delivery' : 'Pickup';
  return {
    quantity,
    intervalWeeks,
    fulfilment,
    deliveryAddressId: 'address' in where ? where.address : null,
    pickupBranchId: 'branch' in where ? where.branch : null,
    paymentMethod,
  };
}

const me = subscriptionFixtureIds.customerId;
const mine = subscriptionFixtureIds.mine;
const others = subscriptionFixtureIds.others;
const people = subscriptionFixtureIds.otherCustomers;
const main = { branch: subscriptionFixtureIds.mainBranchId };

/** The cut-off (2 days) puts a delivery on `today + 2` inside the lock and `today + 3` outside it. */
const LOCKED_OFFSET = SUBSCRIPTION_SETTINGS.changeCutoffDays;

export function subscriptionSeeds(): SeedSubscription[] {
  return [
    {
      id: mine.activeUnlocked, customerId: me, skuId: sku.oats400, productName: 'Organic Rolled Oats', variantLabel: '400 g',
      status: 'Active', terms: terms(2, 4, 'CashOnDelivery', { address: home.samHome }), nextDayOffset: 14, startedDayOffset: -70,
      cycles: [
        { dayOffset: -14, outcome: 'Generated', orderState: 'Delivered' },
        { dayOffset: -42, outcome: 'Generated', orderState: 'Cancelled' },
      ],
    },
    {
      id: mine.activeLocked, customerId: me, skuId: sku.rice, productName: 'Thai Jasmine Rice', variantLabel: '1 kg',
      status: 'Active', terms: terms(1, 2, 'BankTransfer', { address: home.samHome }),
      pendingTerms: terms(3, 4, 'BankTransfer', { address: home.samHome }),
      nextDayOffset: LOCKED_OFFSET, startedDayOffset: -26,
      cycles: [{ dayOffset: LOCKED_OFFSET - 14, outcome: 'Generated', orderState: 'Confirmed' }],
    },
    {
      id: mine.paused, customerId: me, skuId: sku.gur, productName: 'Date Palm Gur', variantLabel: '1 kg',
      status: 'Paused', terms: terms(1, 4, 'CashOnDelivery', { address: home.samHome }), startedDayOffset: -58,
      cycles: [
        { dayOffset: -30, outcome: 'Generated', orderState: 'Delivered' },
        { dayOffset: -58, outcome: 'Failed', failureReason: 'OutOfStock' },
      ],
    },
    {
      id: mine.suspendedUnpaid, customerId: me, skuId: sku.masala250, productName: 'Garam Masala Blend', variantLabel: '250 g',
      status: 'Suspended', suspensionReason: 'UnpaidCycles', terms: terms(1, 2, 'BankTransfer', { address: home.samHome }),
      startedDayOffset: -31, endedDaysAgo: 3,
      cycles: [
        { dayOffset: -3, outcome: 'Generated', orderState: 'Expired' },
        { dayOffset: -17, outcome: 'Generated', orderState: 'Expired' },
      ],
    },
    {
      id: mine.suspendedProductUnavailable, customerId: me, skuId: sku.lentils, productName: 'Red Lentils (Masoor Dal)', variantLabel: '1 kg',
      status: 'Suspended', suspensionReason: 'ProductUnavailable', terms: terms(1, 4, 'CashOnDelivery', { address: home.samHome }),
      startedDayOffset: -33, endedDaysAgo: 5,
      cycles: [{ dayOffset: -5, outcome: 'Failed', failureReason: 'ProductUnavailable' }],
    },
    {
      id: mine.cancelled, customerId: me, skuId: sku.honey, productName: 'Raw Forest Honey', variantLabel: '500 g',
      status: 'Cancelled', terms: terms(1, 8, 'BankTransfer', main), startedDayOffset: -91, endedDaysAgo: 20,
      cancellationReason: 'TooMuchStock',
      cycles: [{ dayOffset: -35, outcome: 'Generated', orderState: 'Delivered' }],
    },
    {
      id: mine.addressMissing, customerId: me, skuId: sku.mustardOil, productName: 'Pure Mustard Oil', variantLabel: '1.5 L',
      status: 'Active', terms: terms(1, 6, 'CashOnDelivery', { address: home.removed }), nextDayOffset: 20, startedDayOffset: -64,
      cycles: [{ dayOffset: -22, outcome: 'Failed', failureReason: 'DeliveryAddressMissing' }],
    },
    {
      id: mine.awaitingPayment, customerId: me, skuId: sku.pickle, productName: 'Mango Pickle (Achar)', variantLabel: '400 g',
      status: 'Active', terms: terms(1, 4, 'BankTransfer', { address: home.samHome }), nextDayOffset: 27, startedDayOffset: -1,
      cycles: [{ dayOffset: -1, outcome: 'Generated', orderState: 'AwaitingPayment' }],
    },
    // ---- other customers ----
    {
      id: others.active, customerId: people.farhana, skuId: sku.oats2kg, productName: 'Organic Rolled Oats', variantLabel: '2 kg',
      status: 'Active', terms: terms(1, 4, 'CashOnDelivery', { address: home.farhana }), nextDayOffset: 9, startedDayOffset: -47,
      cycles: [
        { dayOffset: -19, outcome: 'Generated', orderState: 'Delivered' },
        { dayOffset: -47, outcome: 'Failed', failureReason: 'DeliveryUnavailable' },
      ],
    },
    {
      id: others.activePickup, customerId: people.nusrat, skuId: sku.rice, productName: 'Thai Jasmine Rice', variantLabel: '1 kg',
      status: 'Active', terms: terms(2, 2, 'BankTransfer', main), nextDayOffset: 5, startedDayOffset: -37,
      cycles: [
        { dayOffset: -9, outcome: 'Generated', orderState: 'Confirmed' },
        { dayOffset: -37, outcome: 'Failed', failureReason: 'PaymentMethodUnavailable' },
      ],
    },
    {
      id: others.dueTomorrow, customerId: people.tanvir, skuId: sku.masala750, productName: 'Garam Masala Blend', variantLabel: '750 g',
      status: 'Active', terms: terms(1, 4, 'CashOnDelivery', { address: home.tanvir }), nextDayOffset: 1, startedDayOffset: -55,
      cycles: [
        { dayOffset: -27, outcome: 'Generated', orderState: 'Delivered' },
        { dayOffset: -55, outcome: 'Failed', failureReason: 'OrderRefused' },
      ],
    },
    {
      id: others.atRisk, customerId: people.mizanur, skuId: sku.dates, productName: 'Khejur Dates', variantLabel: '1 kg',
      status: 'Active', terms: terms(1, 4, 'BankTransfer', { address: home.mizanur }), nextDayOffset: 16, startedDayOffset: -12,
      cycles: [{ dayOffset: -12, outcome: 'Generated', orderState: 'Expired' }],
    },
    {
      id: others.suspendedUnpaid, customerId: people.shirin, skuId: sku.honey, productName: 'Raw Forest Honey', variantLabel: '500 g',
      status: 'Suspended', suspensionReason: 'UnpaidCycles', terms: terms(1, 2, 'BankTransfer', { address: home.shirin }),
      startedDayOffset: -18, endedDaysAgo: 4,
      cycles: [
        { dayOffset: -4, outcome: 'Generated', orderState: 'Expired' },
        { dayOffset: -18, outcome: 'Generated', orderState: 'Expired' },
      ],
    },
    {
      id: others.paused, customerId: people.farhana, skuId: sku.gur, productName: 'Date Palm Gur', variantLabel: '1 kg',
      status: 'Paused', terms: terms(1, 4, 'CashOnDelivery', { address: home.farhana }), startedDayOffset: -61,
      cycles: [{ dayOffset: -33, outcome: 'Generated', orderState: 'Refused' }],
    },
    {
      id: others.cancelled, customerId: people.tanvir, skuId: sku.mustardOil, productName: 'Pure Mustard Oil', variantLabel: '1.5 L',
      status: 'Cancelled', terms: terms(1, 6, 'CashOnDelivery', { address: home.tanvir }), startedDayOffset: -50, endedDaysAgo: 10,
      cancellationReason: 'StaffCancelled', cancellationNote: 'Customer asked us by phone to stop deliveries.',
      cycles: [{ dayOffset: -50, outcome: 'Generated', orderState: 'Delivered' }],
    },
  ];
}

// ---- dates a spec needs -------------------------------------------------------------------------------------

export interface SeedDates {
  today: string;
  tomorrow: string;
  /** `activeUnlocked`: outside the cut-off. */
  unlockedNextDeliveryOn: string;
  unlockedFollowingDeliveryOn: string;
  /** `activeLocked`: inside the cut-off, with pending terms. */
  lockedNextDeliveryOn: string;
  lockedFollowingDeliveryOn: string;
  /** `dueTomorrow` (another customer). */
  dueTomorrowNextDeliveryOn: string;
  /** The Subscribe form's range (C1). */
  earliestFirstDeliveryOn: string;
  latestFirstDeliveryOn: string;
}

export function seedDates(now: Date = new Date()): SeedDates {
  const today = localDateOf(now, COMMERCE_ZONE);
  const unlocked = subscriptionSeeds().find((s) => s.id === mine.activeUnlocked)!;
  const locked = subscriptionSeeds().find((s) => s.id === mine.activeLocked)!;
  const unlockedNext = addDays(today, unlocked.nextDayOffset!);
  const lockedNext = addDays(today, locked.nextDayOffset!);
  return {
    today,
    tomorrow: addDays(today, 1),
    unlockedNextDeliveryOn: unlockedNext,
    unlockedFollowingDeliveryOn: addDays(unlockedNext, 7 * unlocked.terms.intervalWeeks),
    lockedNextDeliveryOn: lockedNext,
    lockedFollowingDeliveryOn: addDays(lockedNext, 7 * (locked.pendingTerms ?? locked.terms).intervalWeeks),
    dueTomorrowNextDeliveryOn: addDays(today, 1),
    earliestFirstDeliveryOn: addDays(today, SUBSCRIPTION_SETTINGS.changeCutoffDays + 1),
    latestFirstDeliveryOn: addDays(today, 90),
  };
}

// ---- subscription-channel orders (read by the ordering store) -------------------------------------------------

export interface SubscriptionOrderSeed {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerMobile: string | null;
  skuId: string;
  quantity: number;
  paymentMethod: 'CashOnDelivery' | 'BankTransfer' | 'PayOnCollection';
  fulfilmentMethod: 'Delivery' | 'Pickup';
  state: OrderStateName;
  /** Whole days ago the order was placed (the cycle date). */
  placedDaysAgo: number;
  /** Hours from now the transfer window closes (negative = closed). */
  paymentDueInHours: number;
}

const orderId = (n: number) => id('f5', n);
export const subscriptionOrderNumber = (n: number) => `ORD-2026-${String(300 + n).padStart(6, '0')}`;

/** Where a cycle's order id and number come from, so the cycle and its order agree. */
export function cycleOrderRef(subscriptionId: string, dayOffset: number): { orderId: string; orderNumber: string } {
  const index = generatedCycleKeys().indexOf(`${subscriptionId}:${dayOffset}`);
  return { orderId: orderId(index + 1), orderNumber: subscriptionOrderNumber(index + 1) };
}

function generatedCycleKeys(): string[] {
  return subscriptionSeeds().flatMap((s) =>
    s.cycles.filter((c) => c.outcome === 'Generated').map((c) => `${s.id}:${c.dayOffset}`),
  );
}

/** The instant a transfer window closes, for a cycle in a given state: open 30 h from now, or closed 2 days after the cycle date. */
export function paymentExpiresOn(state: OrderStateName, cycleDayOffset: number, now: Date = new Date()): string | null {
  if (state === 'AwaitingPayment') return new Date(now.getTime() + 30 * 3_600_000).toISOString();
  if (state === 'Expired') {
    return zonedTimeToUtcIso(addDays(localDateOf(now, COMMERCE_ZONE), cycleDayOffset + 2), '00:00', COMMERCE_ZONE);
  }
  return null;
}

export function subscriptionOrderSeeds(): SubscriptionOrderSeed[] {
  const customers = new Map(customerDirectory.map((c) => [c.id, c]));
  const seeds: SubscriptionOrderSeed[] = [];
  for (const s of subscriptionSeeds()) {
    for (const c of s.cycles) {
      if (c.outcome !== 'Generated') continue;
      const ref = cycleOrderRef(s.id, c.dayOffset);
      const customer = customers.get(s.customerId)!;
      const state = c.orderState!;
      seeds.push({
        orderId: ref.orderId,
        orderNumber: ref.orderNumber,
        customerId: s.customerId,
        customerName: customer.name,
        customerMobile: customer.mobile,
        skuId: s.skuId,
        quantity: s.terms.quantity,
        paymentMethod: s.terms.paymentMethod === 'PayAtPickup' ? 'PayOnCollection' : s.terms.paymentMethod,
        fulfilmentMethod: s.terms.fulfilment,
        state,
        placedDaysAgo: Math.max(1, -c.dayOffset),
        paymentDueInHours: state === 'AwaitingPayment' ? 30 : -24,
      });
    }
  }
  return seeds;
}
