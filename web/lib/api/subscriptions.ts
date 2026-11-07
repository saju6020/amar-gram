import { apiFetch } from './client';
import type { Money } from '../format/money';
import type { PagedResult } from './types';

/**
 * `lib/api/subscriptions.ts` — HO-P6 S0. The customer side of subscriptions, as the real
 * `CustomerSubscriptionsController` (route `api/customers/me/subscriptions`) sends and accepts it.
 * Paths below are under `src/Api/AmarGram.Api/Controllers/`, view models under
 * `src/Read/AmarGram.Read/ViewModels/SubscriptionViewModels.cs`, requests under
 * `src/Api/AmarGram.Api/Contracts/Subscription/SubscriptionRequests.cs`.
 *
 * Wire conventions (SubscriptionViewModels.cs:3-4): local dates are `yyyy-MM-dd` strings, instants are
 * ISO-8601 with an offset, money is `{ amount, currencyCode }`, and enumerations travel as their display
 * names. A screen renders actions only from `allowedActions` (ADR-FE-110) and never adds dates or
 * does money arithmetic (ADR-FE-112, ADR-FE-113). No field here is a token or a card (ADR-238).
 */

// ---- enumerations (display names; web unions list exactly the server's values) -----------------------------

/** Shared/Common/Enums/SubscriptionStatus.cs:6-9 */
export type SubscriptionStatus = 'Active' | 'Paused' | 'Suspended' | 'Cancelled';
export const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  'Active',
  'Paused',
  'Suspended',
  'Cancelled',
];

/** Shared/Common/Enums/SubscriptionSuspensionReason.cs:9-10 */
export type SubscriptionSuspensionReason = 'UnpaidCycles' | 'ProductUnavailable';
export const SUBSCRIPTION_SUSPENSION_REASONS: readonly SubscriptionSuspensionReason[] = [
  'UnpaidCycles',
  'ProductUnavailable',
];

/** Shared/Common/Enums/SubscriptionCancellationReason.cs:9-17. The first six are the customer's choices (`IsCustomerChoice`, :20). */
export type SubscriptionCustomerCancellationReason =
  | 'NoLongerNeeded'
  | 'TooMuchStock'
  | 'TastesDidNotSuit'
  | 'TooExpensive'
  | 'SwitchingProduct'
  | 'Other';
export type SubscriptionCancellationReason =
  | SubscriptionCustomerCancellationReason
  | 'StaffCancelled'
  | 'CustomerMerged'
  | 'AccountDeleted';
export const SUBSCRIPTION_CUSTOMER_CANCELLATION_REASONS: readonly SubscriptionCustomerCancellationReason[] =
  ['NoLongerNeeded', 'TooMuchStock', 'TastesDidNotSuit', 'TooExpensive', 'SwitchingProduct', 'Other'];
export const SUBSCRIPTION_CANCELLATION_REASONS: readonly SubscriptionCancellationReason[] = [
  ...SUBSCRIPTION_CUSTOMER_CANCELLATION_REASONS,
  'StaffCancelled',
  'CustomerMerged',
  'AccountDeleted',
];

/** Shared/Common/Enums/SubscriptionPaymentMethod.cs:9-11 */
export type SubscriptionPaymentMethod = 'CashOnDelivery' | 'BankTransfer' | 'PayAtPickup';
export const SUBSCRIPTION_PAYMENT_METHODS: readonly SubscriptionPaymentMethod[] = [
  'CashOnDelivery',
  'BankTransfer',
  'PayAtPickup',
];

/** Shared/Common/Enums/SubscriptionFulfilment.cs:6-7 */
export type SubscriptionFulfilment = 'Delivery' | 'Pickup';
export const SUBSCRIPTION_FULFILMENTS: readonly SubscriptionFulfilment[] = ['Delivery', 'Pickup'];

/** Shared/Common/Enums/SubscriptionCycleOutcome.cs:6-7 */
export type SubscriptionCycleOutcome = 'Generated' | 'Failed';

/** Shared/Common/Enums/SubscriptionCycleFailureReason.cs:6-11 */
export type SubscriptionCycleFailureReason =
  | 'OutOfStock'
  | 'ProductUnavailable'
  | 'PaymentMethodUnavailable'
  | 'DeliveryUnavailable'
  | 'DeliveryAddressMissing'
  | 'OrderRefused';

/** Shared/Common/Enums/SubscriptionCycleOrderState.cs:6-11 */
export type SubscriptionCycleOrderState =
  | 'AwaitingPayment'
  | 'Confirmed'
  | 'Expired'
  | 'Cancelled'
  | 'Delivered'
  | 'Refused';

/** Shared/Common/Enums/SubscriptionPendingStatusChange.cs (Pause, Cancel) */
export type SubscriptionPendingStatusChange = 'Pause' | 'Cancel';

/** Domain/DomainServices/SubscriptionSchedule.cs:26-34 */
export type SubscriptionAction =
  | 'ChangeTerms'
  | 'Skip'
  | 'Pause'
  | 'Resume'
  | 'Cancel'
  | 'WithdrawPending';

/** The `status` query of the customer list (CustomerSubscriptionsController.cs:50-63). */
export type MySubscriptionsStatus = 'live' | 'cancelled' | 'all';

// ---- view models ----------------------------------------------------------------------------------------

/** SubscriptionProductViewModel, SubscriptionViewModels.cs:6. No slug (backend gap BG-S8). */
export interface SubscriptionProduct {
  skuId: string;
  productName: string;
  variantLabel: string;
  imageUrl: string | null;
  isAvailable: boolean;
}

/** SubscriptionAddressViewModel, SubscriptionViewModels.cs:8 */
export interface SubscriptionAddress {
  id: string;
  label: string;
  line1: string;
  city: string;
}

/** SubscriptionBranchViewModel, SubscriptionViewModels.cs:10 */
export interface SubscriptionBranch {
  id: string;
  name: string;
}

/** SubscriptionTermsViewModel, SubscriptionViewModels.cs:12-14 */
export interface SubscriptionTerms {
  quantity: number;
  intervalWeeks: number;
  fulfilment: SubscriptionFulfilment;
  deliveryAddress: SubscriptionAddress | null;
  deliveryAddressMissing: boolean;
  pickupBranch: SubscriptionBranch | null;
  paymentMethod: SubscriptionPaymentMethod;
}

/** SubscriptionPendingViewModel, SubscriptionViewModels.cs:16 */
export interface SubscriptionPending {
  terms: SubscriptionTerms | null;
  skip: boolean;
  statusChange: SubscriptionPendingStatusChange | null;
  appliesFromCycleOn: string | null;
}

/** SubscriptionEstimateViewModel, SubscriptionViewModels.cs:18-19. `discountPercent` is a string like `"10.00"`. */
export interface SubscriptionEstimate {
  unitPrice: Money;
  quantity: number;
  subtotal: Money;
  discountPercent: string;
  discountAmount: Money;
  estimatedTotal: Money;
  note: string;
}

/** SubscriptionCycleViewModel, SubscriptionViewModels.cs:21-22 */
export interface SubscriptionCycle {
  id: string;
  cycleOn: string;
  outcome: SubscriptionCycleOutcome;
  failureReason: SubscriptionCycleFailureReason | null;
  orderId: string | null;
  orderNumber: string | null;
  orderState: SubscriptionCycleOrderState | null;
  paymentExpiresOn: string | null;
  discountPercent: string;
}

/** SubscriptionViewModel, SubscriptionViewModels.cs:24-43 (built by SubscriptionViews.cs:42-76). */
export interface SubscriptionView {
  id: string;
  version: number;
  status: SubscriptionStatus;
  suspensionReason: SubscriptionSuspensionReason | null;
  product: SubscriptionProduct;
  terms: SubscriptionTerms;
  /** Date; null unless Active. */
  nextDeliveryOn: string | null;
  /** Instant; Active only (SubscriptionViews.cs:73). */
  changeCutoffOn: string | null;
  isLocked: boolean;
  /** Date; Active only. */
  followingDeliveryOn: string | null;
  skippableCycleOn: string | null;
  pending: SubscriptionPending | null;
  /** Null when the SKU has no price. */
  estimate: SubscriptionEstimate | null;
  allowedActions: SubscriptionAction[];
  lastCycle: SubscriptionCycle | null;
  startedOn: string;
  cancelledOn: string | null;
  commerceTimeZoneId: string;
}

/** `GET {id}`: one flat object, the view plus `cycles` (the latest 12, newest first). CustomerSubscriptionsController.cs:65-74, SubscriptionHttp.cs:25-31 */
export interface CustomerSubscriptionDetail extends SubscriptionView {
  cycles: SubscriptionCycle[];
}

/** SubscriptionOptionsViewModel, SubscriptionViewModels.cs:47-60 */
export interface SubscriptionOptions {
  sku: SubscriptionProduct;
  unitPrice: Money | null;
  subscribable: boolean;
  notSubscribableReason: string | null;
  allowedIntervalWeeks: number[];
  maxQuantity: number;
  /** A string like `"10.00"`. */
  discountPercent: string;
  earliestFirstDeliveryOn: string;
  latestFirstDeliveryOn: string;
  changeCutoffDays: number;
  preChargeNoticeDays: number;
  existingSubscriptionId: string | null;
  commerceTimeZoneId: string;
}

/** SubscriptionPaymentMethodViewModel, SubscriptionViewModels.cs:62. `[]` when neither id is sent (SubscriptionCustomerQueryHandlers.cs:117). */
export interface SubscriptionPaymentMethodOption {
  method: SubscriptionPaymentMethod;
  isAvailable: boolean;
  unavailableReason: string | null;
}

/** `{ subscription, appliedImmediately, appliesFromCycleOn, message }`, CustomerSubscriptionsController.cs:156-168. */
export interface SubscriptionChangeResult {
  subscription: SubscriptionView;
  appliedImmediately: boolean;
  appliesFromCycleOn: string | null;
  message: string;
}

// ---- requests -------------------------------------------------------------------------------------------

/** CreateSubscriptionRequest, SubscriptionRequests.cs:6-16. Exactly one of the address and the branch, matching `fulfilment`. */
export interface CreateSubscriptionInput {
  skuId: string;
  quantity: number;
  intervalWeeks: number;
  /** `yyyy-MM-dd`; omitted for "the earliest". */
  firstDeliveryOn?: string;
  fulfilment: SubscriptionFulfilment;
  deliveryAddressId?: string;
  pickupBranchId?: string;
  paymentMethod: SubscriptionPaymentMethod;
}

/** ChangeSubscriptionTermsRequest, SubscriptionRequests.cs:18-27 */
export interface ChangeSubscriptionTermsInput {
  version: number;
  quantity: number;
  intervalWeeks: number;
  fulfilment: SubscriptionFulfilment;
  deliveryAddressId?: string;
  pickupBranchId?: string;
  paymentMethod: SubscriptionPaymentMethod;
}

/** CancelSubscriptionRequest, SubscriptionRequests.cs:39-43. `reason` is always sent (the server answers 400 `{ error }` without it). */
export interface CancelSubscriptionInput {
  reason: SubscriptionCustomerCancellationReason;
  /** At most 500 characters (SubscriptionRules.MaxNoteLength). */
  note?: string;
}

export interface MySubscriptionsFilters {
  status?: MySubscriptionsStatus;
  pageNumber?: number;
  pageSize?: number;
}

export interface PaymentMethodsParams {
  skuId: string;
  quantity?: number;
  deliveryAddressId?: string;
  pickupBranchId?: string;
}

// ---- client ---------------------------------------------------------------------------------------------

const BASE = '/api/customers/me/subscriptions';
const subscriptionPath = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** C1: `GET options?skuId=`. 404 for an unknown SKU. */
export function getSubscriptionOptions(skuId: string): Promise<SubscriptionOptions> {
  return apiFetch(`${BASE}/options${query({ skuId })}`);
}

/** C2: `GET payment-methods?skuId=&quantity=&deliveryAddressId=&pickupBranchId=`. */
export function getSubscriptionPaymentMethods(
  params: PaymentMethodsParams,
): Promise<SubscriptionPaymentMethodOption[]> {
  return apiFetch(`${BASE}/payment-methods${query({ ...params })}`);
}

/** C3: `GET ?status=live|cancelled|all&pageNumber=&pageSize=`. */
export function listMySubscriptions(
  filters: MySubscriptionsFilters = {},
): Promise<PagedResult<SubscriptionView>> {
  return apiFetch(`${BASE}${query({ ...filters })}`);
}

/** C4: `GET {id}`. */
export function getMySubscription(id: string): Promise<CustomerSubscriptionDetail> {
  return apiFetch(subscriptionPath(id));
}

/** C5: `GET {id}/cycles?pageNumber=&pageSize=`, newest first. */
export function getMySubscriptionCycles(
  id: string,
  paging: { pageNumber?: number; pageSize?: number } = {},
): Promise<PagedResult<SubscriptionCycle>> {
  return apiFetch(`${subscriptionPath(id)}/cycles${query({ ...paging })}`);
}

/** C6: `POST`. 201 with the view (no `cycles`). */
export function createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionView> {
  return apiFetch(BASE, { method: 'POST', body: input });
}

/** C7: `PUT {id}/terms`. */
export function changeSubscriptionTerms(
  id: string,
  input: ChangeSubscriptionTermsInput,
): Promise<SubscriptionChangeResult> {
  return apiFetch(`${subscriptionPath(id)}/terms`, { method: 'PUT', body: input });
}

/** C8: `POST {id}/skip` with `{ cycleOn }`. */
export function skipSubscriptionDelivery(
  id: string,
  cycleOn: string,
): Promise<SubscriptionChangeResult> {
  return apiFetch(`${subscriptionPath(id)}/skip`, { method: 'POST', body: { cycleOn } });
}

/** C9: `POST {id}/pause`, no body. */
export function pauseSubscription(id: string): Promise<SubscriptionChangeResult> {
  return apiFetch(`${subscriptionPath(id)}/pause`, { method: 'POST' });
}

/** C10: `POST {id}/resume` with `{ firstDeliveryOn? }`. The body is always an object; the date is left out when not chosen. */
export function resumeSubscription(
  id: string,
  firstDeliveryOn?: string,
): Promise<SubscriptionChangeResult> {
  return apiFetch(`${subscriptionPath(id)}/resume`, {
    method: 'POST',
    body: firstDeliveryOn ? { firstDeliveryOn } : {},
  });
}

/** C11: `POST {id}/cancel` with `{ reason, note? }`. */
export function cancelSubscription(
  id: string,
  input: CancelSubscriptionInput,
): Promise<SubscriptionChangeResult> {
  return apiFetch(`${subscriptionPath(id)}/cancel`, {
    method: 'POST',
    body: input.note ? { reason: input.reason, note: input.note } : { reason: input.reason },
  });
}

/** C12: `DELETE {id}/pending-changes`. */
export function withdrawPendingSubscriptionChanges(id: string): Promise<SubscriptionChangeResult> {
  return apiFetch(`${subscriptionPath(id)}/pending-changes`, { method: 'DELETE' });
}
