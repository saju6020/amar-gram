import { describe, expect, it } from 'vitest';
import {
  ApiConflictError,
  ApiForbiddenError,
  ApiNotFoundError,
  ApiValidationError,
} from '@/lib/api/client';
import { PERMISSION_DENIED_MESSAGE } from '@/lib/api/errors';
import {
  GENERIC_SAVE_MESSAGE,
  SUBSCRIPTION_CODE_MESSAGES,
  SUBSCRIPTION_STALE_MESSAGE,
  describeSubscriptionError,
  hasSubscriptionCode,
  subscriptionFieldErrors,
} from '@/lib/subscriptions/errors';

/** HO-P6 U7: the subscription error mapper. */
const validation = (errors: Array<{ propertyName: string; errorCode: string; errorMessage: string }>) =>
  new ApiValidationError({
    isValid: false,
    errors: errors.map((e) => ({ ...e, resourceName: 'Subscription' })),
  });

/** The controller's plain `{ error }` 400: `response.errors` is undefined. */
const plainError = () =>
  new ApiValidationError({ error: 'fulfilment must be Delivery or Pickup.' } as never);

describe('describeSubscriptionError / subscriptionFieldErrors', () => {
  it('maps a ValidationResponse per field, case-insensitively, with the server text', () => {
    const error = validation([
      { propertyName: 'Quantity', errorCode: 'InvalidSubscriptionQuantity', errorMessage: 'Quantity must be between 1 and 20.' },
      { propertyName: 'deliveryaddressid', errorCode: 'AddressOutsideServedZones', errorMessage: 'We do not deliver there.' },
      { propertyName: 'FirstDeliveryOn', errorCode: 'InvalidFirstDeliveryDate', errorMessage: 'Choose a delivery date between Mon 9 Nov and Sat 6 Feb.' },
    ]);
    expect(subscriptionFieldErrors(error)).toEqual({
      quantity: 'Quantity must be between 1 and 20.',
      deliveryAddressId: 'We do not deliver there.',
      firstDeliveryOn: 'Choose a delivery date between Mon 9 Nov and Sat 6 Feb.',
    });
  });

  it('falls back to the code map when the server sends no text, and to root for an unknown property', () => {
    const error = validation([
      { propertyName: 'PaymentMethod', errorCode: 'PaymentMethodUnavailable', errorMessage: '' },
      { propertyName: 'Status', errorCode: 'InvalidSubscriptionTransition', errorMessage: '' },
    ]);
    expect(subscriptionFieldErrors(error)).toEqual({
      paymentMethod: SUBSCRIPTION_CODE_MESSAGES.PaymentMethodUnavailable,
      root: SUBSCRIPTION_CODE_MESSAGES.InvalidSubscriptionTransition,
    });
    expect(describeSubscriptionError(error)).toContain(SUBSCRIPTION_CODE_MESSAGES.PaymentMethodUnavailable);
  });

  it('an unknown code with no text gets the generic sentence', () => {
    const error = validation([{ propertyName: 'Note', errorCode: 'NeverHeardOfIt', errorMessage: '' }]);
    expect(subscriptionFieldErrors(error)).toEqual({ note: GENERIC_SAVE_MESSAGE });
  });

  it('the { error } 400 (no errors array) gives the generic sentence and does not throw', () => {
    const error = plainError();
    expect(() => describeSubscriptionError(error)).not.toThrow();
    expect(describeSubscriptionError(error)).toBe(
      "We couldn't save that. Please check your choices and try again.",
    );
    expect(subscriptionFieldErrors(error)).toEqual({ root: GENERIC_SAVE_MESSAGE });
    expect(hasSubscriptionCode(error, 'anything')).toBe(false);
  });

  it('404, 409 and 403 get their sentences', () => {
    expect(describeSubscriptionError(new ApiNotFoundError())).toBe("We couldn't find that subscription.");
    expect(describeSubscriptionError(new ApiNotFoundError(), { subject: 'product' })).toBe("We couldn't find that product.");
    expect(describeSubscriptionError(new ApiConflictError())).toBe(SUBSCRIPTION_STALE_MESSAGE);
    expect(SUBSCRIPTION_STALE_MESSAGE).toBe("This subscription changed in another window. We've loaded the latest.");
    expect(describeSubscriptionError(new ApiForbiddenError({}))).toBe(PERMISSION_DENIED_MESSAGE);
    expect(subscriptionFieldErrors(new ApiNotFoundError())).toEqual({ root: "We couldn't find that subscription." });
  });

  it('never puts an errorCode in any output', () => {
    const codes = ['SubscriptionAlreadyExists', 'CycleNoLongerSkippable', 'StaleVersion'];
    const error = validation(codes.map((errorCode) => ({ propertyName: 'SkuId', errorCode, errorMessage: '' })));
    const output = JSON.stringify([describeSubscriptionError(error), subscriptionFieldErrors(error)]);
    for (const code of codes) expect(output).not.toContain(code);
    expect(hasSubscriptionCode(error, 'CycleNoLongerSkippable')).toBe(true);
  });

  it('has a plain sentence for every code the handover lists', () => {
    for (const code of [
      'SkuNotSubscribable', 'InvalidSubscriptionQuantity', 'InvalidSubscriptionInterval', 'FulfilmentDetailsInvalid',
      'PaymentMethodNotAllowedForFulfilment', 'InvalidFirstDeliveryDate', 'SubscriptionAlreadyExists', 'SubscriptionLimitReached',
      'InvalidSubscriptionTransition', 'SubscriptionSuspended', 'SubscriptionCannotBeReinstated', 'ReinstatementReasonRequired',
      'NoChangeRequested', 'NoPendingChange', 'CycleNoLongerSkippable', 'SkipAlreadyScheduled', 'CycleNotDue',
      'DeliveryAddressNotFound', 'AddressOutsideServedZones', 'PickupBranchUnavailable', 'PaymentMethodUnavailable',
      'DeliveryTaxNotConfigured', 'ServiceLevelUnavailable', 'CancellationReasonRequired', 'StaleVersion', 'InvalidPageSize', 'InvalidPageNumber',
    ]) {
      expect(SUBSCRIPTION_CODE_MESSAGES[code], code).toBeTruthy();
    }
  });
});
