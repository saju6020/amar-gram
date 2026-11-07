import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SUBSCRIPTION_CANCELLATION_REASONS,
  SUBSCRIPTION_CUSTOMER_CANCELLATION_REASONS,
  SUBSCRIPTION_FULFILMENTS,
  SUBSCRIPTION_PAYMENT_METHODS,
  SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_SUSPENSION_REASONS,
} from '@/lib/api/subscriptions';
import {
  CUSTOMER_CANCELLATION_REASON_OPTIONS,
  UNKNOWN_LABEL,
  cancellationReasonLabel,
  cycleFailureText,
  cycleOutcomeText,
  orderStateLabel,
  pendingStatusChangeText,
  staffSubscriptionActionLabel,
  subscriptionActionLabel,
  subscriptionFulfilmentLabel,
  subscriptionPaymentMethodLabel,
  subscriptionStatusLabel,
  suspensionReasonCustomerText,
  suspensionReasonLabel,
  unpaidGroupLabel,
} from '@/lib/subscriptions/labels';
import { howPayingWorks } from '@/lib/subscriptions/copy';

/** HO-P6 U2: labels. The server's texts are compared with the C# source they are copied from. */
const ROOT = path.resolve(import.meta.dirname, '../../../..');
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const messages = read('src/Shared/AmarGram.Shared/Common/Constants/SubscriptionMessages.cs');
const enumNames = (file: string) =>
  [...read(`src/Shared/AmarGram.Shared/Common/Enums/${file}.cs`).matchAll(/public static readonly \w+ (\w+) = new\(/g)].map(
    (m) => m[1]!,
  );

describe('web enumeration unions list exactly the server values', () => {
  it.each([
    ['SubscriptionStatus', SUBSCRIPTION_STATUSES],
    ['SubscriptionSuspensionReason', SUBSCRIPTION_SUSPENSION_REASONS],
    ['SubscriptionCancellationReason', SUBSCRIPTION_CANCELLATION_REASONS],
    ['SubscriptionPaymentMethod', SUBSCRIPTION_PAYMENT_METHODS],
    ['SubscriptionFulfilment', SUBSCRIPTION_FULFILMENTS],
  ] as const)('%s', (file, values) => {
    expect([...values]).toEqual(enumNames(file));
  });
});

describe('labels', () => {
  it('every value of every enumeration has a non-empty label', () => {
    for (const v of SUBSCRIPTION_STATUSES) expect(subscriptionStatusLabel(v)).not.toBe(UNKNOWN_LABEL);
    for (const v of SUBSCRIPTION_SUSPENSION_REASONS) {
      expect(suspensionReasonLabel(v)).not.toBe(UNKNOWN_LABEL);
      expect(suspensionReasonCustomerText(v)).not.toBe(UNKNOWN_LABEL);
    }
    for (const v of SUBSCRIPTION_CANCELLATION_REASONS) expect(cancellationReasonLabel(v)).not.toBe(UNKNOWN_LABEL);
    for (const v of SUBSCRIPTION_PAYMENT_METHODS) expect(subscriptionPaymentMethodLabel(v)).not.toBe(UNKNOWN_LABEL);
    for (const v of SUBSCRIPTION_FULFILMENTS) expect(subscriptionFulfilmentLabel(v)).not.toBe(UNKNOWN_LABEL);
    for (const v of enumNames('SubscriptionCycleFailureReason')) expect(cycleFailureText(v)).not.toBe(UNKNOWN_LABEL);
    for (const v of enumNames('SubscriptionCycleOrderState')) {
      expect(orderStateLabel(v, { audience: 'customer' })).not.toBe(UNKNOWN_LABEL);
      expect(orderStateLabel(v, { audience: 'staff' })).not.toBe(UNKNOWN_LABEL);
    }
    for (const v of ['ChangeTerms', 'Skip', 'Pause', 'Resume', 'Cancel', 'WithdrawPending']) {
      expect(subscriptionActionLabel(v, '2026-10-20')).not.toBe(UNKNOWN_LABEL);
    }
    for (const v of ['Reinstate', 'Cancel']) expect(staffSubscriptionActionLabel(v)).not.toBe(UNKNOWN_LABEL);
    for (const v of ['Suspended', 'AtRisk']) expect(unpaidGroupLabel(v)).not.toBe(UNKNOWN_LABEL);
  });

  it('the customer reasons are exactly the six IsCustomerChoice ones, in the server order', () => {
    const names = enumNames('SubscriptionCancellationReason');
    const customerCount = Number(/Value <= Other\.Value/.test(read('src/Shared/AmarGram.Shared/Common/Enums/SubscriptionCancellationReason.cs')) && names.indexOf('Other') + 1);
    expect(customerCount).toBe(6);
    expect([...SUBSCRIPTION_CUSTOMER_CANCELLATION_REASONS]).toEqual(names.slice(0, 6));
    expect(CUSTOMER_CANCELLATION_REASON_OPTIONS.map((o) => o.value)).toEqual(names.slice(0, 6));
    expect(CUSTOMER_CANCELLATION_REASON_OPTIONS.every((o) => o.label.length > 0)).toBe(true);
    expect(cancellationReasonLabel('StaffCancelled')).toBe('Cancelled by the shop');
  });

  it('failure and payment texts equal SubscriptionMessages.cs', () => {
    for (const reason of enumNames('SubscriptionCycleFailureReason')) {
      expect(messages).toContain(`"${cycleFailureText(reason)}"`);
    }
    for (const method of SUBSCRIPTION_PAYMENT_METHODS) {
      expect(messages).toContain(`"${subscriptionPaymentMethodLabel(method)}"`);
    }
    expect(messages).toContain('This subscription was paused because the product is no longer available. Please contact the shop.');
    expect(suspensionReasonCustomerText('ProductUnavailable')).toBe(
      'This subscription was paused because the product is no longer available. Please contact the shop.',
    );
    // The UnpaidCycles sentence is the server's without the count (BG-S9).
    expect(messages).toContain('Please contact the shop to restart it.');
    expect(suspensionReasonCustomerText('UnpaidCycles')).toBe(
      'This subscription was paused after unpaid orders. Please contact the shop to restart it.',
    );
  });

  it('order state, outcome and pending texts', () => {
    expect(
      orderStateLabel('AwaitingPayment', {
        audience: 'customer',
        paymentExpiresOn: '2026-10-17T18:00:00Z',
        commerceTimeZoneId: 'Asia/Dhaka',
      }),
    ).toBe('Awaiting your transfer: pay by Sun 18 Oct, 00:00 (Asia/Dhaka)');
    expect(orderStateLabel('AwaitingPayment', { audience: 'staff' })).toBe('Awaiting payment');
    expect(orderStateLabel('Refused', { audience: 'customer' })).toBe('Refused on delivery');
    expect(
      cycleOutcomeText(
        { outcome: 'Failed', failureReason: 'OutOfStock', orderState: null, paymentExpiresOn: null },
        { audience: 'customer' },
      ),
    ).toBe(cycleFailureText('OutOfStock'));
    expect(pendingStatusChangeText('Pause', '2026-10-20')).toBe('Pauses after the delivery on Tue 20 Oct');
    expect(pendingStatusChangeText('Cancel', '2026-10-20')).toBe('Ends after the delivery on Tue 20 Oct');
    expect(subscriptionActionLabel('Skip', '2026-10-20')).toBe('Skip the delivery on Tue 20 Oct');
  });

  it('an unknown value renders "Unknown", never the raw code', () => {
    expect(subscriptionStatusLabel('Frozen')).toBe('Unknown');
    expect(subscriptionPaymentMethodLabel('Card')).toBe('Unknown');
    expect(cancellationReasonLabel(null)).toBe('Unknown');
    expect(cycleFailureText('Gremlins')).toBe('Unknown');
    expect(orderStateLabel('toString', { audience: 'staff' })).toBe('Unknown');
    expect(subscriptionActionLabel('Teleport')).toBe('Unknown');
  });

  it('the payment note names the method in plain words and never a card', () => {
    expect(howPayingWorks('BankTransfer')).toBe(
      'No card needed. Each delivery creates an order that you pay for by bank transfer.',
    );
    expect(howPayingWorks('CashOnDelivery')).toContain('cash on delivery');
    expect(howPayingWorks('PayAtPickup')).toContain('at the shop on collection');
  });
});
