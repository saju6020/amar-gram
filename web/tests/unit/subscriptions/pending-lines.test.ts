import { describe, expect, it } from 'vitest';
import { pendingChangeLines, termsSummaryText } from '@/lib/subscriptions/copy';
import type { SubscriptionPending, SubscriptionTerms } from '@/lib/api/subscriptions';

/** HO-P6 Amended (k): the one builder of the scheduled-change lines, in the customer's and the staff's voice. */
const terms: SubscriptionTerms = {
  quantity: 3,
  intervalWeeks: 4,
  fulfilment: 'Delivery',
  deliveryAddress: { id: 'a', label: 'Home', line1: 'House 7', city: 'Dhaka' },
  deliveryAddressMissing: false,
  pickupBranch: null,
  paymentMethod: 'BankTransfer',
};
const pending = (change: Partial<SubscriptionPending>): SubscriptionPending => ({
  terms: null,
  skip: false,
  statusChange: null,
  appliesFromCycleOn: '2026-10-20',
  ...change,
});

describe('pendingChangeLines', () => {
  it('is empty without anything pending', () => {
    expect(pendingChangeLines({ pending: null, nextDeliveryOn: null }, 'customer')).toEqual([]);
    expect(pendingChangeLines({ pending: null, nextDeliveryOn: null }, 'staff')).toEqual([]);
  });

  it('new terms: the customer sees the full terms, staff the compact "From <date>:" line', () => {
    const view = { pending: pending({ terms }), nextDeliveryOn: '2026-10-06' };
    expect(pendingChangeLines(view, 'customer')).toEqual([
      'New terms from the delivery on Tue 20 Oct: 3 × every 4 weeks, Deliver to Home: House 7, Dhaka, Bank transfer',
    ]);
    expect(pendingChangeLines(view, 'staff')).toEqual([
      'From Tue 20 Oct: 3 × every 4 weeks, deliver to me, bank transfer',
    ]);
  });

  it('a skip names the date in both voices', () => {
    const view = { pending: pending({ skip: true }), nextDeliveryOn: '2026-10-06' };
    expect(pendingChangeLines(view, 'customer')).toEqual(['The delivery on Tue 20 Oct is skipped']);
    expect(pendingChangeLines(view, 'staff')).toEqual(['Scheduled: Skip the delivery on Tue 20 Oct']);
  });

  it('a pause names the next delivery, an end names the date the server gives, the same in both voices', () => {
    const pause = { pending: pending({ statusChange: 'Pause' }), nextDeliveryOn: '2026-10-06' };
    const end = { pending: pending({ statusChange: 'Cancel' }), nextDeliveryOn: '2026-10-06' };
    for (const voice of ['customer', 'staff'] as const) {
      expect(pendingChangeLines(pause, voice)).toEqual(['Pauses after the delivery on Tue 6 Oct']);
      expect(pendingChangeLines(end, voice)).toEqual(['Ends after the delivery on Tue 20 Oct']);
    }
  });

  it('lists several changes in the order terms, skip, status', () => {
    const view = { pending: pending({ terms, skip: true, statusChange: 'Cancel' }), nextDeliveryOn: '2026-10-06' };
    expect(pendingChangeLines(view, 'customer')).toHaveLength(3);
    expect(termsSummaryText(terms)).toContain('Bank transfer');
  });
});
