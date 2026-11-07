import { beforeEach, describe, expect, it } from 'vitest';
import { db as orderingDb, resetOrderingMockData } from '@/mocks/handlers/ordering/store';
import { orderingIds } from '@/mocks/handlers/ordering/fixtures';
import { db as shopDb, resetShopMockData } from '@/mocks/handlers/shop/store';
import { SUBSCRIBABLE_SKU_IDS, seedDates, subscriptionFixtureIds as ids } from '@/mocks/handlers/subscriptions/fixtures';
import {
  customerDetailOf,
  customerSummaryOf,
  db,
  dueTomorrowOf,
  findSubscription,
  optionsOf,
  resetSubscriptionsMockData,
  staffDetailOf,
  staffRowOf,
  streakOf,
  subscriptionViewOf,
  unpaidItems,
} from '@/mocks/handlers/subscriptions/store';
import { findCustomerAddress } from '@/mocks/handlers/areas/accounts';
import { createControls } from '@/mocks/handlers/subscriptions/control';

/** HO-P6 U5: the §11.1.5 seed inventory, by id, and the shapes the builders produce. */
beforeEach(() => {
  resetSubscriptionsMockData();
  resetOrderingMockData();
  resetShopMockData();
});

const get = (id: string) => findSubscription(id)!;

describe('seeds: the signed-in customer', () => {
  it('has each situation of the inventory', () => {
    const mine = ids.mine;
    expect(db.subscriptions.filter((s) => s.customerId === ids.customerId)).toHaveLength(8);

    const unlocked = subscriptionViewOf(get(mine.activeUnlocked));
    expect(unlocked).toMatchObject({ status: 'Active', isLocked: false });
    expect(unlocked.estimate).not.toBeNull();

    const locked = subscriptionViewOf(get(mine.activeLocked));
    expect(locked).toMatchObject({ status: 'Active', isLocked: true });
    expect(locked.pending?.terms).not.toBeNull();
    expect(locked.pending?.appliesFromCycleOn).toBe(seedDates().lockedFollowingDeliveryOn);

    expect(get(mine.paused).status).toBe('Paused');
    expect(get(mine.suspendedUnpaid)).toMatchObject({ status: 'Suspended', suspensionReason: 'UnpaidCycles' });
    expect(db.cycles.filter((c) => c.subscriptionId === mine.suspendedUnpaid && c.orderState === 'Expired')).toHaveLength(2);
    expect(get(mine.suspendedProductUnavailable)).toMatchObject({ status: 'Suspended', suspensionReason: 'ProductUnavailable' });
    expect(get(mine.cancelled)).toMatchObject({ status: 'Cancelled', cancellationReason: 'TooMuchStock' });
    expect(subscriptionViewOf(get(mine.addressMissing)).terms.deliveryAddressMissing).toBe(true);

    const awaiting = subscriptionViewOf(get(mine.awaitingPayment));
    expect(awaiting.lastCycle).toMatchObject({ orderState: 'AwaitingPayment' });
    expect(awaiting.lastCycle?.paymentExpiresOn).toBeTruthy();
  });

  it('cycles cover every outcome, order state and failure reason', () => {
    const states = new Set(db.cycles.map((c) => c.orderState).filter(Boolean));
    expect([...states].sort()).toEqual(['AwaitingPayment', 'Cancelled', 'Confirmed', 'Delivered', 'Expired', 'Refused']);
    const failures = new Set(db.cycles.map((c) => c.failureReason).filter(Boolean));
    expect([...failures].sort()).toEqual([
      'DeliveryAddressMissing',
      'DeliveryUnavailable',
      'OrderRefused',
      'OutOfStock',
      'PaymentMethodUnavailable',
      'ProductUnavailable',
    ]);
    expect(new Set(db.cycles.map((c) => c.outcome))).toEqual(new Set(['Generated', 'Failed']));
  });
});

describe('seeds: other customers', () => {
  it('has at least three Active, one at risk, one suspended for unpaid orders, one paused and one cancelled', () => {
    const others = db.subscriptions.filter((s) => s.customerId !== ids.customerId);
    expect(others.filter((s) => s.status === 'Active').length).toBeGreaterThanOrEqual(3);
    expect(others.some((s) => s.status === 'Paused')).toBe(true);
    expect(others.some((s) => s.status === 'Cancelled')).toBe(true);
    expect(others.some((s) => s.status === 'Suspended' && s.suspensionReason === 'UnpaidCycles')).toBe(true);

    const groups = unpaidItems();
    const atRisk = groups.find((g) => g.id === ids.others.atRisk)!;
    expect(atRisk).toMatchObject({ group: 'AtRisk', unpaidStreak: 1 });
    expect(groups.find((g) => g.id === ids.others.suspendedUnpaid)).toMatchObject({ group: 'Suspended', unpaidStreak: 2 });
    expect(streakOf(get(ids.others.atRisk))).toBe(1);
  });

  it('the worklist lists Suspended first', () => {
    const order = unpaidItems().map((g) => g.group);
    expect(order.indexOf('AtRisk')).toBeGreaterThan(order.lastIndexOf('Suspended'));
  });

  it('due tomorrow is at least 1 and the live and suspended counts are the table', () => {
    const due = dueTomorrowOf();
    expect(due.count).toBeGreaterThanOrEqual(1);
    expect(due.dueOn).toBe(seedDates().tomorrow);
    expect(due.liveCount).toBe(db.subscriptions.filter((s) => s.status !== 'Cancelled').length);
    expect(due.suspendedCount).toBe(db.subscriptions.filter((s) => s.status === 'Suspended').length);
    expect(due.commerceTimeZoneId).toBe('Asia/Dhaka');
  });
});

describe('seeds: products and orders', () => {
  it('at least three subscribable products (one with two SKUs) and at least one that is not', () => {
    const yes = shopDb.products.filter((p) => p.isSubscribable === true);
    expect(yes.length).toBeGreaterThanOrEqual(3);
    expect(yes.some((p) => p.skus.length >= 2)).toBe(true);
    expect(shopDb.products.some((p) => p.isSubscribable === false)).toBe(true);
    // The one subscribable list: the shop's, and the SKUs the subscription fixtures are built on.
    expect([...SUBSCRIBABLE_SKU_IDS].sort()).toEqual(Object.values(ids.skus).sort());
    // Every seeded subscription is on a subscribable SKU.
    for (const s of db.subscriptions) {
      const product = shopDb.products.find((p) => p.skus.some((k) => k.skuId === s.skuId));
      expect(product?.isSubscribable, s.skuId).toBe(true);
    }
  });

  it('every Generated cycle has a Subscription-channel order with the same id and number', () => {
    const generated = db.cycles.filter((c) => c.outcome === 'Generated');
    expect(generated.length).toBeGreaterThan(0);
    for (const cycle of generated) {
      const order = orderingDb.orders.find((o) => o.id === cycle.orderId);
      expect(order, cycle.orderId ?? '').toBeDefined();
      expect(order!.channel).toBe('Subscription');
      expect(order!.orderNumber).toBe(cycle.orderNumber);
      expect(order!.customerId).toBe(db.subscriptions.find((s) => s.id === cycle.subscriptionId)!.customerId);
    }
    expect(orderingDb.orders.filter((o) => o.channel === 'Subscription')).toHaveLength(generated.length);
    // An awaiting-payment bank transfer, a delivered order and an order cancelled after the window.
    const byState = (state: string) => orderingDb.orders.find((o) => o.id === generated.find((c) => c.orderState === state)!.orderId)!;
    expect(byState('AwaitingPayment')).toMatchObject({ status: 'PendingPayment', paymentMethod: 'BankTransfer' });
    expect(byState('Delivered').status).toBe('Delivered');
    expect(byState('Expired')).toMatchObject({ status: 'Cancelled', cancellationReason: 'PaymentWindowExpired' });
  });

  it('the original orders keep their ids, statuses and totals', () => {
    const expected = Object.values(orderingIds.orders);
    for (const id of expected) expect(orderingDb.orders.find((o) => o.id === id), id).toBeDefined();
    expect(orderingDb.orders.slice(0, 11).map((o) => o.id)).toEqual(expected);
    const packed = orderingDb.orders.find((o) => o.id === 'f0000000-0000-0000-0000-000000000112')!;
    expect(packed.status).toBe('Packed');
    const original = orderingDb.orders.filter((o) => o.channel !== 'Subscription');
    expect(original).toHaveLength(13);
    expect(original.every((o) => o.grandTotalCents > 0)).toBe(true);
  });
});

describe('view shapes', () => {
  const SUBSCRIPTION_KEYS = [
    'allowedActions', 'cancelledOn', 'changeCutoffOn', 'commerceTimeZoneId', 'estimate', 'followingDeliveryOn', 'id', 'isLocked',
    'lastCycle', 'nextDeliveryOn', 'pending', 'product', 'skippableCycleOn', 'startedOn', 'status', 'suspensionReason', 'terms', 'version',
  ];

  it('SubscriptionViewModel has exactly the server fields (SubscriptionViewModels.cs:24-43)', () => {
    expect(Object.keys(subscriptionViewOf(get(ids.mine.activeUnlocked))).sort()).toEqual(SUBSCRIPTION_KEYS);
  });

  it('the customer detail is one flat object with the cycles; the staff detail adds the staff fields', () => {
    const detail = customerDetailOf(get(ids.mine.activeUnlocked));
    expect(Object.keys(detail).sort()).toEqual([...SUBSCRIPTION_KEYS, 'cycles'].sort());
    const staff = staffDetailOf(get(ids.mine.suspendedUnpaid));
    expect(Object.keys(staff).sort()).toEqual(
      [...SUBSCRIPTION_KEYS, 'allowedStaffActions', 'cancellationNote', 'cancellationReason', 'customer', 'cycles', 'reinstatement', 'suspendedOn'].sort(),
    );
    expect(staff.allowedStaffActions).toEqual(['Reinstate', 'Cancel']);
    expect(staffDetailOf(get(ids.mine.cancelled)).allowedStaffActions).toEqual([]);
    expect(staffDetailOf(get(ids.mine.activeUnlocked)).allowedStaffActions).toEqual(['Cancel']);
  });

  it('the staff row, the options and the summary have the server fields', () => {
    expect(Object.keys(staffRowOf(get(ids.mine.activeUnlocked))).sort()).toEqual(
      ['customer', 'id', 'intervalWeeks', 'lastCycle', 'nextDeliveryOn', 'paymentMethod', 'product', 'quantity', 'status', 'suspensionReason', 'unpaidStreak'],
    );
    const options = optionsOf(ids.customerId, ids.skus.oats2kg)!;
    expect(Object.keys(options).sort()).toEqual(
      ['allowedIntervalWeeks', 'changeCutoffDays', 'commerceTimeZoneId', 'discountPercent', 'earliestFirstDeliveryOn', 'existingSubscriptionId',
        'latestFirstDeliveryOn', 'maxQuantity', 'notSubscribableReason', 'preChargeNoticeDays', 'sku', 'subscribable', 'unitPrice'],
    );
    expect(options).toMatchObject({ subscribable: true, discountPercent: '10.00', maxQuantity: 20, allowedIntervalWeeks: [2, 4, 6, 8, 12], existingSubscriptionId: null });
    expect(optionsOf(ids.customerId, ids.skus.oats400)!.existingSubscriptionId).toBe(ids.mine.activeUnlocked);
    expect(optionsOf(ids.customerId, 'b0000000-0000-0000-0000-000000000701')).toMatchObject({
      subscribable: false,
      notSubscribableReason: 'This product is not offered as a subscription.',
    });
    expect(optionsOf(ids.customerId, ids.skus.lentils)).toMatchObject({
      subscribable: false,
      notSubscribableReason: 'This product is not available to subscribe to right now.',
    });
    expect(optionsOf(ids.customerId, 'b0000000-0000-0000-0000-00000000dead')).toBeNull();

    const summary = customerSummaryOf(ids.customerId);
    expect(summary.live).toHaveLength(7);
    expect(summary).toMatchObject({ cancelledCount: 1, suspendedCount: 2 });
    expect(customerSummaryOf('c0000000-0000-0000-0000-00000000ffff')).toEqual({ live: [], cancelledCount: 0, suspendedCount: 0 });
  });

  it('money is a string pair and the estimate is the discounted subtotal, from the same price', () => {
    const { estimate } = subscriptionViewOf(get(ids.mine.activeUnlocked));
    expect(estimate).toMatchObject({
      unitPrice: { amount: '650.00', currencyCode: 'BDT' },
      quantity: 2,
      subtotal: { amount: '1300.00' },
      discountPercent: '10.00',
      discountAmount: { amount: '130.00' },
      estimatedTotal: { amount: '1170.00' },
    });
  });

  it('the cut-off is an instant and only Active has one', () => {
    expect(subscriptionViewOf(get(ids.mine.activeUnlocked)).changeCutoffOn).toMatch(/Z$/);
    expect(subscriptionViewOf(get(ids.mine.paused)).changeCutoffOn).toBeNull();
    expect(subscriptionViewOf(get(ids.mine.paused)).followingDeliveryOn).toBeNull();
  });
});

describe('controls', () => {
  it('lock and unlock move the delivery across the cut-off; suspend and setDiscount work', () => {
    const controls = createControls();
    const id = ids.mine.activeUnlocked;
    controls.lock(id);
    expect(subscriptionViewOf(get(id)).isLocked).toBe(true);
    controls.unlock(id);
    expect(subscriptionViewOf(get(id)).isLocked).toBe(false);
    controls.suspend(id, 'ProductUnavailable');
    expect(get(id)).toMatchObject({ status: 'Suspended', suspensionReason: 'ProductUnavailable', nextDeliveryOn: null });
    controls.setDiscount('0.00');
    expect(optionsOf(ids.customerId, ids.skus.oats2kg)!.discountPercent).toBe('0.00');
    controls.addCycles(ids.mine.paused, 14);
    expect(customerDetailOf(get(ids.mine.paused)).cycles).toHaveLength(12);
    controls.reset();
    expect(optionsOf(ids.customerId, ids.skus.oats2kg)!.discountPercent).toBe('10.00');
  });
});

describe('seeds: addresses come from the accounts address book (Amended (b))', () => {
  it('every seeded subscription address resolves there, and the removed one does not', () => {
    for (const s of db.subscriptions) {
      const view = subscriptionViewOf(s).terms;
      if (s.id === ids.mine.addressMissing) continue;
      if (s.terms.deliveryAddressId) {
        expect(view.deliveryAddressMissing, s.id).toBe(false);
        expect(view.deliveryAddress?.id).toBe(s.terms.deliveryAddressId);
      }
    }
    const missing = subscriptionViewOf(get(ids.mine.addressMissing)).terms;
    expect(missing).toMatchObject({ deliveryAddress: null, deliveryAddressMissing: true });
    expect(findCustomerAddress(ids.customerId, ids.addresses.samHome)).toMatchObject({ label: 'Home' });
    expect(findCustomerAddress(ids.customerId, ids.addresses.samOffice)).toMatchObject({ label: 'Office' });
    // Another customer's address id is not in this customer's book.
    expect(findCustomerAddress(ids.customerId, ids.addresses.farhana)).toBeUndefined();
  });
});
