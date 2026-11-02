import { apiFetch } from './client';
import type { Money } from '../format/money';
import { wireMoney } from '../money';
import type { PagedResult } from './types';
import type { OrderTotals } from './checkout';
import type {
  OrderFulfilment,
  OrderFulfilmentView,
  OrderPaymentMethod,
  OrderStatus,
} from './my-orders';
import type { Courier } from './ordering-admin';
import { downloadBillingFile } from './billing-staff';

/**
 * `lib/api/staff-orders.ts` — HO-ORD-002 §8.2. The staff side of orders and fulfilment, as the real
 * `StaffOrdersController`, `StaffFulfilmentController` and `StaffOrderReconciliationController` send
 * them. The branch is the active branch (`X-Branch-Id`, added by `client.ts`). Staff actions are
 * rendered only from `allowedActions` (ADR-FE-093); a `403` is the server's refusal.
 */

export type StaffOrderFlag =
  | 'AwaitingApproval'
  | 'TransferReported'
  | 'CourierReportsDelivered'
  | 'CollectionOverdue'
  | 'CustomerAnonymised';

export interface StaffOrderRow {
  id: string;
  orderNumber: string;
  placedOn: string;
  customerName: string;
  status: OrderStatus;
  fulfilmentMethod: OrderFulfilment;
  paymentMethod: OrderPaymentMethod;
  /** `Subscription` is display only (HO-P5 OQ-11, §8.2): no filter, tab or subscription call. */
  channel: 'Online' | 'Counter' | 'Subscription';
  grandTotal: Money;
  ageMinutes: number;
  flags: StaffOrderFlag[];
  branchTimeZoneId: string;
  /**
   * HO-P5 BG-3: the zone the order was priced in, the address district and the chosen slot
   * (`slotDate` is `yyyy-MM-dd`). All null for a pickup or counter order, or one with no slot.
   * // Read/ViewModels/StaffOrderViewModels.cs:12-13
   */
  deliveryZone: string | null;
  deliveryDistrict: string | null;
  slotDate: string | null;
  slotWindowLabel: string | null;
}

export interface StaffOrderFilters {
  status?: string;
  fulfilment?: string;
  paymentMethod?: string;
  channel?: string;
  from?: string;
  to?: string;
  search?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface StaffAllocation {
  batchId: string;
  batchNumber: string;
  expiresOn: string | null;
  locationId: string;
  locationName: string;
  quantity: number;
}

export interface StaffOrderLine {
  lineId: string;
  lineNumber: number;
  skuId: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
  quantityReturned: number;
  allocations: StaffAllocation[];
  /** HO-P5 BG-4: the persisted pick-list tick. // Read/ViewModels/StaffOrderViewModels.cs:19 */
  picked: boolean;
  pickedOn: string | null;
  pickedBy: string | null;
}

export interface StaffStatusChange {
  from: OrderStatus | null;
  to: OrderStatus;
  changedOn: string;
  changedBy: string;
  changedByName: string | null;
  note: string | null;
}

export interface HeldPayment {
  amount: Money;
  /** The recording staff member's id — the API sends no name for it. */
  recordedBy: string;
  recordedOn: string;
}

export interface StaffCodCollection {
  amount: Money;
  collectorKind: 'Courier' | 'Staff';
  collectorName: string;
  collectedOn: string;
  recordedBy: string;
}

/**
 * `courierId` is null and `riderId` / `riderName` are set when the order left with an in-house rider
 * (`courierName` is then the customer-facing carrier name). HO-P5 BG-5.
 * // Read/ViewModels/StaffOrderViewModels.cs:27-30
 */
export interface StaffShipment {
  courierId: string | null;
  riderId: string | null;
  riderName: string | null;
  courierName: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  dispatchedOn: string;
  lastTrackingStatus: string | null;
  lastTrackingEventOn: string | null;
}

export interface StaffPaymentRef {
  paymentId: string;
  method: string;
  amount: Money;
  recordedOn: string;
}

/** `OrderTransitionAction` names the API sends, filtered to what this caller may do. */
export type StaffOrderAction =
  | 'ConfirmPayment'
  | 'Cancel'
  | 'StartPacking'
  /** HO-P5 BG-4: `Packing -> Packed`, "packed, waiting for the rider". Domain/DomainServices/OrderTransitionRules.cs:56 */
  | 'MarkPacked'
  | 'Dispatch'
  | 'MarkReadyForCollection'
  | 'RecordDelivery'
  | 'RecordDeliveryFailure'
  | 'Refund';

export interface StaffOrderDetail {
  id: string;
  version: number;
  orderNumber: string;
  placedOn: string;
  channel: 'Online' | 'Counter' | 'Subscription';
  customerId: string | null;
  status: OrderStatus;
  fulfilmentMethod: OrderFulfilment;
  paymentMethod: OrderPaymentMethod;
  branchTimeZoneId: string;
  /** HO-P5 BG-4: when the order was marked packed; null before. // Read/ViewModels/StaffOrderViewModels.cs:38 */
  packedOn: string | null;
  lines: StaffOrderLine[];
  totals: OrderTotals;
  fulfilment: OrderFulfilmentView;
  statusHistory: StaffStatusChange[];
  paymentDueBy: string | null;
  customerTransferReference: string | null;
  heldPayment: HeldPayment | null;
  codCollection: StaffCodCollection | null;
  shipment: StaffShipment | null;
  collectBy: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  payments: StaffPaymentRef[];
  creditNoteIds: string[];
  amountPaid: Money;
  amountRefunded: Money;
  refundDue: Money;
  discountCode: string | null;
  customerAnonymised: boolean;
  allowedActions: StaffOrderAction[];
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

const orderPath = (orderId: string) => `/api/staff/orders/${encodeURIComponent(orderId)}`;

export function listStaffOrders(filters: StaffOrderFilters): Promise<PagedResult<StaffOrderRow>> {
  return apiFetch(`/api/staff/orders${query({ ...filters })}`);
}

/**
 * One row of `GET /api/staff/customers/{customerId}/orders` (`StaffCustomerOrderRowViewModel`): no customer name,
 * age, flags, or the BG-3 delivery area and slot (Read/ViewModels/StaffOrderViewModels.cs:68-70).
 */
export type StaffCustomerOrderRow = Omit<
  StaffOrderRow,
  'customerName' | 'ageMinutes' | 'flags' | 'deliveryZone' | 'deliveryDistrict' | 'slotDate' | 'slotWindowLabel'
>;

/** The queue's filters bar `status` (and paging): what `status-counts` accepts. Api/Controllers/StaffOrdersController.cs:142 */
export type StaffOrderCountFilters = Omit<StaffOrderFilters, 'status' | 'pageNumber' | 'pageSize'>;

/**
 * HO-P5 BG-2: every order status with its count (zeros included, in pipeline order) under the queue's own
 * filters bar `status`. `total` is the SERVER's sum; nothing here adds counts up.
 * // Read/ViewModels/StaffOrderViewModels.cs:40-45
 */
export interface StaffOrderStatusCounts {
  total: number;
  counts: Array<{ status: OrderStatus; count: number }>;
}

export function getStaffOrderStatusCounts(filters: StaffOrderCountFilters): Promise<StaffOrderStatusCounts> {
  return apiFetch(`/api/staff/orders/status-counts${query({ ...filters })}`);
}

/** HO-ORD-001-FU2: the customer's orders at the active branch, newest first. `404` = no such customer. */
export function listStaffCustomerOrders(
  customerId: string,
  params: { pageNumber?: number; pageSize?: number } = {},
): Promise<PagedResult<StaffCustomerOrderRow>> {
  return apiFetch(`/api/staff/customers/${encodeURIComponent(customerId)}/orders${query({ ...params })}`);
}

export function getStaffOrder(orderId: string): Promise<StaffOrderDetail> {
  return apiFetch(orderPath(orderId));
}

// ---- payment ---------------------------------------------------------------------------------------

export interface AwaitingPaymentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  amount: Money;
  paymentDueBy: string | null;
  customerTransferReference: string | null;
  transferReportedOn: string | null;
  heldPayment: HeldPayment | null;
  version: number;
  branchTimeZoneId: string;
}

export function listAwaitingPayment(): Promise<AwaitingPaymentOrder[]> {
  return apiFetch('/api/staff/orders/awaiting-payment');
}

export interface ConfirmTransferInput {
  expectedVersion: number;
  /** The money string the person typed or the order's amount — sent as a JSON number literal. */
  amount: string;
  bankReference: string;
  /** ISO instant. */
  receivedOn: string;
}

export function confirmBankTransfer(
  orderId: string,
  input: ConfirmTransferInput,
  idempotencyKey: string,
): Promise<{ status: string; awaitingApproval: boolean }> {
  return apiFetch(`${orderPath(orderId)}/payment/bank-transfer`, {
    method: 'POST',
    body: { ...input, amount: wireMoney(input.amount) },
    idempotencyKey,
  });
}

export function approveHeldPayment(
  orderId: string,
  expectedVersion: number,
  idempotencyKey: string,
): Promise<{ status: string }> {
  return apiFetch(`${orderPath(orderId)}/payment/approve`, {
    method: 'POST',
    body: { expectedVersion },
    idempotencyKey,
  });
}

export function rejectHeldPayment(orderId: string, note: string): Promise<void> {
  return apiFetch(`${orderPath(orderId)}/payment/reject`, { method: 'POST', body: { note } });
}

export function cancelStaffOrder(orderId: string, note: string): Promise<void> {
  return apiFetch(`${orderPath(orderId)}/cancel`, { method: 'POST', body: { note } });
}

// ---- fulfilment ------------------------------------------------------------------------------------

export function startPacking(orderId: string): Promise<void> {
  return apiFetch(`${orderPath(orderId)}/packing`, { method: 'POST' });
}

/** HO-P5 BG-5: exactly one target. Api/Contracts/Order/OrderFulfilmentRequests.cs:3-10 (`400 DispatchTargetInvalid` for both or neither). */
export type DispatchTarget = { courierId: string } | { riderId: string };

/** `Packing -> Packed`, optional (HO-P5 BG-4). `204`. Api/Controllers/StaffOrdersController.cs:194-205 */
export function markPacked(orderId: string): Promise<void> {
  return apiFetch(`${orderPath(orderId)}/packed`, { method: 'POST' });
}

/** Tick or untick one pick-list line (HO-P5 BG-4); idempotent. `204`. Api/Controllers/StaffOrdersController.cs:207-221 */
export function setLinePicked(orderId: string, lineId: string, picked: boolean): Promise<void> {
  return apiFetch(`${orderPath(orderId)}/lines/${encodeURIComponent(lineId)}/picked`, {
    method: 'PUT',
    body: { picked },
  });
}

/** A rider delivery has no tracking number, so `trackingNumber` travels only with a courier. */
export function dispatchOrder(orderId: string, target: DispatchTarget, trackingNumber?: string): Promise<void> {
  const body = 'courierId' in target ? { courierId: target.courierId, trackingNumber } : { riderId: target.riderId };
  return apiFetch(`${orderPath(orderId)}/dispatch`, { method: 'POST', body });
}

export function markReadyForCollection(orderId: string): Promise<void> {
  return apiFetch(`${orderPath(orderId)}/ready-for-collection`, { method: 'POST' });
}

export function recordTracking(orderId: string, trackingNumber: string): Promise<void> {
  return apiFetch(`${orderPath(orderId)}/tracking`, { method: 'PUT', body: { trackingNumber } });
}

export interface RecordDeliveryInput {
  expectedVersion: number;
  /** ISO instant. */
  deliveredOn: string;
  codCollection?: {
    amount: string;
    collectorKind: 'Courier' | 'Staff';
    collectorName?: string;
    collectorStaffId?: string;
    collectedOn: string;
  };
  collectionPayment?: { method: 'Cash' | 'InStoreCard'; amount: string; reference?: string };
}

export function recordDelivery(
  orderId: string,
  input: RecordDeliveryInput,
  idempotencyKey: string,
): Promise<void> {
  const body = {
    expectedVersion: input.expectedVersion,
    deliveredOn: input.deliveredOn,
    codCollection: input.codCollection
      ? { ...input.codCollection, amount: wireMoney(input.codCollection.amount) }
      : undefined,
    collectionPayment: input.collectionPayment
      ? { ...input.collectionPayment, amount: wireMoney(input.collectionPayment.amount) }
      : undefined,
  };
  return apiFetch(`${orderPath(orderId)}/delivery`, { method: 'POST', body, idempotencyKey });
}

export type DeliveryFailureReason = 'Refused' | 'Undeliverable' | 'Uncollected';

/** `201 { returnRequestId }` for a refused / undeliverable parcel; `204` for an uncollected pickup. */
export function recordDeliveryFailure(
  orderId: string,
  input: { reason: DeliveryFailureReason; note?: string },
): Promise<{ returnRequestId: string } | undefined> {
  return apiFetch(`${orderPath(orderId)}/delivery-failure`, { method: 'POST', body: input });
}

export function reallocateLine(
  orderId: string,
  lineId: string,
  input: { targetBatchId: string; reason: string },
): Promise<void> {
  return apiFetch(`${orderPath(orderId)}/lines/${encodeURIComponent(lineId)}/reallocate`, {
    method: 'POST',
    body: input,
  });
}

/** The active couriers a dispatch chooses from (`Orders.Fulfil`; the admin list is `Couriers.Manage`). */
export function listDispatchCouriers(): Promise<Courier[]> {
  return apiFetch('/api/staff/fulfilment/couriers');
}

// ---- in-house riders (HO-P5 BG-5) --------------------------------------------------------------------

/**
 * One in-house rider of the active branch. The response never carries the branch. The mobile number is
 * read behind `Orders.Fulfil` and written behind `Riders.Manage`.
 * // Read/ViewModels/RiderViewModels.cs:4; Api/Controllers/StaffRidersController.cs:21-47
 */
export interface Rider {
  id: string;
  name: string;
  mobileNumber: string | null;
  isActive: boolean;
}

/** `POST` / `PUT /api/staff/riders[/{id}]`. Api/Contracts/Order/OrderFulfilmentRequests.cs:18-24 */
export interface RiderInput {
  name: string;
  mobileNumber?: string | null;
  isActive: boolean;
}

/** Roles that hold `Riders.Manage`, for presentation only (the server decides). Shared/Common/Constants/ActionRoles.Orders.cs:26 */
export const RIDER_MANAGE_ROLES: readonly string[] = ['ShopManager', 'Administrator'];

export function listRiders(activeOnly: boolean): Promise<Rider[]> {
  return apiFetch(`/api/staff/riders${query({ activeOnly: activeOnly ? 'true' : undefined })}`);
}

export function createRider(input: RiderInput): Promise<{ riderId: string }> {
  return apiFetch('/api/staff/riders', { method: 'POST', body: input });
}

export function updateRider(riderId: string, input: RiderInput): Promise<void> {
  return apiFetch(`/api/staff/riders/${encodeURIComponent(riderId)}`, { method: 'PUT', body: input });
}

// ---- pick list, packing slip, manifest ---------------------------------------------------------------

export interface PickListOrder {
  orderNumber: string;
  quantity: number;
}

export interface PickListBatch {
  batchId: string;
  batchNumber: string;
  expiresOn: string | null;
  skuId: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  orders: PickListOrder[];
}

export interface PickListGroup {
  locationId: string;
  locationName: string;
  batches: PickListBatch[];
}

export interface PickList {
  generatedOn: string;
  groups: PickListGroup[];
}

export function getPickList(orderIds?: string[]): Promise<PickList> {
  return apiFetch(
    `/api/staff/fulfilment/pick-list${query({ orderIds: orderIds && orderIds.length > 0 ? orderIds.join(',') : undefined })}`,
  );
}

export interface PackingSlipLine {
  lineNumber: number;
  productName: string;
  variantLabel: string;
  quantity: number;
  batchNumbers: string[];
}

export interface PackingSlip {
  orderId: string;
  orderNumber: string;
  placedOn: string;
  customerName: string;
  recipientName: string;
  recipientPhone: string | null;
  fulfilmentMethod: OrderFulfilment;
  addressText: string | null;
  pickupBranchName: string | null;
  slot: string | null;
  lines: PackingSlipLine[];
  codAmountDue: Money | null;
  deliveryInstructions: string | null;
  branchTimeZoneId: string;
}

export function getPackingSlip(orderId: string): Promise<PackingSlip> {
  return apiFetch(`${orderPath(orderId)}/packing-slip`);
}

/** Saves a branch-scoped file through the one XHR download path (CSRF and `X-Branch-Id` kept; no second fetch site). */
export function downloadOrderingFile(path: string, fallbackName: string): Promise<void> {
  return downloadBillingFile(path, fallbackName);
}

/** The path of the courier manifest CSV — downloaded through `downloadOrderingFile` (headers kept). */
export function manifestPath(courierId: string, date: string): string {
  return `/api/staff/fulfilment/manifest.csv${query({ courierId, date })}`;
}

// ---- reconciliation issues ---------------------------------------------------------------------------

export interface ReconciliationIssue {
  id: string;
  orderId: string | null;
  kind: string;
  paymentMethod: string;
  amount: Money;
  paymentReference: string | null;
  paymentReceivedOn: string | null;
  errorSummary: string;
  raisedBy: string;
  raisedOn: string;
  status: 'Open' | 'Resolved';
  resolvedBy: string | null;
  resolvedOn: string | null;
  resolutionNote: string | null;
}

export function listReconciliationIssues(filters: {
  status?: string;
  pageNumber?: number;
  pageSize?: number;
}): Promise<PagedResult<ReconciliationIssue>> {
  return apiFetch(`/api/staff/orders/reconciliation-issues${query({ ...filters })}`);
}

export function resolveReconciliationIssue(issueId: string, note: string): Promise<void> {
  return apiFetch(
    `/api/staff/orders/reconciliation-issues/${encodeURIComponent(issueId)}/resolve`,
    { method: 'POST', body: { note } },
  );
}
