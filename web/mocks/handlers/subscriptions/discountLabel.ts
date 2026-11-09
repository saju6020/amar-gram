import { formatPercentText } from '@/lib/subscriptions/dates';
import { subscriptionOrderSeeds } from './fixtures';

/**
 * The server's `SubscriptionMessages.DiscountLabelWith` (SubscriptionMessages.cs:24-25) for the seeded 10% subscriber discount:
 * "Subscription discount (10%)". Orders and invoices that came from a subscription carry it where the discount is the
 * subscriber discount; every other order sends `null` (SubscriptionDiscountLabels.cs). Owner decision 2026-11-09.
 */
export const SUBSCRIPTION_DISCOUNT_PERCENT = '10.00';
export const SUBSCRIPTION_DISCOUNT_LABEL = `Subscription discount (${formatPercentText(SUBSCRIPTION_DISCOUNT_PERCENT)}%)`;

let orderIds: Set<string> | null = null;
/** True for the id of an order a subscription cycle generated (the seeded ones). */
export function isSubscriptionOrderId(id: string): boolean {
  orderIds ??= new Set(subscriptionOrderSeeds().map((s) => s.orderId));
  return orderIds.has(id);
}
