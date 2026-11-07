import type { SubscriptionTerms, SubscriptionView } from '@/lib/api/subscriptions';
import {
  DELIVERY_ADDRESS_MISSING_TEXT,
  PAUSED_NO_DELIVERIES_TEXT,
  PRODUCT_UNAVAILABLE_TEXT,
  nextDeliveryLabel,
} from '@/lib/subscriptions/copy';
import { formatCommerceInstant, formatCommerceInstantLong, formatCycleDate } from '@/lib/subscriptions/dates';
import {
  pendingStatusChangeText,
  quantityAndIntervalLabel,
  subscriptionPaymentMethodLabel,
  suspensionReasonCustomerText,
} from '@/lib/subscriptions/labels';

/**
 * Pure sentences the subscription screens build from a view the server sent. Every date is a field of the view, passed
 * through `lib/subscriptions/dates.ts`; nothing is added, compared or predicted (ADR-FE-110, ADR-FE-112).
 */

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

/** The line on a card (and the detail's header) that says when the next delivery is, or why there is none. */
export function nextDeliveryLine(view: SubscriptionView): string {
  if (view.status === 'Active' && view.nextDeliveryOn) return nextDeliveryLabel(view.nextDeliveryOn);
  if (view.status === 'Paused') return PAUSED_NO_DELIVERIES_TEXT;
  if (view.status === 'Suspended') return 'Suspended: see why';
  if (view.status === 'Cancelled') {
    return `Ended on ${formatCommerceInstantLong(view.cancelledOn, view.commerceTimeZoneId)}`;
  }
  return 'No delivery is scheduled';
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
    return `Waiting for your transfer: pay by ${formatCommerceInstant(last.paymentExpiresOn, view.commerceTimeZoneId)}`;
  }
  if (view.pending) {
    return view.pending.appliesFromCycleOn
      ? `Changes scheduled from ${formatCycleDate(view.pending.appliesFromCycleOn)}`
      : 'Changes are scheduled';
  }
  if (!view.product.isAvailable) return PRODUCT_UNAVAILABLE_TEXT;
  return null;
}

/** What is scheduled, as sentences: the new terms, a skip, a pause or an end, each with the date the server names. */
export function pendingLines(view: SubscriptionView): string[] {
  const pending = view.pending;
  if (!pending) return [];
  const from = formatCycleDate(pending.appliesFromCycleOn);
  const lines: string[] = [];
  if (pending.terms) lines.push(`New terms from the delivery on ${from}: ${termsSummaryText(pending.terms)}`);
  if (pending.skip) lines.push(`The delivery on ${from} is skipped`);
  if (pending.statusChange) {
    lines.push(
      pendingStatusChangeText(
        pending.statusChange,
        pending.statusChange === 'Pause' ? view.nextDeliveryOn : pending.appliesFromCycleOn,
      ),
    );
  }
  return lines;
}
