import {
  ApiConflictError,
  ApiNotFoundError,
  ApiValidationError,
} from '../api/client';
import { describeApiError } from '../api/errors';
import type { ValidationError } from '../api/types';

/**
 * `lib/subscriptions/errors.ts` — HO-P6 S0, §8.5, NFR-USA-4. The subscription error mapper.
 *
 * Two 400 shapes reach the client (`client.ts` turns both into `ApiValidationError`):
 *  - the usual `ValidationResponse` (`errors[{ propertyName, errorMessage, errorCode }]`), from FluentValidation
 *    or a returned violation (SubscriptionHandlerSupport.cs:18-32);
 *  - the controller's plain `{ "error": "…" }` for a bad enumeration value, refused before the command
 *    (CustomerSubscriptionsController.cs:56, 141-142, 180, 186; StaffSubscriptionsController.cs:143-145).
 *    There `response.errors` is `undefined`. The UI never sends a bad enumeration, so seeing it means a client
 *    defect; it gets a generic sentence and must never crash `describeApiError`, which reads `errors.length`.
 *
 * The server's `errorMessage` is preferred; `errorCode` is read only to pick the fallback in
 * `SUBSCRIPTION_CODE_MESSAGES` and is never part of any output.
 */

export const GENERIC_SAVE_MESSAGE =
  "We couldn't save that. Please check your choices and try again.";
export const SUBSCRIPTION_NOT_FOUND_MESSAGE = "We couldn't find that subscription.";
export const PRODUCT_NOT_FOUND_MESSAGE = "We couldn't find that product.";
export const SUBSCRIPTION_STALE_MESSAGE =
  "This subscription changed in another window. We've loaded the latest.";

/**
 * Violation code → fallback sentence (§10.3). The first block copies the server's text where
 * `SubscriptionMessages.cs` has one (cited); the rest are short plain sentences written for this pass.
 */
export const SUBSCRIPTION_CODE_MESSAGES: Readonly<Record<string, string>> = {
  // Server sentences (Shared/Common/Constants/SubscriptionMessages.cs)
  SkuNotSubscribable: 'This product is not available to subscribe to right now.', // :17
  SubscriptionAlreadyExists:
    'You already have a subscription for this product. You can change it from your subscriptions.', // :13
  SubscriptionLimitReached:
    'You have reached the limit of live subscriptions. Cancel one to start another.', // :14
  NoChangeRequested: 'Nothing was changed - these are already the terms of your subscription.', // :15
  NoPendingChange: 'There is no scheduled change to withdraw.', // :16
  ReinstatementReasonRequired: 'Give a reason for restarting this subscription.', // :19
  SubscriptionSuspended:
    'This subscription was paused because the product is no longer available. Please contact the shop.', // :37
  // Written for this pass
  InvalidSubscriptionQuantity: 'Choose a quantity between 1 and 20.',
  InvalidSubscriptionInterval: 'Choose how often you want deliveries from the list.',
  FulfilmentDetailsInvalid:
    'Choose a delivery address, or an outlet to collect from, to match how you want to receive it.',
  PaymentMethodNotAllowedForFulfilment:
    "That payment method isn't available for this way of receiving your order.",
  InvalidFirstDeliveryDate: 'Choose a delivery date within the range shown.',
  InvalidSubscriptionTransition: "That change isn't possible for this subscription right now.",
  SubscriptionCannotBeReinstated: 'Only a suspended subscription can be restarted.',
  CycleNoLongerSkippable: 'That delivery can no longer be skipped.',
  SkipAlreadyScheduled: 'That delivery is already set to be skipped.',
  CycleNotDue: "That delivery isn't due yet.",
  DeliveryAddressNotFound: 'Choose a delivery address from your address book.',
  AddressOutsideServedZones:
    "We don't deliver to that address yet. Choose another address, or collect from an outlet.",
  PickupBranchUnavailable: "That outlet isn't available for collection. Choose another.",
  PaymentMethodUnavailable: "That payment method isn't available for this order. Choose another.",
  DeliveryTaxNotConfigured:
    "We can't deliver to that address right now. Please try again later or contact the shop.",
  ServiceLevelUnavailable:
    "We can't deliver to that address right now. Please try again later or contact the shop.",
  CancellationReasonRequired: 'Give a reason for cancelling this subscription.',
  StaleVersion: SUBSCRIPTION_STALE_MESSAGE,
  InvalidPageSize: "That page size isn't available.",
  InvalidPageNumber: "That page isn't available.",
};

/** The fields a subscription form or dialog can show an error on (the server's property names, camelCased). */
export const SUBSCRIPTION_FIELDS = [
  'quantity',
  'intervalWeeks',
  'fulfilment',
  'deliveryAddressId',
  'pickupBranchId',
  'paymentMethod',
  'firstDeliveryOn',
  'cycleOn',
  'reason',
  'note',
  'skuId',
] as const;
export type SubscriptionField = (typeof SUBSCRIPTION_FIELDS)[number];

/** Field errors by name, plus `root` for anything that is not one of the fields. */
export type SubscriptionFieldErrors = Partial<Record<SubscriptionField | 'root', string>>;

const FIELD_BY_LOWERCASE: ReadonlyMap<string, SubscriptionField> = new Map(
  SUBSCRIPTION_FIELDS.map((field) => [field.toLowerCase(), field]),
);

/** `ValidationResponse.errors` when it really is an array (the `{ error }` 400 has none). */
function errorList(error: ApiValidationError | ApiConflictError): ValidationError[] {
  const errors: unknown = error.response?.errors;
  return Array.isArray(errors) ? (errors as ValidationError[]) : [];
}

/** The sentence for one error: the server's text, else the code's fallback, else the generic one. */
function sentenceFor(validationError: ValidationError): string {
  return (
    validationError.errorMessage?.trim() ||
    SUBSCRIPTION_CODE_MESSAGES[validationError.errorCode] ||
    GENERIC_SAVE_MESSAGE
  );
}

/** The violation codes of a refusal (for logic such as "re-read the payment methods"). Never rendered. */
export function subscriptionViolationCodes(error: unknown): string[] {
  if (error instanceof ApiValidationError || error instanceof ApiConflictError) {
    return errorList(error).map((entry) => entry.errorCode);
  }
  return [];
}

export function hasSubscriptionCode(error: unknown, code: string): boolean {
  return subscriptionViolationCodes(error).includes(code);
}

export interface DescribeSubscriptionErrorOptions {
  /** What a 404 was about; the Subscribe page asks about a product. */
  subject?: 'subscription' | 'product';
}

/** One plain-language sentence (or a few joined) for an error, for an alert or toast. */
export function describeSubscriptionError(
  error: unknown,
  options: DescribeSubscriptionErrorOptions = {},
): string {
  if (error instanceof ApiNotFoundError) {
    return options.subject === 'product'
      ? PRODUCT_NOT_FOUND_MESSAGE
      : SUBSCRIPTION_NOT_FOUND_MESSAGE;
  }
  if (error instanceof ApiConflictError) return SUBSCRIPTION_STALE_MESSAGE;
  if (error instanceof ApiValidationError) {
    const errors = errorList(error);
    if (errors.length === 0) return GENERIC_SAVE_MESSAGE;
    return [...new Set(errors.map(sentenceFor))].join(' ');
  }
  // 403, offline and anything else: the shared sentences.
  return describeApiError(error, SUBSCRIPTION_CODE_MESSAGES);
}

/**
 * Field-by-field errors for a form or dialog. `propertyName` is matched case-insensitively (`Quantity`,
 * `IntervalWeeks`, `Fulfilment`, `DeliveryAddressId`, `PickupBranchId`, `PaymentMethod`, `FirstDeliveryOn`,
 * `CycleOn`, `Reason`, `Note`, `SkuId`); an error on any other property, the `{ error }` 400, a 404, a 409 and
 * a 403 go under `root`.
 */
export function subscriptionFieldErrors(
  error: unknown,
  options: DescribeSubscriptionErrorOptions = {},
): SubscriptionFieldErrors {
  if (!(error instanceof ApiValidationError)) {
    return { root: describeSubscriptionError(error, options) };
  }
  const errors = errorList(error);
  if (errors.length === 0) return { root: GENERIC_SAVE_MESSAGE };

  const result: SubscriptionFieldErrors = {};
  for (const entry of errors) {
    const field = FIELD_BY_LOWERCASE.get((entry.propertyName ?? '').toLowerCase()) ?? 'root';
    const sentence = sentenceFor(entry);
    const existing = result[field];
    if (!existing) result[field] = sentence;
    else if (!existing.includes(sentence)) result[field] = `${existing} ${sentence}`;
  }
  return result;
}
