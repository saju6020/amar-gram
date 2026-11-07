import type { StaffSubscriptionFilters } from '../api/staff-subscriptions';
import type { MySubscriptionsStatus, SubscriptionFulfilment } from '../api/subscriptions';

/**
 * `lib/subscriptions/keys.ts` — HO-P6 S0, §8.3. TanStack Query keys for subscriptions, in one place so the
 * hooks of S1, S2 and S3 invalidate the same prefixes (ADR-FE-194). Customer keys start with
 * `['me','subscriptions']`, staff keys with `['staff','subscriptions']`.
 */

/** `staleTime` for the options read (§8.3). */
export const SUBSCRIPTION_OPTIONS_STALE_MS = 60_000;

/** Debounce for quantity changes before the payment methods are re-read (§8.3). */
export const SUBSCRIPTION_QUANTITY_DEBOUNCE_MS = 300;

const ME = ['me', 'subscriptions'] as const;
const STAFF = ['staff', 'subscriptions'] as const;

export const subscriptionKeys = {
  /** Everything a customer has cached about subscriptions. */
  all: ME,
  /** C1 */
  options: (skuId: string) => [...ME, 'options', skuId] as const,
  optionsAll: [...ME, 'options'] as const,
  /** C2. `addressOrBranchId` is the chosen address (Delivery) or outlet (Pickup). */
  paymentMethods: (
    skuId: string,
    quantity: number,
    fulfilment: SubscriptionFulfilment,
    addressOrBranchId: string | null,
  ) => [...ME, 'payment-methods', skuId, quantity, fulfilment, addressOrBranchId] as const,
  /** C3, one tab and one page. */
  list: (status: Exclude<MySubscriptionsStatus, 'all'>, page: number) =>
    [...ME, 'list', status, page] as const,
  /** Every list page of every tab (for invalidation). */
  listAll: [...ME, 'list'] as const,
  /** C4 */
  detail: (id: string) => [...ME, 'detail', id] as const,
  /** C5, one page. */
  cycles: (id: string, page: number) => [...ME, 'cycles', id, page] as const,
  /** Every cycles page of one subscription (for invalidation). */
  cyclesOf: (id: string) => [...ME, 'cycles', id] as const,
} as const;

export const staffSubscriptionKeys = {
  /** The whole staff prefix, including due-tomorrow and the customer summary (ADR-FE-194). */
  all: STAFF,
  /** T1 */
  list: (filters: StaffSubscriptionFilters) => [...STAFF, 'list', filters] as const,
  /** T2 */
  unpaid: (page: number) => [...STAFF, 'unpaid', page] as const,
  /** T5 */
  detail: (id: string) => [...STAFF, 'detail', id] as const,
  /** T6, one page. */
  cycles: (id: string, page: number) => [...STAFF, 'cycles', id, page] as const,
  /** T3. No polling of its own; refreshes on mount and window focus (slice S3). */
  dueTomorrow: [...STAFF, 'due-tomorrow'] as const,
  /** T9 (slice S3). */
  customer: (customerId: string) => [...STAFF, 'customer', customerId] as const,
} as const;
