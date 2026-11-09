import { apiFetch } from './client';
import type { PagedResult } from './types';
import type {
  SubscriptionCancellationReason,
  SubscriptionCycle,
  SubscriptionPaymentMethod,
  SubscriptionProduct,
  SubscriptionStatus,
  SubscriptionSuspensionReason,
  SubscriptionView,
} from './subscriptions';

/**
 * `lib/api/staff-subscriptions.ts` — HO-P6 S0. The staff side of subscriptions, as the real
 * `StaffSubscriptionsController` (route `api/staff/subscriptions`) and `StaffCustomerSubscriptionsController`
 * (`api/staff/customers/{customerId}/subscriptions`) send and accept it, both in
 * `src/Api/AmarGram.Api/Controllers/StaffSubscriptionsController.cs`. View models are in
 * `src/Read/AmarGram.Read/ViewModels/SubscriptionViewModels.cs`. Subscriptions are not branch-scoped
 * (StaffSubscriptionsController.cs:17). A staff action renders only from `allowedStaffActions` and only
 * for the roles below; the server's 403 has the last word.
 */

// ---- roles (presentation only; Shared/Common/Constants/ActionRoles.Subscriptions.cs:12-14) -----------------

/** `Subscriptions.View`: Reception, Inventory, ShopManager, Accountant, Administrator. */
export const SUBSCRIPTION_VIEW_ROLES: readonly string[] = [
  'Reception',
  'Inventory',
  'ShopManager',
  'Accountant',
  'Administrator',
];

/** `Subscriptions.Manage` (reinstate, cancel): ShopManager, Administrator. */
export const SUBSCRIPTION_MANAGE_ROLES: readonly string[] = ['ShopManager', 'Administrator'];

/** `Subscriptions.Export`: ShopManager, Accountant, Administrator. */
export const SUBSCRIPTION_EXPORT_ROLES: readonly string[] = [
  'ShopManager',
  'Accountant',
  'Administrator',
];

// ---- view models ----------------------------------------------------------------------------------------

/** SubscriptionCustomerViewModel, SubscriptionViewModels.cs:66 */
export interface SubscriptionCustomer {
  id: string;
  name: string;
  mobile: string | null;
}

/** StaffSubscriptionRowViewModel, SubscriptionViewModels.cs:68-79 */
export interface StaffSubscriptionRow {
  id: string;
  customer: SubscriptionCustomer;
  product: SubscriptionProduct;
  quantity: number;
  intervalWeeks: number;
  status: SubscriptionStatus;
  suspensionReason: SubscriptionSuspensionReason | null;
  nextDeliveryOn: string | null;
  paymentMethod: SubscriptionPaymentMethod;
  unpaidStreak: number;
  lastCycle: SubscriptionCycle | null;
}

/** The unpaid worklist group (SubscriptionStaffQueryHandlers.cs:114-153). */
export type UnpaidSubscriptionGroup = 'Suspended' | 'AtRisk';

/** UnpaidSubscriptionViewModel, SubscriptionViewModels.cs:81-88 */
export interface UnpaidSubscription {
  id: string;
  customer: SubscriptionCustomer;
  product: SubscriptionProduct;
  status: SubscriptionStatus;
  group: UnpaidSubscriptionGroup;
  unpaidStreak: number;
  unpaidCycles: SubscriptionCycle[];
}

/** SubscriptionDueTomorrowViewModel, SubscriptionViewModels.cs:106. `dueOn` is a date. */
export interface SubscriptionsDueTomorrow {
  dueOn: string;
  count: number;
  liveCount: number;
  suspendedCount: number;
  commerceTimeZoneId: string;
}

/** StaffReinstatementViewModel, SubscriptionViewModels.cs:100. `reinstatedBy` is a Guid with no name (backend gap BG-S5). */
export interface StaffReinstatement {
  reinstatedOn: string;
  reinstatedBy: string;
  reason: string;
}

/** `allowedStaffActions` values, SubscriptionStaffQueryHandlers.cs:168-170. */
export type StaffSubscriptionAction = 'Reinstate' | 'Cancel';

/**
 * `GET {id}`: one flat object, the `SubscriptionViewModel` plus the staff fields; `cycles` is the latest 50
 * (SubscriptionStaffQueryHandlers.cs:164). `allowedStaffActions`: `Reinstate` when Suspended, `Cancel` when not
 * Cancelled (:168-170).
 */
export interface StaffSubscriptionDetail extends SubscriptionView {
  customer: SubscriptionCustomer;
  cycles: SubscriptionCycle[];
  cancellationReason: SubscriptionCancellationReason | null;
  cancellationNote: string | null;
  suspendedOn: string | null;
  reinstatement: StaffReinstatement | null;
  allowedStaffActions: StaffSubscriptionAction[];
}

/** `GET /api/staff/customers/{customerId}/subscriptions`, StaffSubscriptionsController.cs:150-165. `live` is every non-cancelled one, Suspended included. */
export interface CustomerSubscriptionSummary {
  live: SubscriptionView[];
  cancelledCount: number;
  suspendedCount: number;
}

// ---- requests -------------------------------------------------------------------------------------------

/** The T1 filters (StaffSubscriptionsController.cs:25-38). Enumerations travel as display names; a bad one is 400 `{ error }`. */
export interface StaffSubscriptionFilters {
  status?: SubscriptionStatus;
  suspensionReason?: SubscriptionSuspensionReason;
  paymentMethod?: SubscriptionPaymentMethod;
  /** Product name, customer name or mobile, case-insensitive (SubscriptionStaffQueryHandlers.cs:26-32). */
  q?: string;
  /** `yyyy-MM-dd`: only subscriptions whose next delivery is on that day (the due-tomorrow definition); a bad date is 400 `{ error }`. */
  nextDeliveryOn?: string;
  /** `nextDeliveryOn` (default), `-nextDeliveryOn`, `status`, `product`; anything else is the default (:37-43). */
  sort?: string;
  pageNumber?: number;
  pageSize?: number;
}

/** ReinstateSubscriptionRequest, SubscriptionRequests.cs:50-54; reason required and at most 500 characters (SubscriptionCommandValidators.cs:104), date optional. */
export interface ReinstateSubscriptionInput {
  reason: string;
  /** `yyyy-MM-dd`; omitted to restart from the earliest possible date. */
  firstDeliveryOn?: string;
}

/** StaffCancelSubscriptionRequest, SubscriptionRequests.cs:45-48; note required (SubscriptionCommandValidators.cs:69-70) and at most 500 characters (:63). The reason is always `StaffCancelled` (StaffSubscriptionsController.cs:123). */
export interface StaffCancelSubscriptionInput {
  note: string;
}

// ---- client ---------------------------------------------------------------------------------------------

const BASE = '/api/staff/subscriptions';
const subscriptionPath = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** T1: `GET ?status=&suspensionReason=&paymentMethod=&q=&nextDeliveryOn=&sort=&pageNumber=&pageSize=` (`Subscriptions.View`). */
export function listStaffSubscriptions(
  filters: StaffSubscriptionFilters = {},
): Promise<PagedResult<StaffSubscriptionRow>> {
  return apiFetch(`${BASE}${query({ ...filters })}`);
}

/** T2: `GET unpaid?pageNumber=&pageSize=`. Suspended first, then by streak. */
export function listUnpaidSubscriptions(
  paging: { pageNumber?: number; pageSize?: number } = {},
): Promise<PagedResult<UnpaidSubscription>> {
  return apiFetch(`${BASE}/unpaid${query({ ...paging })}`);
}

/** T3: `GET due-tomorrow`. */
export function getSubscriptionsDueTomorrow(): Promise<SubscriptionsDueTomorrow> {
  return apiFetch(`${BASE}/due-tomorrow`);
}

/**
 * T4: the path of `GET export.csv` (`Subscriptions.Export`), carrying T1's filters and no paging. Hand it to
 * `downloadBillingFile` (ADR-FE-114); the client never builds CSV. Above 50,000 rows the server answers 413.
 */
export function subscriptionsCsvPath(filters: StaffSubscriptionFilters = {}): string {
  const { pageNumber: _page, pageSize: _size, ...rest } = filters;
  void _page;
  void _size;
  return `${BASE}/export.csv${query({ ...rest })}`;
}

/** T5: `GET {id}`. */
export function getStaffSubscription(id: string): Promise<StaffSubscriptionDetail> {
  return apiFetch(subscriptionPath(id));
}

/** T6: `GET {id}/cycles?pageNumber=&pageSize=`. */
export function getStaffSubscriptionCycles(
  id: string,
  paging: { pageNumber?: number; pageSize?: number } = {},
): Promise<PagedResult<SubscriptionCycle>> {
  return apiFetch(`${subscriptionPath(id)}/cycles${query({ ...paging })}`);
}

/** T7: `POST {id}/reinstate` (`Subscriptions.Manage`). Answers the plain view, not the staff detail (:130-134). */
export function reinstateSubscription(
  id: string,
  input: ReinstateSubscriptionInput,
): Promise<SubscriptionView> {
  return apiFetch(`${subscriptionPath(id)}/reinstate`, {
    method: 'POST',
    body: input.firstDeliveryOn
      ? { reason: input.reason, firstDeliveryOn: input.firstDeliveryOn }
      : { reason: input.reason },
  });
}

/** T8: `POST {id}/cancel` (`Subscriptions.Manage`). Answers the plain view. */
export function staffCancelSubscription(
  id: string,
  input: StaffCancelSubscriptionInput,
): Promise<SubscriptionView> {
  return apiFetch(`${subscriptionPath(id)}/cancel`, { method: 'POST', body: { note: input.note } });
}

/** T9: `GET /api/staff/customers/{customerId}/subscriptions` (`Subscriptions.View`). An unknown customer has none (200). */
export function getCustomerSubscriptionSummary(
  customerId: string,
): Promise<CustomerSubscriptionSummary> {
  return apiFetch(`/api/staff/customers/${encodeURIComponent(customerId)}/subscriptions`);
}
