import {
  formatCommerceInstant,
  formatCommerceInstantLong,
  formatCycleDate,
  formatPercentText,
  isZeroPercent,
} from './dates';
import type { SubscriptionPending, SubscriptionTerms, SubscriptionView } from '../api/subscriptions';
import {
  pendingStatusChangeText,
  quantityAndIntervalLabel,
  subscriptionActionLabel,
  subscriptionFulfilmentLabel,
  subscriptionPaymentMethodLabel,
  suspensionReasonCustomerText,
} from './labels';

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

// ---- customer screens (HO-P6 S1, Amended (k)) -------------------------------------------------------------
// The customer's sentences that used to be written inline in `components/subscriptions/**`. Every date is the server's.

export const SUBSCRIBE_PAGE_INTRO =
  'A repeat delivery of this product. Change, skip, pause or cancel whenever you like.';
export const OFFER_HELP = 'Get this on repeat. Skip, pause or cancel any time.';
export const SUBSCRIBE_NOT_OFFERED_TITLE = "This product can't be subscribed to right now.";

export const FULFILMENT_DELIVERY_HINT = 'We bring each order to your door.';
export const FULFILMENT_PICKUP_HINT = 'Pick each order up when it is ready.';
export const ADDRESSES_FAILED_TEXT = 'We couldn’t load your addresses just now. You can add one below.';
export const NO_SAVED_ADDRESS_TEXT = 'You haven’t saved an address yet.';
export const OUTLETS_LOADING_TEXT = 'Loading outlets…';
export const NO_OUTLET_TEXT = 'No outlet is open for collection right now.';
export const PAYMENT_HEADING = 'How you’ll pay for each order';
export const PAY_CHOOSE_ADDRESS = 'Choose a delivery address to see how you can pay.';
export const PAY_CHOOSE_OUTLET = 'Choose an outlet to see how you can pay.';
export const PAY_CHECKING = 'Checking how you can pay…';
export const PAY_CHECK_FAILED = 'We couldn’t check how you can pay just now. Please try again.';
export const CHOOSE_OUTLET_ERROR = 'Choose an outlet to collect from.';
export const CHOOSE_PAYMENT_ERROR = "Choose how you'll pay for each order.";
export const SUBSCRIBE_FAILED_TITLE = 'We couldn’t start your subscription';
export const paymentSwapNote = (fromLabel: string, toLabel: string): string =>
  `${fromLabel} isn't available for this order, so we chose ${toLabel}.`;

export const NO_CANCELLED_TITLE = 'No cancelled subscriptions.';
export const NO_CANCELLED_TEXT = 'Subscriptions you cancel are kept here.';
export const LIST_PAST_END_TEXT = 'That page is past the end of your list.';
export const SUSPENDED_SEE_WHY = 'Suspended: see why';
export const NO_DELIVERY_SCHEDULED = 'No delivery is scheduled';
export const endedOnText = (instantText: string): string => `Ended on ${instantText}`;
export const waitingForTransfer = (payBy: string): string => `Waiting for your transfer: pay by ${payBy}`;
export const changesScheduledFrom = (date: string | null | undefined): string =>
  date ? `Changes scheduled from ${formatCycleDate(date)}` : 'Changes are scheduled';

export const CHOOSE_ANOTHER_ADDRESS = 'Choose another address';
export const NO_CYCLES_TEXT = 'No orders yet. Your first one is placed on the delivery date.';
export const MORE_CYCLES_FAILED = 'We couldn’t load more deliveries just now.';
export const MORE_CYCLES_LOADING = 'Loading more…';
export const OPTIONS_LOADING = 'Loading your options…';
export const OPTIONS_FAILED = 'We couldn’t load your options just now. Close this and try again.';

export const CHANGE_TERMS_DESCRIPTION = 'Your changes apply from the delivery named when you save.';
export const SKIP_DESCRIPTION = "We won't place an order for this delivery. Your other deliveries stay as they are.";
export const RESUME_DESCRIPTION =
  'Orders start again. Choose the date of the first delivery, or leave it empty for the earliest we can do.';
export const RESUME_DATE_FALLBACK_HELP = 'Leave it empty to start with the earliest delivery.';
export const CANCEL_UNLOCKED = 'Your subscription ends now and no more orders are placed.';
export const CANCEL_REASON_REQUIRED = 'Choose a reason so we know how to improve.';
export const CANCEL_NOTE_LABEL = 'Anything else you’d like to tell us? (optional)';
export const WITHDRAW_DESCRIPTION =
  'These changes will not happen, and your subscription carries on as it is now:';

/** Where an order goes: the address's label and street, or the outlet's name. */
export function placeText(terms: SubscriptionTerms): string {
  if (terms.fulfilment === 'Pickup') {
    return terms.pickupBranch ? `Collect from ${terms.pickupBranch.name}` : 'Collect from an outlet';
  }
  if (terms.deliveryAddress) {
    const { label, line1, city } = terms.deliveryAddress;
    return `Deliver to ${label}: ${[line1, city].filter(Boolean).join(', ')}`;
  }
  return 'Delivery address needed';
}

/** "2 × every 4 weeks, Deliver to Home: House 12, Dhaka, Cash on delivery". */
export function termsSummaryText(terms: SubscriptionTerms): string {
  return [
    quantityAndIntervalLabel(terms.quantity, terms.intervalWeeks),
    placeText(terms),
    subscriptionPaymentMethodLabel(terms.paymentMethod),
  ].join(', ');
}

/**
 * The one builder of the scheduled-change lines, for both voices (the customer's detail and withdraw dialog, the staff schedule
 * panel). Each line names the date the server gives (`pending.appliesFromCycleOn`; a pause names `nextDeliveryOn`):
 *   customer: "New terms from the delivery on Tue 20 Oct: …", "The delivery on Tue 20 Oct is skipped";
 *   staff:    "From Tue 20 Oct: …", "Scheduled: Skip the delivery on Tue 20 Oct".
 * A pause or an end is `pendingStatusChangeText` in both. Nothing is computed (ADR-FE-110).
 */
export function pendingChangeLines(
  view: { pending: SubscriptionPending | null; nextDeliveryOn: string | null },
  voice: 'customer' | 'staff',
): string[] {
  const pending = view.pending;
  if (!pending) return [];
  const from = formatCycleDate(pending.appliesFromCycleOn);
  const lines: string[] = [];
  if (pending.terms) {
    const t = pending.terms;
    lines.push(
      voice === 'customer'
        ? `New terms from the delivery on ${from}: ${termsSummaryText(t)}`
        : `From ${from}: ${quantityAndIntervalLabel(t.quantity, t.intervalWeeks)}, ${subscriptionFulfilmentLabel(t.fulfilment).toLowerCase()}, ${subscriptionPaymentMethodLabel(t.paymentMethod).toLowerCase()}`,
    );
  }
  if (pending.skip) {
    lines.push(
      voice === 'customer'
        ? `The delivery on ${from} is skipped`
        : `Scheduled: ${subscriptionActionLabel('Skip', pending.appliesFromCycleOn)}`,
    );
  }
  if (pending.statusChange) {
    lines.push(
      pendingStatusChangeText(
        pending.statusChange,
        pending.statusChange === 'Cancel' ? pending.appliesFromCycleOn : view.nextDeliveryOn,
      ),
    );
  }
  return lines;
}

/** The line on a card (and the detail's header) that says when the next delivery is, or why there is none. */
export function nextDeliveryLine(view: SubscriptionView): string {
  if (view.status === 'Active' && view.nextDeliveryOn) return nextDeliveryLabel(view.nextDeliveryOn);
  if (view.status === 'Paused') return PAUSED_NO_DELIVERIES_TEXT;
  if (view.status === 'Suspended') return SUSPENDED_SEE_WHY;
  if (view.status === 'Cancelled') {
    return endedOnText(formatCommerceInstantLong(view.cancelledOn, view.commerceTimeZoneId));
  }
  return NO_DELIVERY_SCHEDULED;
}

/**
 * The one warning on a card, in the order of §11.2.4: suspension; a removed address; a transfer still to pay; scheduled
 * changes; a product that cannot be bought. `null` when none applies.
 */
export function warningLine(view: SubscriptionView): string | null {
  if (view.status === 'Suspended') return suspensionReasonCustomerText(view.suspensionReason);
  if (view.terms.deliveryAddressMissing) return DELIVERY_ADDRESS_MISSING_TEXT;
  const last = view.lastCycle;
  if (last?.orderState === 'AwaitingPayment' && last.paymentExpiresOn) {
    return waitingForTransfer(formatCommerceInstant(last.paymentExpiresOn, view.commerceTimeZoneId));
  }
  if (view.pending) return changesScheduledFrom(view.pending.appliesFromCycleOn);
  if (!view.product.isAvailable) return PRODUCT_UNAVAILABLE_TEXT;
  return null;
}

/** The customer dialogs' headings, each naming the product (UI-3). */
export const pauseTitle = (productName: string): string => `Pause ${productName}?`;
export const cancelTitle = (productName: string): string => `Cancel ${productName}?`;
export const resumeTitle = (productName: string): string => `Resume ${productName}?`;
export const changeTitle = (productName: string): string => `Change ${productName}`;
export const WITHDRAW_TITLE = 'Withdraw scheduled changes?';
