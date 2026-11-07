import { describe, expect, it } from 'vitest';
import {
  ScheduleViolation,
  allowedActions,
  cancel,
  changeTerms,
  createClock,
  createTerms,
  describe as describeChange,
  followingCycleOn,
  isLocked,
  noticeDateFor,
  pause,
  processCycle,
  resume,
  skip,
  skippableCycleOn,
  validFirstDate,
  withdrawPending,
  type ScheduleState,
  type ScheduleTerms,
} from '@/mocks/handlers/subscriptions/schedule';

/**
 * HO-P6 U4: the mock's port of `SubscriptionSchedule.cs`. A table of states with the rules and the exact
 * sentences of the C# source (`SubscriptionSchedule.cs:221-246`, `SubscriptionMessages.cs`).
 *
 * "Now" is Fri 16 Oct 2026, 11:00 in Asia/Dhaka, with the 2-day cut-off: a delivery on Sun 18 Oct or earlier
 * is locked (its cut-off was local midnight on Fri 16 Oct); Tue 20 Oct is not (cut-off Sun 18 Oct 00:00 Dhaka).
 */
const NOW = new Date('2026-10-16T05:00:00Z');
const clock = createClock(NOW, 2);
const ADDRESS = 'a1111111-0000-0000-0000-000000000001';

const terms = (over: Partial<ScheduleTerms> = {}): ScheduleTerms => ({
  quantity: 1,
  intervalWeeks: 4,
  fulfilment: 'Delivery',
  deliveryAddressId: ADDRESS,
  pickupBranchId: null,
  paymentMethod: 'BankTransfer',
  ...over,
});

const active = (over: Partial<ScheduleState> = {}): ScheduleState => ({
  status: 'Active',
  terms: terms(),
  pendingTerms: null,
  pendingSkip: false,
  pendingStatusChange: null,
  nextDeliveryOn: '2026-10-20',
  nextDeliverySetOn: '2026-10-01',
  lastCycleOn: '2026-09-22',
  lastSkippedOn: null,
  ...over,
});
const LOCKED = '2026-10-18';
const label = 'Organic Rolled Oats 400 g';

describe('the clock', () => {
  it('knows today in the commerce zone and the cut-off instant', () => {
    expect(clock.today).toBe('2026-10-16');
    expect(clock.earliestDeliveryOn).toBe('2026-10-19');
    expect(clock.cutoffInstant('2026-10-20').toISOString()).toBe('2026-10-17T18:00:00.000Z');
    expect(clock.isLocked('2026-10-18')).toBe(true);
    expect(clock.isLocked('2026-10-19')).toBe(false);
  });

  it('the notice date is cycleOn - max(noticeDays, cutoffDays + 1)', () => {
    expect(noticeDateFor('2026-10-20', 3, 2)).toBe('2026-10-17');
    expect(noticeDateFor('2026-10-20', 1, 2)).toBe('2026-10-17');
    expect(noticeDateFor('2026-10-20', 5, 2)).toBe('2026-10-15');
  });
});

describe('allowedActions, skippableCycleOn, followingCycleOn', () => {
  const cases: Array<[string, ScheduleState, string[], string | null, string | null]> = [
    ['Active unlocked', active(), ['ChangeTerms', 'Skip', 'Pause', 'Cancel'], '2026-10-20', '2026-11-17'],
    ['Active locked', active({ nextDeliveryOn: LOCKED }), ['ChangeTerms', 'Skip', 'Pause', 'Cancel'], '2026-11-15', '2026-11-15'],
    ['Active locked with a pending skip', active({ nextDeliveryOn: LOCKED, pendingSkip: true }), ['ChangeTerms', 'Pause', 'Cancel', 'WithdrawPending'], null, '2026-11-15'],
    ['Active with a pending pause', active({ pendingStatusChange: 'Pause' }), ['ChangeTerms', 'Cancel', 'WithdrawPending'], null, '2026-11-17'],
    ['Active with a pending cancel', active({ pendingStatusChange: 'Cancel' }), ['WithdrawPending'], null, '2026-11-17'],
    ['Active with pending terms of 2 weeks', active({ pendingTerms: terms({ intervalWeeks: 2 }) }), ['ChangeTerms', 'Skip', 'Pause', 'Cancel', 'WithdrawPending'], '2026-10-20', '2026-11-03'],
    ['Paused', active({ status: 'Paused', nextDeliveryOn: null }), ['ChangeTerms', 'Resume', 'Cancel'], null, null],
    ['Suspended', active({ status: 'Suspended', nextDeliveryOn: null }), ['Cancel'], null, null],
    ['Cancelled', active({ status: 'Cancelled', nextDeliveryOn: null }), [], null, null],
  ];

  it.each(cases)('%s', (_name, state, actions, skippable, following) => {
    expect(allowedActions(state, clock)).toEqual(actions);
    expect(skippableCycleOn(state, clock)).toBe(skippable);
    expect(followingCycleOn(state)).toBe(following);
  });

  it('isLocked is for Active only', () => {
    expect(isLocked(active({ nextDeliveryOn: LOCKED }), clock)).toBe(true);
    expect(isLocked(active(), clock)).toBe(false);
    expect(isLocked(active({ status: 'Paused', nextDeliveryOn: null }), clock)).toBe(false);
  });
});

describe('changeTerms', () => {
  it('unlocked: immediate, and the sentence names the next delivery', () => {
    const change = changeTerms(active(), terms({ quantity: 3 }), clock);
    expect(change).toMatchObject({ appliedImmediately: true, appliesFromCycleOn: '2026-10-20', lockedCycleOn: null });
    expect(change.state.terms.quantity).toBe(3);
    expect(describeChange(change, label)).toBe(`Done. Your next delivery on Tue 20 Oct will be 3 × ${label}.`);
  });

  it('unlocked interval change recomputes from the last cycle but never before the earliest date', () => {
    const later = changeTerms(active(), terms({ intervalWeeks: 6 }), clock);
    expect(later.state.nextDeliveryOn).toBe('2026-11-03');
    expect(later.state.nextDeliverySetOn).toBe('2026-10-16');
    const sooner = changeTerms(active({ lastCycleOn: '2026-08-01' }), terms({ intervalWeeks: 2 }), clock);
    expect(sooner.state.nextDeliveryOn).toBe('2026-10-19');
  });

  it('locked: scheduled for the following delivery, and the sentence names both dates', () => {
    const change = changeTerms(active({ nextDeliveryOn: LOCKED }), terms({ quantity: 2, intervalWeeks: 2 }), clock);
    expect(change).toMatchObject({ appliedImmediately: false, appliesFromCycleOn: '2026-11-01', lockedCycleOn: LOCKED });
    expect(change.state.pendingTerms).toEqual(terms({ quantity: 2, intervalWeeks: 2 }));
    expect(describeChange(change, label)).toBe(
      'Your delivery on Sun 18 Oct is already being prepared, so this change starts with the delivery on Sun 1 Nov.',
    );
  });

  it('locked: changing back to the current terms clears the pending terms', () => {
    const state = active({ nextDeliveryOn: LOCKED, pendingTerms: terms({ quantity: 5 }) });
    expect(changeTerms(state, terms(), clock).state.pendingTerms).toBeNull();
  });

  it('paused: immediate, applies when resumed', () => {
    const change = changeTerms(active({ status: 'Paused', nextDeliveryOn: null }), terms({ quantity: 2 }), clock);
    expect(change).toMatchObject({ appliedImmediately: true, appliesFromCycleOn: null });
    expect(describeChange(change, label)).toBe('Done. Your changes are saved and apply when you resume.');
  });

  it('refusals: the codes, sentences and properties of the server', () => {
    expect(() => changeTerms(active(), terms(), clock)).toThrow(ScheduleViolation);
    try {
      changeTerms(active(), terms(), clock);
    } catch (e) {
      expect(e).toMatchObject({
        code: 'NoChangeRequested',
        message: 'Nothing was changed - these are already the terms of your subscription.',
        propertyName: 'terms',
      });
    }
    expect(() => changeTerms(active({ status: 'Suspended', nextDeliveryOn: null }), terms({ quantity: 2 }), clock)).toThrow(
      'A suspended subscription cannot be changed.',
    );
    expect(() => changeTerms(active({ pendingStatusChange: 'Cancel' }), terms({ quantity: 2 }), clock)).toThrow(
      'A active subscription cannot be changed after it has been cancelled.',
    );
  });
});

describe('skip', () => {
  it('unlocked: moves the next delivery on by the interval', () => {
    const change = skip(active(), '2026-10-20', clock);
    expect(change).toMatchObject({ appliedImmediately: true, appliesFromCycleOn: '2026-11-17' });
    expect(change.state).toMatchObject({ nextDeliveryOn: '2026-11-17', lastSkippedOn: '2026-10-20' });
    expect(describeChange(change, label)).toBe('Done. That delivery is skipped. Your next delivery is on Tue 17 Nov.');
  });

  it('locked: skips the following delivery, scheduled', () => {
    const change = skip(active({ nextDeliveryOn: LOCKED }), '2026-11-15', clock);
    expect(change).toMatchObject({ appliedImmediately: false, appliesFromCycleOn: '2026-11-15', lockedCycleOn: LOCKED });
    expect(change.state.pendingSkip).toBe(true);
    expect(describeChange(change, label)).toBe(
      'Your delivery on Sun 18 Oct is already being prepared, so we will skip the one on Sun 15 Nov instead.',
    );
  });

  it('a stale date names the next skippable one', () => {
    expect(() => skip(active({ nextDeliveryOn: LOCKED }), LOCKED, clock)).toThrow(
      'The delivery on Sun 18 Oct can no longer be skipped. You can skip the one on Sun 15 Nov.',
    );
    expect(() => skip(active(), '2026-11-17', clock)).toThrow(
      'The delivery on Tue 17 Nov can no longer be skipped. You can skip the one on Tue 20 Oct.',
    );
    expect(() => skip(active({ nextDeliveryOn: LOCKED, pendingSkip: true }), LOCKED, clock)).toThrow(
      'The delivery on Sun 18 Oct can no longer be skipped.',
    );
  });

  it('skipping the already-skipped following delivery is SkipAlreadyScheduled', () => {
    try {
      skip(active({ nextDeliveryOn: LOCKED, pendingSkip: true }), '2026-11-15', clock);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toMatchObject({
        code: 'SkipAlreadyScheduled',
        message: 'The delivery on Sun 15 Nov is already set to be skipped.',
        propertyName: 'cycleOn',
      });
    }
  });

  it('refuses while a pause or cancel is pending, or when not Active', () => {
    expect(() => skip(active({ pendingStatusChange: 'Pause' }), '2026-10-20', clock)).toThrow(
      'A active subscription cannot be skipped while it is about to pause.',
    );
    expect(() => skip(active({ status: 'Paused', nextDeliveryOn: null }), '2026-10-20', clock)).toThrow(
      'A paused subscription cannot be skipped.',
    );
  });
});

describe('pause, resume, cancel, withdraw', () => {
  it('pause: unlocked is immediate, locked is scheduled for after the locked delivery', () => {
    const now = pause(active(), clock);
    expect(now.state).toMatchObject({ status: 'Paused', nextDeliveryOn: null, pendingTerms: null });
    expect(describeChange(now, label)).toBe('Done. Your subscription is paused. Resume it any time.');

    const later = pause(active({ nextDeliveryOn: LOCKED }), clock);
    expect(later).toMatchObject({ appliedImmediately: false, appliesFromCycleOn: '2026-11-15', lockedCycleOn: LOCKED });
    expect(later.state.pendingStatusChange).toBe('Pause');
    expect(describeChange(later, label)).toBe(
      'Your delivery on Sun 18 Oct is already being prepared and will still arrive. Your subscription pauses after it, from Sun 15 Nov.',
    );
  });

  it('resume: from Paused with the earliest or a chosen date; a suspension is not liftable by the customer', () => {
    const paused = active({ status: 'Paused', nextDeliveryOn: null });
    const earliest = resume(paused, undefined, clock);
    expect(earliest.state).toMatchObject({ status: 'Active', nextDeliveryOn: '2026-10-19', nextDeliverySetOn: '2026-10-16' });
    expect(describeChange(earliest, label)).toBe('Done. Your subscription is back on. Your next delivery is on Mon 19 Oct.');
    expect(resume(paused, '2026-12-01', clock).state.nextDeliveryOn).toBe('2026-12-01');
    expect(() => resume(active({ status: 'Suspended', nextDeliveryOn: null }), undefined, clock)).toThrow(
      'This subscription was paused because the product is no longer available. Please contact the shop.',
    );
    expect(() => resume(active(), undefined, clock)).toThrow('A active subscription cannot be resumed.');
  });

  it('the first date must lie between the earliest date and today + 90 days', () => {
    expect(validFirstDate(null, clock)).toBe('2026-10-19');
    expect(validFirstDate('2027-01-14', clock)).toBe('2027-01-14');
    for (const bad of ['2026-10-18', '2027-01-15']) {
      try {
        validFirstDate(bad, clock);
        throw new Error('should have thrown');
      } catch (e) {
        expect(e).toMatchObject({
          code: 'InvalidFirstDeliveryDate',
          message: 'Choose a delivery date between Mon 19 Oct and Thu 14 Jan.',
          propertyName: 'FirstDeliveryOn',
        });
      }
    }
  });

  it('cancel: unlocked ends now; locked is scheduled; Paused and Suspended end now', () => {
    const now = cancel(active(), clock);
    expect(now.state).toMatchObject({ status: 'Cancelled', nextDeliveryOn: null, pendingTerms: null });
    expect(describeChange(now, label)).toBe('Done. Your subscription is cancelled.');

    const later = cancel(active({ nextDeliveryOn: LOCKED, pendingSkip: true }), clock);
    expect(later).toMatchObject({ appliedImmediately: false, appliesFromCycleOn: LOCKED, lockedCycleOn: LOCKED });
    expect(later.state).toMatchObject({ pendingStatusChange: 'Cancel', pendingSkip: false });
    expect(describeChange(later, label)).toBe(
      'Your delivery on Sun 18 Oct is already being prepared and will still arrive. Your subscription ends after it.',
    );

    expect(cancel(active({ status: 'Paused', nextDeliveryOn: null }), clock).state.status).toBe('Cancelled');
    expect(cancel(active({ status: 'Suspended', nextDeliveryOn: null }), clock).state.status).toBe('Cancelled');
    expect(() => cancel(active({ status: 'Cancelled', nextDeliveryOn: null }), clock)).toThrow(
      'A cancelled subscription cannot be cancelled.',
    );
    expect(() => cancel(active({ nextDeliveryOn: LOCKED, pendingStatusChange: 'Cancel' }), clock)).toThrow(
      'This subscription is already set to end after your next delivery.',
    );
  });

  it('withdraw: clears everything pending; nothing pending is NoPendingChange', () => {
    const change = withdrawPending(
      active({ pendingTerms: terms({ quantity: 4 }), pendingSkip: true, pendingStatusChange: 'Pause' }),
    );
    expect(change.state).toMatchObject({ pendingTerms: null, pendingSkip: false, pendingStatusChange: null });
    expect(describeChange(change, label)).toBe('Done. The scheduled change has been withdrawn.');
    try {
      withdrawPending(active());
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toMatchObject({ code: 'NoPendingChange', message: 'There is no scheduled change to withdraw.' });
    }
  });
});

describe('processCycle', () => {
  it('pending terms become current, the next date moves on and a pending skip is applied', () => {
    const processed = processCycle(
      active({ nextDeliveryOn: LOCKED, pendingTerms: terms({ intervalWeeks: 2 }), pendingSkip: true }),
      LOCKED,
    );
    expect(processed.terms.intervalWeeks).toBe(2);
    expect(processed).toMatchObject({ pendingTerms: null, pendingSkip: false, lastCycleOn: LOCKED, lastSkippedOn: '2026-11-01', nextDeliveryOn: '2026-11-15' });
  });

  it('a pending pause pauses, a pending cancel ends', () => {
    expect(processCycle(active({ pendingStatusChange: 'Pause' }), '2026-10-20')).toMatchObject({ status: 'Paused', nextDeliveryOn: null });
    expect(processCycle(active({ pendingStatusChange: 'Cancel' }), '2026-10-20')).toMatchObject({ status: 'Cancelled', nextDeliveryOn: null });
  });
});

describe('createTerms (SubscriptionTerms.Create)', () => {
  const base = { quantity: 1, intervalWeeks: 4, fulfilment: 'Delivery' as const, deliveryAddressId: ADDRESS, pickupBranchId: null, paymentMethod: 'BankTransfer' as const };

  it.each([
    [{ quantity: 0 }, 'InvalidSubscriptionQuantity', 'Quantity must be between 1 and 20.', 'Quantity'],
    [{ quantity: 21 }, 'InvalidSubscriptionQuantity', 'Quantity must be between 1 and 20.', 'Quantity'],
    [{ intervalWeeks: 3 }, 'InvalidSubscriptionInterval', 'Choose a delivery every 2, 4, 6, 8, 12 weeks.', 'IntervalWeeks'],
    [{ deliveryAddressId: null }, 'FulfilmentDetailsInvalid', 'A delivery needs a delivery address and no collection branch.', 'DeliveryAddressId'],
    [{ pickupBranchId: 'b1' }, 'FulfilmentDetailsInvalid', 'A delivery needs a delivery address and no collection branch.', 'DeliveryAddressId'],
    [{ fulfilment: 'Pickup' as const, paymentMethod: 'BankTransfer' as const }, 'FulfilmentDetailsInvalid', 'A collection needs a branch and no delivery address.', 'PickupBranchId'],
    [{ paymentMethod: 'PayAtPickup' as const }, 'PaymentMethodNotAllowedForFulfilment', 'Pay at the shop only goes with collection.', 'PaymentMethod'],
    [{ fulfilment: 'Pickup' as const, deliveryAddressId: null, pickupBranchId: 'b1', paymentMethod: 'CashOnDelivery' as const }, 'PaymentMethodNotAllowedForFulfilment', 'Cash on delivery only goes with delivery.', 'PaymentMethod'],
  ])('refuses %j', (over, code, message, propertyName) => {
    try {
      createTerms({ ...base, ...over });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toMatchObject({ code, message, propertyName });
    }
  });

  it('accepts a valid delivery and a valid pickup', () => {
    expect(createTerms(base)).toEqual(terms());
    expect(createTerms({ ...base, fulfilment: 'Pickup', deliveryAddressId: null, pickupBranchId: 'b1', paymentMethod: 'PayAtPickup' })).toMatchObject({ fulfilment: 'Pickup', pickupBranchId: 'b1' });
  });
});
