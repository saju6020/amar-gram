import { formatCommerceInstant, formatCycleDate, formatPercentText, isZeroPercent } from './dates';
import { pendingStatusChangeText, subscriptionPaymentMethodLabel } from './labels';

/**
 * `lib/subscriptions/copy.ts` — HO-P6 S0, §8.6. One module so every subscription screen says the same thing.
 * Every date and instant here is the server's, passed in; nothing is computed (ADR-FE-110, ADR-FE-112), and
 * there is no payment capture wording (ADR-FE-113): payment is by cash, transfer or at the shop.
 */

// ---- paying ---------------------------------------------------------------------------------------------

/** "No card needed. Each delivery creates an order that you pay for by {payment method text}." */
export function howPayingWorks(paymentMethod: string): string {
  return `No card needed. Each delivery creates an order that you pay for by ${paymentMethodPhrase(paymentMethod)}.`;
}

/**
 * The method as it reads after "pay for by". The server's texts (SubscriptionMessages.cs:54-57) are labels, and
 * "by pay at the shop on collection" does not read, so the third one is phrased as an action.
 */
function paymentMethodPhrase(paymentMethod: string): string {
  if (paymentMethod === 'PayAtPickup') return 'paying at the shop on collection';
  return subscriptionPaymentMethodLabel(paymentMethod).toLowerCase();
}

/** The line under the list heading (11.2.4). */
export const SUBSCRIPTIONS_LIST_INTRO =
  'Each delivery is a normal order: pay cash on delivery, by bank transfer or at the shop. No card is stored.';

// ---- the schedule ---------------------------------------------------------------------------------------

/** "Next delivery on {date}" (OQ-4). */
export const nextDeliveryLabel = (nextDeliveryOn: string): string =>
  `Next delivery on ${formatCycleDate(nextDeliveryOn)}`;

/** Help text for the next delivery (ADR-239). */
export const NEXT_DELIVERY_HELP = 'The order is placed on this date.';

/** "Changes made before {changeCutoffOn} apply to the delivery on {nextDeliveryOn}. After that, they start with the next one." */
export function cutoffSentence(input: {
  changeCutoffOn: string;
  nextDeliveryOn: string;
  commerceTimeZoneId: string;
}): string {
  return `Changes made before ${formatCommerceInstant(input.changeCutoffOn, input.commerceTimeZoneId)} apply to the delivery on ${formatCycleDate(input.nextDeliveryOn)}. After that, they start with the next one.`;
}

/** Shown only when the server says `isLocked`. */
export function lockedSentence(input: {
  nextDeliveryOn: string;
  followingDeliveryOn: string | null;
}): string {
  const base = `Your delivery on ${formatCycleDate(input.nextDeliveryOn)} is already being prepared.`;
  return input.followingDeliveryOn
    ? `${base} Changes now start with the delivery on ${formatCycleDate(input.followingDeliveryOn)}.`
    : base;
}

/** "We'll remind you {preChargeNoticeDays} days before each delivery." */
export const reminderSentence = (preChargeNoticeDays: number): string =>
  `We'll remind you ${preChargeNoticeDays} ${preChargeNoticeDays === 1 ? 'day' : 'days'} before each delivery.`;

/** The Subscribe form's date helper: the range in words plus the reminder lead. */
export function firstDeliveryHelp(input: {
  earliestFirstDeliveryOn: string;
  latestFirstDeliveryOn: string;
  preChargeNoticeDays: number;
}): string {
  return `Choose a date from ${formatCycleDate(input.earliestFirstDeliveryOn)} to ${formatCycleDate(input.latestFirstDeliveryOn)}. ${reminderSentence(input.preChargeNoticeDays)}`;
}

// ---- price ----------------------------------------------------------------------------------------------

/** `SubscriptionMessages.EstimateNote` (SubscriptionMessages.cs:23). The detail shows the server's `estimate.note` as sent. */
export const SERVER_ESTIMATE_NOTE = 'Delivery and tax are added when each order is placed.';

/** The Subscribe form's note: the server's sentence plus the pricing day (ADR-242). */
export const FORM_ESTIMATE_NOTE = `${SERVER_ESTIMATE_NOTE} Each order is priced on the day it is placed.`;

/** "Subscription discount: {n}% off every delivery"; `null` when the rate is zero (nothing to say). */
export function discountRateText(discountPercent: string): string | null {
  return isZeroPercent(discountPercent)
    ? null
    : `Subscription discount: ${formatPercentText(discountPercent)}% off every delivery`;
}

/** The product-page offer's label (ADR-FE-195). */
export function subscribeOfferLabel(discountPercent: string): string {
  return isZeroPercent(discountPercent)
    ? 'Subscribe'
    : `Subscribe & save ${formatPercentText(discountPercent)}%`;
}

export const ALREADY_SUBSCRIBED_TEXT = 'You already subscribe to this';

/** The estimate panel's discount row, "Subscription discount −10%". */
export const estimateDiscountLabel = (discountPercent: string): string =>
  `Subscription discount −${formatPercentText(discountPercent)}%`;

// ---- confirmations --------------------------------------------------------------------------------------

/** After a 201: "Subscribed. Your first delivery is on {date}." */
export const subscribedAlert = (nextDeliveryOn: string): string =>
  `Subscribed. Your first delivery is on ${formatCycleDate(nextDeliveryOn)}.`;

export const skipConfirmTitle = (skippableCycleOn: string): string =>
  `Skip the delivery on ${formatCycleDate(skippableCycleOn)}?`;

export const SKIP_LINK_STALE = 'That delivery can no longer be skipped.';
export const skipInsteadLabel = (skippableCycleOn: string): string =>
  `Skip the delivery on ${formatCycleDate(skippableCycleOn)} instead`;

export const PAUSE_CONFIRM_UNLOCKED =
  'Pause this subscription? No orders are placed until you resume.';
export const pauseConfirmLocked = (nextDeliveryOn: string): string =>
  `Your delivery on ${formatCycleDate(nextDeliveryOn)} is already being prepared and will still arrive. Your subscription pauses after it.`;
export const cancelConfirmLocked = (nextDeliveryOn: string): string =>
  `Your delivery on ${formatCycleDate(nextDeliveryOn)} is already being prepared and will still arrive. Your subscription ends after it.`;

/** The shop's cancel confirm when the delivery is locked (11.3.6). */
export const staffCancelLockedText = (nextDeliveryOn: string): string =>
  `The delivery on ${formatCycleDate(nextDeliveryOn)} is already being prepared and will still be placed; the subscription ends after it.`;

export const reinstateTitle = (customerName: string, productName: string): string =>
  `Restart ${customerName}'s subscription to ${productName}?`;
export const staffCancelTitle = (customerName: string, productName: string): string =>
  `Cancel ${customerName}'s subscription to ${productName}?`;
export const REINSTATE_DATE_HELP = 'Leave empty to restart from the earliest possible date.';
export const STAFF_ACTIONS_ROLE_NOTE =
  'Only a shop manager or an administrator can restart or cancel a subscription.';

// ---- warnings and empty states --------------------------------------------------------------------------

export const DELIVERY_ADDRESS_MISSING_TEXT = 'Your delivery address was removed. Choose another.';
export const PRODUCT_UNAVAILABLE_TEXT = "This product can't be bought right now";
export const EMPTY_SUBSCRIPTIONS_TEXT = 'No subscriptions yet. Look for Subscribe on a product page.';
export const PAUSED_NO_DELIVERIES_TEXT = 'Paused: no deliveries until you resume.';
export const EXPORT_TOO_MANY_ROWS = 'Too many rows to export. Narrow the filters.';

// ---- staff voice (HO-P6 S2, Amended (i)) ---------------------------------------------------------------

export const NO_DELIVERY_PAUSED = 'None while paused';
export const NO_DELIVERY_SUSPENDED = 'None while suspended';
export const NO_DELIVERY_CANCELLED = 'None: cancelled';
export const NEVER_RECORDED = 'Never: none recorded';
export const NOT_CANCELLED = 'Not cancelled';
export const SUSPENDED_NO_ORDERS = 'No orders are placed until staff restart it. The customer has been told.';
export const ADDRESS_REMOVED_STAFF = "The delivery address was removed from the customer's address book.";

/** Shown to staff when the server says `isLocked`: "The delivery on Tue 20 Oct is already being prepared." (the customer's version is `lockedSentence`). */
export const staffScheduleLockedText = (nextDeliveryOn: string): string =>
  `The delivery on ${formatCycleDate(nextDeliveryOn)} is already being prepared.`;

/** "3 unpaid in a row" (the Unpaid worklist) and the compact "3 unpaid" (the list). */
export const unpaidInARow = (streak: number): string => `${streak} unpaid in a row`;
export const unpaidShort = (streak: number): string => `${streak} unpaid`;

/** The Restart dialog's description and the sentence announced after it succeeds (the date is the server's). */
export const reinstateDescription = (customerName: string): string =>
  `The subscription becomes active again and orders resume. ${customerName} is told it has restarted.`;
export const reinstatedMessage = (nextDeliveryOn: string | null): string =>
  nextDeliveryOn ? `Restarted. ${nextDeliveryLabel(nextDeliveryOn)}.` : 'Restarted.';

/** The staff Cancel dialog's description when the delivery is not locked, and the sentences announced after it succeeds. */
export const staffCancelDescription = (customerName: string): string =>
  `No more orders will be placed. ${customerName} is told.`;
export const STAFF_CANCELLED_MESSAGE = 'Subscription cancelled.';
export const staffCancelScheduledMessage = (appliesFromCycleOn: string | null | undefined): string =>
  `Cancellation scheduled. ${pendingStatusChangeText('Cancel', appliesFromCycleOn)}.`;
