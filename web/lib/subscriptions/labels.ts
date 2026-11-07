import type {
  SubscriptionAction,
  SubscriptionCancellationReason,
  SubscriptionCustomerCancellationReason,
  SubscriptionCycle,
  SubscriptionCycleFailureReason,
  SubscriptionCycleOrderState,
  SubscriptionFulfilment,
  SubscriptionPaymentMethod,
  SubscriptionPendingStatusChange,
  SubscriptionStatus,
  SubscriptionSuspensionReason,
} from '../api/subscriptions';
import { SUBSCRIPTION_CUSTOMER_CANCELLATION_REASONS } from '../api/subscriptions';
import type { StaffSubscriptionAction, UnpaidSubscriptionGroup } from '../api/staff-subscriptions';
import { formatCommerceInstant, formatCycleDate } from './dates';

/**
 * `lib/subscriptions/labels.ts` — HO-P6 S0, §10.2. Plain-language labels for every enumeration the
 * subscription endpoints send. Texts that the server also writes are copied verbatim from
 * `Shared/Common/Constants/SubscriptionMessages.cs` (cited per label). An unknown value renders
 * "Unknown", never the raw code.
 */

export const UNKNOWN_LABEL = 'Unknown';

const lookup = (table: Readonly<Record<string, string>>, key: string | null | undefined): string =>
  key != null && Object.prototype.hasOwnProperty.call(table, key) ? table[key]! : UNKNOWN_LABEL;

/** Audience for the words that differ between the customer's screens and the shop's. */
export type SubscriptionAudience = 'customer' | 'staff';

// ---- status, suspension ---------------------------------------------------------------------------------

const STATUS_LABELS: Readonly<Record<SubscriptionStatus, string>> = {
  Active: 'Active',
  Paused: 'Paused',
  Suspended: 'Suspended',
  Cancelled: 'Cancelled',
};
export const subscriptionStatusLabel = (status: string | null | undefined): string =>
  lookup(STATUS_LABELS, status);

const SUSPENSION_STAFF_LABELS: Readonly<Record<SubscriptionSuspensionReason, string>> = {
  UnpaidCycles: 'Unpaid orders',
  ProductUnavailable: 'Product unavailable',
};
/** The staff filter and pill text. */
export const suspensionReasonLabel = (reason: string | null | undefined): string =>
  lookup(SUSPENSION_STAFF_LABELS, reason);

/**
 * The customer's banner. The server's sentence without the count (SubscriptionMessages.cs:34-37; the view
 * does not carry the threshold, backend gap BG-S9).
 */
const SUSPENSION_CUSTOMER_TEXTS: Readonly<Record<SubscriptionSuspensionReason, string>> = {
  UnpaidCycles:
    'This subscription was paused after unpaid orders. Please contact the shop to restart it.',
  ProductUnavailable:
    'This subscription was paused because the product is no longer available. Please contact the shop.',
};
export const suspensionReasonCustomerText = (reason: string | null | undefined): string =>
  lookup(SUSPENSION_CUSTOMER_TEXTS, reason);

// ---- cancellation reasons -------------------------------------------------------------------------------

/** Customer choices: OQ-5. Staff-only values: SubscriptionCancellationReason.cs:15-17. */
const CANCELLATION_LABELS: Readonly<Record<SubscriptionCancellationReason, string>> = {
  NoLongerNeeded: "I don't need it any more",
  TooMuchStock: 'I have too much at home',
  TastesDidNotSuit: "It wasn't to our taste",
  TooExpensive: 'It costs too much',
  SwitchingProduct: "I'm switching to another product",
  Other: 'Something else',
  StaffCancelled: 'Cancelled by the shop',
  CustomerMerged: 'Customer records merged',
  AccountDeleted: 'Account deleted',
};
export const cancellationReasonLabel = (reason: string | null | undefined): string =>
  lookup(CANCELLATION_LABELS, reason);

/** The six reasons a customer may pick, in the server's order (`IsCustomerChoice`, SubscriptionCancellationReason.cs:20). */
export const CUSTOMER_CANCELLATION_REASON_OPTIONS: ReadonlyArray<{
  value: SubscriptionCustomerCancellationReason;
  label: string;
}> = SUBSCRIPTION_CUSTOMER_CANCELLATION_REASONS.map((value) => ({
  value,
  label: CANCELLATION_LABELS[value],
}));

// ---- payment, fulfilment, interval ---------------------------------------------------------------------

/** SubscriptionMessages.cs:54-57 */
const PAYMENT_LABELS: Readonly<Record<SubscriptionPaymentMethod, string>> = {
  CashOnDelivery: 'Cash on delivery',
  BankTransfer: 'Bank transfer',
  PayAtPickup: 'Pay at the shop on collection',
};
export const subscriptionPaymentMethodLabel = (method: string | null | undefined): string =>
  lookup(PAYMENT_LABELS, method);

const FULFILMENT_LABELS: Readonly<Record<SubscriptionFulfilment, string>> = {
  Delivery: 'Deliver to me',
  Pickup: 'Collect from an outlet',
};
export const subscriptionFulfilmentLabel = (fulfilment: string | null | undefined): string =>
  lookup(FULFILMENT_LABELS, fulfilment);

/** `"Every 4 weeks"` (SubscriptionMessages.cs:59, capitalised). */
export const intervalLabel = (weeks: number): string => `Every ${weeks} weeks`;

/** `"2 × every 4 weeks"`. */
export const quantityAndIntervalLabel = (quantity: number, weeks: number): string =>
  `${quantity} × every ${weeks} weeks`;

// ---- cycles ---------------------------------------------------------------------------------------------

/** SubscriptionMessages.FailureReasonText, SubscriptionMessages.cs:46-52, copied verbatim. */
const FAILURE_TEXTS: Readonly<Record<SubscriptionCycleFailureReason, string>> = {
  OutOfStock: 'It was out of stock, so no order was placed. Your next delivery stays on schedule.',
  ProductUnavailable: 'The product is no longer available, so your subscription has been paused.',
  PaymentMethodUnavailable:
    'Your payment method is not available for this order. Please choose another in your subscription.',
  DeliveryUnavailable:
    'We could not deliver to your chosen address or collection point. Please check your subscription.',
  DeliveryAddressMissing:
    'Your delivery address is no longer in your address book. Please choose another in your subscription.',
  OrderRefused: 'We could not place the order. Please contact the shop.',
};
export const cycleFailureText = (reason: string | null | undefined): string =>
  lookup(FAILURE_TEXTS, reason);

const ORDER_STATE_CUSTOMER_LABELS: Readonly<Record<SubscriptionCycleOrderState, string>> = {
  AwaitingPayment: 'Awaiting your transfer',
  Confirmed: 'Confirmed',
  Expired: 'Expired unpaid',
  Cancelled: 'Cancelled',
  Delivered: 'Delivered',
  Refused: 'Refused on delivery',
};
const ORDER_STATE_STAFF_LABELS: Readonly<Record<SubscriptionCycleOrderState, string>> = {
  ...ORDER_STATE_CUSTOMER_LABELS,
  AwaitingPayment: 'Awaiting payment',
};

/**
 * The state of a cycle's order as text. For the customer, `AwaitingPayment` names the deadline when there
 * is one ("Awaiting your transfer: pay by Sun 18 Oct, 00:00 (Asia/Dhaka)").
 */
export function orderStateLabel(
  state: string | null | undefined,
  options: {
    audience: SubscriptionAudience;
    paymentExpiresOn?: string | null;
    commerceTimeZoneId?: string;
  },
): string {
  const table = options.audience === 'staff' ? ORDER_STATE_STAFF_LABELS : ORDER_STATE_CUSTOMER_LABELS;
  const label = lookup(table, state);
  if (
    state === 'AwaitingPayment' &&
    options.audience === 'customer' &&
    options.paymentExpiresOn &&
    options.commerceTimeZoneId
  ) {
    return `${label}: pay by ${formatCommerceInstant(options.paymentExpiresOn, options.commerceTimeZoneId)}`;
  }
  return label;
}

/** What happened at a cycle: the order's state for a `Generated` cycle, the server's sentence for a `Failed` one. */
export function cycleOutcomeText(
  cycle: Pick<
    SubscriptionCycle,
    'outcome' | 'failureReason' | 'orderState' | 'paymentExpiresOn'
  >,
  options: { audience: SubscriptionAudience; commerceTimeZoneId?: string },
): string {
  if (cycle.outcome === 'Failed') return cycleFailureText(cycle.failureReason);
  if (cycle.outcome === 'Generated') {
    return orderStateLabel(cycle.orderState, { ...options, paymentExpiresOn: cycle.paymentExpiresOn });
  }
  return UNKNOWN_LABEL;
}

// ---- pending, actions, groups ---------------------------------------------------------------------------

/**
 * A scheduled pause or cancel with the date the server names: "Pauses after the delivery on {nextDeliveryOn}",
 * "Ends after the delivery on {appliesFromCycleOn}". The caller passes the server's date (ADR-FE-110).
 */
export function pendingStatusChangeText(
  change: SubscriptionPendingStatusChange | string | null | undefined,
  dateText: string | null | undefined,
): string {
  if (change === 'Pause') return `Pauses after the delivery on ${formatCycleDate(dateText)}`;
  if (change === 'Cancel') return `Ends after the delivery on ${formatCycleDate(dateText)}`;
  return UNKNOWN_LABEL;
}

const ACTION_LABELS: Readonly<Record<Exclude<SubscriptionAction, 'Skip'>, string>> = {
  ChangeTerms: 'Change',
  Pause: 'Pause',
  Resume: 'Resume',
  Cancel: 'Cancel subscription',
  WithdrawPending: 'Withdraw scheduled changes',
};

/** A customer action button's label. `Skip` names the date the server says can be skipped. */
export function subscriptionActionLabel(
  action: SubscriptionAction | string,
  skippableCycleOn?: string | null,
): string {
  if (action === 'Skip') {
    return skippableCycleOn ? `Skip the delivery on ${formatCycleDate(skippableCycleOn)}` : 'Skip';
  }
  return lookup(ACTION_LABELS, action);
}

const STAFF_ACTION_LABELS: Readonly<Record<StaffSubscriptionAction, string>> = {
  Reinstate: 'Restart',
  Cancel: 'Cancel subscription',
};
export const staffSubscriptionActionLabel = (action: StaffSubscriptionAction | string): string =>
  lookup(STAFF_ACTION_LABELS, action);

const UNPAID_GROUP_LABELS: Readonly<Record<UnpaidSubscriptionGroup, string>> = {
  Suspended: 'Suspended',
  AtRisk: 'At risk',
};
export const unpaidGroupLabel = (group: string | null | undefined): string =>
  lookup(UNPAID_GROUP_LABELS, group);
