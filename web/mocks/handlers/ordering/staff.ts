import { http, HttpResponse, type HttpHandler } from 'msw';
import {
  forbidden,
  noContent,
  notFound,
  orderingIds as ids,
  paged,
  pageParams,
  violation,
  violations,
} from './fixtures';
import {
  addDays,
  allocateOrder,
  batchFor,
  db,
  expireOverdueTransfers,
  findOrder,
  findReturn,
  formatCents,
  money,
  nextInvoiceNumber,
  nowIso,
  persist,
  pushStatus,
  skuInfo,
  staffNameOf,
  stockOf,
  todayLocal,
  uuid,
  APPROVAL_THRESHOLD_CENTS,
  RIDER_CARRIER_NAME,
  type DbOrder,
  type DbRider,
  type DbReturn,
} from './store';
import { totalsView } from './customer';
import { getStaffRoleIdsForRequest } from '../areas/accounts';

/**
 * `mocks/handlers/ordering/staff.ts` — HO-ORD-002 §12.1. The staff endpoints of HO-ORD-001 §12.4 as
 * `StaffOrdersController`, `StaffFulfilmentController`, `StaffReturnsController` and
 * `StaffOrderReconciliationController` really send them (restock / write-off is gone; the held-payment
 * approver may not be the recorder; COD and counter payments never wait for approval — only a
 * bank-transfer confirmation above the threshold does). Role checks are not modelled — a test that
 * needs a `403` overrides the route with `server.use(...)`.
 */

const API = '*/api/staff';

/**
 * How the API binds `from` / `to` (`DateTimeOffset?`): a value with an offset or `Z` is that instant; one
 * without - a bare date, or a date-time with no zone - is read in the server's zone, UTC. (JavaScript's own
 * `Date.parse` would read a zone-less date-time in the machine's zone, which is not what the backend does.)
 */
function parseQueryInstant(text: string): number {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  if (hasZone) return Date.parse(text);
  const withTime = text.includes('T') ? text : `${text}T00:00:00`;
  return Date.parse(`${withTime}Z`);
}

const fulfilmentSummary = (o: DbOrder) => o.fulfilment;

function flagsOf(o: DbOrder): string[] {
  const flags: string[] = [];
  if (o.held) flags.push('AwaitingApproval');
  if (o.customerTransferReference && o.status === 'PendingPayment' && !o.held) flags.push('TransferReported');
  if (o.courierReportsDelivered && o.status === 'Dispatched') flags.push('CourierReportsDelivered');
  if (o.fulfilmentMethod === 'Pickup' && o.status === 'Dispatched' && o.collectBy && o.collectBy < todayLocal()) {
    flags.push('CollectionOverdue');
  }
  return flags;
}

function queueRow(o: DbOrder) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    placedOn: o.placedOn,
    customerName: o.customerName,
    status: o.status,
    fulfilmentMethod: o.fulfilmentMethod,
    paymentMethod: o.paymentMethod,
    channel: o.channel,
    grandTotal: money(o.grandTotalCents),
    ageMinutes: Math.max(0, Math.round((Date.now() - Date.parse(o.placedOn)) / 60_000)),
    flags: flagsOf(o),
    branchTimeZoneId: ids.timeZoneId,
    // HO-P5 BG-3 (Read/QueryHandlers/Order/StaffOrderQueryHandlers.cs:62,79-80): the order's own fulfilment
    // fields; a pickup or counter order has none, so they are null.
    deliveryZone: o.fulfilment.zoneName,
    deliveryDistrict: o.fulfilment.district,
    slotDate: o.fulfilment.slotDate,
    slotWindowLabel: o.fulfilment.slotWindow,
  };
}

/**
 * `allowedActions[]` from the same table the aggregate enforces (Domain/DomainServices/OrderTransitionRules.cs:46-66),
 * narrowed by fulfilment as `AllowedActions` does (:99-113): Dispatch is a delivery's, MarkReadyForCollection a pickup's.
 */
function allowedActionsOf(o: DbOrder): string[] {
  switch (o.status) {
    case 'PendingPayment':
      return o.paymentMethod === 'BankTransfer' ? ['ConfirmPayment', 'Cancel'] : ['Cancel'];
    case 'Confirmed':
      return o.fulfilmentMethod === 'Counter' ? [] : ['StartPacking', 'Cancel'];
    case 'Packing':
      // Counter orders never reach Packing; the table would give them MarkPacked and Cancel only.
      return [
        'MarkPacked',
        ...(o.fulfilmentMethod === 'Delivery' ? ['Dispatch'] : []),
        ...(o.fulfilmentMethod === 'Pickup' ? ['MarkReadyForCollection'] : []),
        'Cancel',
      ];
    case 'Packed':
      return [
        ...(o.fulfilmentMethod === 'Delivery' ? ['Dispatch'] : []),
        ...(o.fulfilmentMethod === 'Pickup' ? ['MarkReadyForCollection'] : []),
        'Cancel',
      ];
    case 'Dispatched':
      return ['RecordDelivery', 'RecordDeliveryFailure'];
    case 'Delivered':
    case 'Returned':
      return ['Refund'];
    default:
      return [];
  }
}

function staffDetail(o: DbOrder) {
  return {
    id: o.id,
    version: o.version,
    orderNumber: o.orderNumber,
    placedOn: o.placedOn,
    channel: o.channel,
    customerId: o.customerId,
    status: o.status,
    fulfilmentMethod: o.fulfilmentMethod,
    paymentMethod: o.paymentMethod,
    branchTimeZoneId: ids.timeZoneId,
    // HO-P5 BG-4: Read/ViewModels/StaffOrderViewModels.cs:38 (`PackedOn`, null until packed).
    packedOn: o.packedOn ?? null,
    lines: o.lines.map((l) => ({
      lineId: l.lineId,
      lineNumber: l.lineNumber,
      skuId: l.skuId,
      productName: l.productName,
      variantLabel: l.variantLabel,
      quantity: l.quantity,
      unitPrice: money(l.unitCents),
      lineTotal: money(l.totalCents),
      quantityReturned: l.quantityReturned,
      allocations: l.allocations,
      // HO-P5 BG-4: the staff line view only (Read/ViewModels/StaffOrderViewModels.cs:17-19). The customer
      // line view in customer.ts, which pos.ts also imports, never carries these.
      picked: l.picked ?? false,
      pickedOn: l.pickedOn ?? null,
      pickedBy: l.pickedBy ?? null,
    })),
    totals: totalsView(o),
    // `riderNote` is always present on the server's fulfilment view (null when none): Read/ViewModels/OrderViewModels.cs:23.
    fulfilment: { ...fulfilmentSummary(o), riderNote: o.fulfilment.riderNote ?? null },
    statusHistory: o.history,
    paymentDueBy: o.paymentDueBy,
    customerTransferReference: o.customerTransferReference,
    heldPayment: o.held
      ? { amount: money(o.held.amountCents), recordedBy: o.held.recordedBy, recordedOn: o.held.recordedOn }
      : null,
    codCollection: o.cod
      ? {
          amount: money(o.cod.amountCents),
          collectorKind: o.cod.collectorKind,
          collectorName: o.cod.collectorName,
          collectedOn: o.cod.collectedOn,
          recordedBy: o.cod.recordedBy,
        }
      : null,
    // `courierId` is null and `riderId` / `riderName` are set for an in-house rider (StaffOrderViewModels.cs:27-30).
    shipment: o.shipment
      ? {
          ...o.shipment,
          riderId: o.shipment.riderId ?? null,
          riderName: o.shipment.riderName ?? null,
          lastTrackingEventOn: o.shipment.lastTrackingStatus ? o.shipment.dispatchedOn : null,
        }
      : null,
    collectBy: o.collectBy,
    invoiceId: o.invoiceNumber ? `1${o.id.slice(1)}` : null,
    invoiceNumber: o.invoiceNumber,
    payments:
      o.amountPaidCents > 0
        ? [
            {
              paymentId: `9${o.id.slice(1)}`,
              method: o.paymentMethod === 'BankTransfer' ? 'BankTransfer' : o.paymentMethod === 'InStore' ? 'Cash' : 'CashInStore',
              amount: money(o.amountPaidCents),
              recordedOn: o.history[o.history.length - 1]?.changedOn ?? o.placedOn,
            },
          ]
        : [],
    creditNoteIds: db.refunds.filter((r) => r.orderId === o.id).map((r) => `c${r.id.slice(1)}`),
    amountPaid: money(o.amountPaidCents),
    amountRefunded: money(o.amountRefundedCents),
    refundDue: money(o.refundDueCents),
    discountCode: o.discountCode,
    customerAnonymised: false,
    allowedActions: allowedActionsOf(o),
  };
}

function staffId(): string {
  return db.actor;
}

function releaseStock(order: DbOrder): void {
  for (const l of order.lines) db.stock[l.skuId] = stockOf(l.skuId) + l.quantity;
}

function notFoundOrder(orderId: string | readonly string[] | undefined): DbOrder | undefined {
  return findOrder(String(orderId));
}

function bump(order: DbOrder): void {
  order.version += 1;
  persist();
}

function returnRow(r: DbReturn) {
  const order = findOrder(r.orderId);
  return {
    id: r.id,
    orderId: r.orderId,
    orderNumber: order?.orderNumber ?? '',
    customerName: order?.customerName ?? '',
    kind: r.kind,
    status: r.status,
    requestedOn: r.requestedOn,
    lineCount: r.lines.length,
    quantity: r.lines.reduce((sum, l) => sum + l.quantity, 0),
  };
}

function requiresDefect(returnClass: string, condition: string, reason: string): boolean {
  return returnClass === 'Food' && condition !== 'Sealed' && reason === 'QualityDefect';
}

function returnDetail(r: DbReturn) {
  const order = findOrder(r.orderId);
  return {
    id: r.id,
    version: r.version,
    orderId: r.orderId,
    orderNumber: order?.orderNumber ?? '',
    customerName: order?.customerName ?? '',
    kind: r.kind,
    status: r.status,
    requestedOn: r.requestedOn,
    requestedBy: r.requestedBy,
    decidedOn: r.decidedOn,
    decidedBy: r.decidedBy,
    decisionNote: r.decisionNote,
    receivedOn: r.receivedOn,
    branchTimeZoneId: ids.timeZoneId,
    lines: r.lines.map((l) => {
      const orderLine = order?.lines.find((x) => x.lineId === l.orderLineId);
      const batches = orderLine?.allocations ?? [];
      return {
        orderLineId: l.orderLineId,
        productName: orderLine?.productName ?? '',
        variantLabel: orderLine?.variantLabel ?? '',
        quantity: l.quantity,
        reason: l.reason,
        condition: l.condition,
        customerNote: l.customerNote,
        requiresDefectConfirmation: requiresDefect(orderLine?.returnClass ?? 'Other', l.condition, l.reason),
        defectConfirmed: l.defectConfirmed,
        defectNote: l.defectNote,
        quantityReceived: l.quantityReceived,
        anyBatchRecalled: batches.some((b) => db.recalledBatches.includes(b.batchId)),
        batchNumbers: batches.map((b) => b.batchNumber),
      };
    }),
  };
}

function suggestedFor(order: DbOrder) {
  return db.returns
    .filter(
      (r) =>
        r.orderId === order.id &&
        (r.status === 'Received' || r.status === 'Closed') &&
        !db.refunds.some((f) => f.returnRequestId === r.id),
    )
    .map((r) => ({
      returnRequestId: r.id,
      suggestedAmount: money(
        r.lines.reduce((sum, l) => {
          const orderLine = order.lines.find((x) => x.lineId === l.orderLineId);
          return sum + (orderLine ? orderLine.unitCents * l.quantityReceived : 0);
        }, 0),
      ),
    }));
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// ---- the queue's filters, shared by the list and `status-counts` -----------------------------------------

/** Pipeline order of every status: Read/QueryHandlers/Order/StaffOrderQueryHandlers.cs:89-93. */
const PIPELINE_ORDER = ['PendingPayment', 'Confirmed', 'Packing', 'Packed', 'Dispatched', 'Delivered', 'Cancelled', 'Returned', 'Refunded'] as const;
const FULFILMENT_NAMES = ['Delivery', 'Pickup', 'Counter'];
const PAYMENT_NAMES = ['CashOnDelivery', 'BankTransfer', 'PayOnCollection', 'InStore'];
/** `Subscription` is a real channel the filter accepts (Shared/Common/Enums/OrderChannel.cs:8); the UI offers no tab for it (OQ-11). */
const CHANNEL_NAMES = ['Online', 'Counter', 'Subscription'];

/** `EnumerationParsing.TryParse`: blank is no filter, a name matches case-insensitively (Shared/Common/Enums/EnumerationParsing.cs:20-30). */
function enumName(value: string | null, names: readonly string[]): string | undefined | null {
  if (value === null || value.trim() === '') return undefined;
  return names.find((name) => name.toLowerCase() === value.toLowerCase()) ?? null;
}

const badFilter = (message: string) => HttpResponse.json({ error: message }, { status: 400 });

/** The server's 400s for a malformed filter: Api/Controllers/StaffOrdersController.cs:123-127 (list) and :146-150 (status-counts). */
function refuseQueueFilters(url: URL, withStatus: boolean): Response | null {
  const get = (key: string) => url.searchParams.get(key);
  if (withStatus && enumName(get('status'), PIPELINE_ORDER) === null) return badFilter('status is not an order status.');
  if (enumName(get('fulfilment'), FULFILMENT_NAMES) === null) return badFilter('fulfilment is not a fulfilment method.');
  if (enumName(get('paymentMethod'), PAYMENT_NAMES) === null) return badFilter('paymentMethod is not a payment method.');
  if (enumName(get('channel'), CHANNEL_NAMES) === null) return badFilter('channel is not an order channel.');
  if ((get('search') ?? '').length > 100) return badFilter('search is too long.');
  return null;
}

/** The orders under the queue's filters. `withStatus` is false for `status-counts`, which ignores `status` (Read/QueryHandlers/Order/StaffOrderQueryHandlers.cs:96-98). */
function filteredOrders(url: URL, withStatus: boolean): DbOrder[] {
  const text = (key: string) => url.searchParams.get(key) || undefined;
  const status = withStatus ? enumName(text('status') ?? null, PIPELINE_ORDER) : undefined;
  const fulfilment = enumName(text('fulfilment') ?? null, FULFILMENT_NAMES);
  const payment = enumName(text('paymentMethod') ?? null, PAYMENT_NAMES);
  const channel = enumName(text('channel') ?? null, CHANNEL_NAMES);
  const search = text('search')?.trim().toLowerCase();
  const from = text('from');
  const to = text('to');
  return db.orders
    .filter((o) => !status || o.status === status)
    .filter((o) => !fulfilment || o.fulfilmentMethod === fulfilment)
    .filter((o) => !payment || o.paymentMethod === payment)
    .filter((o) => !channel || o.channel === channel)
    .filter((o) => !from || Date.parse(o.placedOn) >= parseQueryInstant(from))
    .filter((o) => !to || Date.parse(o.placedOn) <= parseQueryInstant(to))
    .filter(
      (o) =>
        !search ||
        o.orderNumber.toLowerCase().includes(search) ||
        o.customerName.toLowerCase().includes(search) ||
        (o.customerMobile ?? '').includes(search),
    );
}

// ---- roles and riders (HO-P5 BG-5) --------------------------------------------------------------------

/** Orders.Fulfil: Shared/Common/Constants/ActionRoles.Orders.cs:14. Riders.Manage: :26. */
const FULFIL_ROLES = ['Reception', 'ShopManager', 'Administrator'];
const RIDER_MANAGE_ROLES = ['ShopManager', 'Administrator'];

/**
 * True when the request carries a staff session whose roles hold none of `allowed` -- the server's `403` from
 * `[RequireAction]`. A request with no staff session is "not modelled" and passes, like the other mocks.
 */
function lacksRole(request: Request, allowed: readonly string[]): boolean {
  const roles = roleOverride ?? getStaffRoleIdsForRequest(request);
  return roles !== null && !roles.some((role) => allowed.includes(role));
}

let roleOverride: string[] | null = null;

/** Test seam, like `setMockReportRoles`: answer as these roles regardless of the session cookie. `null` clears it. */
export function setMockOrderingRoles(roles: string[] | null): void {
  roleOverride = roles;
}

/** Shared/Common/Constants/OrderRules.cs:38 (`MaxNameLength`), `MobileNumber.MaxLength`/`Create` and `NoControlCharacters`. */
const RIDER_NAME_MAX = 100;
const RIDER_MOBILE_VALIDATOR_MAX = 30;
const DISALLOWED_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

/**
 * `MobileNumber.Create` (Domain/ValueObjects/MobileNumber.cs:21-48): strips spaces, `-` and parentheses, accepts
 * `01XXXXXXXXX`, `+8801XXXXXXXXX` or `8801XXXXXXXXX` (optionally after `00`), and stores `+8801XXXXXXXXX`.
 */
function normaliseMobile(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-()]/g, '');
  if (cleaned === '') return null;
  const hasPlus = cleaned.startsWith('+');
  let digits = hasPlus ? cleaned.slice(1) : cleaned;
  if (digits === '' || !/^\d+$/.test(digits)) return null;
  if (!hasPlus && digits.startsWith('00')) digits = digits.slice(2);
  let local: string;
  if (digits.length === 13 && digits.startsWith('880')) local = `0${digits.slice(3)}`;
  else if (digits.length === 11 && digits.startsWith('01')) local = digits;
  else return null;
  if (local.length !== 11 || !local.startsWith('01')) return null;
  return `+880${local.slice(1)}`;
}

/** `RiderViewModel` (Read/ViewModels/RiderViewModels.cs:4): never the branch. A seeded raw number reads back normalised. */
function riderView(r: DbRider) {
  const mobile = r.mobileNumber ? (normaliseMobile(r.mobileNumber) ?? r.mobileNumber) : null;
  return { id: r.id, name: r.name, mobileNumber: mobile, isActive: r.isActive };
}

interface RiderBody {
  name?: string;
  mobileNumber?: string | null;
  isActive?: boolean;
}

/**
 * `CreateRiderCommandValidator` / `UpdateRiderCommandValidator` (Application/CommandHandlers/Validators/RiderCommandValidators.cs:12-26),
 * then the aggregate's `Apply` (Domain/Aggregates/Order/RiderAggregate.cs:48-56): the shape, and a mobile that is a real number.
 */
function refuseRiderBody(body: RiderBody): Response | null {
  const name = body.name ?? '';
  if (name === '') return violation('Name', 'NotEmptyValidator', "Enter the rider's name.");
  if (name.length > RIDER_NAME_MAX) return violation('Name', 'MaximumLengthValidator', `Use up to ${RIDER_NAME_MAX} characters for the name.`);
  if (DISALLOWED_CONTROL.test(name)) return violation('Name', 'PredicateValidator', 'must not contain control characters.');
  const mobile = body.mobileNumber ?? '';
  if (mobile.length > RIDER_MOBILE_VALIDATOR_MAX) return violation('MobileNumber', 'MaximumLengthValidator', 'Use up to 30 characters for the mobile number.');
  if (DISALLOWED_CONTROL.test(mobile)) return violation('MobileNumber', 'PredicateValidator', 'must not contain control characters.');
  if (name.trim() === '') return violation('Name', 'InvalidRider', `A rider name is required (up to ${RIDER_NAME_MAX} characters).`);
  if (mobile.trim() !== '' && normaliseMobile(mobile) === null) {
    return violation('MobileNumber', 'InvalidMobileNumber', 'This does not look like a valid mobile number.');
  }
  return null;
}

const RIDER_NAME_TAKEN = 'A rider with this name already exists at this branch.';

export const staffOrderingHandlers: HttpHandler[] = [
  // ---- queue and detail -----------------------------------------------------------------------------
  http.get(`${API}/orders/awaiting-payment`, () => {
    expireOverdueTransfers();
    return HttpResponse.json(
      db.orders
        .filter((o) => o.status === 'PendingPayment' && o.paymentMethod === 'BankTransfer')
        .sort((a, b) => (a.paymentDueBy ?? '').localeCompare(b.paymentDueBy ?? ''))
        .map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          amount: money(o.grandTotalCents),
          paymentDueBy: o.paymentDueBy,
          customerTransferReference: o.customerTransferReference,
          transferReportedOn: o.transferReportedOn,
          heldPayment: o.held
            ? { amount: money(o.held.amountCents), recordedBy: o.held.recordedBy, recordedOn: o.held.recordedOn }
            : null,
          version: o.version,
          branchTimeZoneId: ids.timeZoneId,
        })),
    );
  }),

  http.get(`${API}/orders/refunds-due`, ({ request }) => {
    const url = new URL(request.url);
    const { pageNumber, pageSize } = pageParams(url, 20);
    const rows = db.orders
      .filter((o) => o.refundDueCents > 0 || (o.amountPaidCents > o.amountRefundedCents && suggestedFor(o).length > 0))
      .map((o) => ({
        orderId: o.id,
        orderNumber: o.orderNumber,
        customerName: o.fulfilment.recipientName,
        status: o.status,
        amountPaid: money(o.amountPaidCents),
        amountRefunded: money(o.amountRefundedCents),
        refundDue: money(o.refundDueCents),
        cancelledOn: o.status === 'Cancelled' ? (o.history[o.history.length - 1]?.changedOn ?? null) : null,
        branchTimeZoneId: ids.timeZoneId,
        reasons: [o.refundDueCents > 0 ? 'MoneyOwedBack' : null, suggestedFor(o).length > 0 ? 'ReturnReceived' : null].filter(
          (x): x is string => x !== null,
        ),
      }));
    return HttpResponse.json(paged(rows, pageNumber, pageSize));
  }),

  http.get(`${API}/orders/reconciliation-issues`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const { pageNumber, pageSize } = pageParams(url, 20);
    const rows = db.issues
      .filter((i) => !status || i.status === status)
      .map((i) => ({
        id: i.id,
        orderId: i.orderId,
        kind: i.kind,
        paymentMethod: i.paymentMethod,
        amount: money(i.amountCents),
        paymentReference: i.paymentReference,
        paymentReceivedOn: i.paymentReceivedOn,
        errorSummary: i.errorSummary,
        raisedBy: i.raisedBy,
        raisedOn: i.raisedOn,
        status: i.status,
        resolvedBy: i.resolvedBy,
        resolvedOn: i.resolvedOn,
        resolutionNote: i.resolutionNote,
      }));
    return HttpResponse.json(paged(rows, pageNumber, pageSize));
  }),

  http.post(`${API}/orders/reconciliation-issues/:issueId/resolve`, async ({ request, params }) => {
    const issue = db.issues.find((i) => i.id === params.issueId);
    if (!issue) return notFound();
    const { note } = (await request.json()) as { note?: string };
    if (!note?.trim()) return violation('Note', 'ResolutionNoteRequired', 'Enter a note saying how this was resolved.');
    issue.status = 'Resolved';
    issue.resolvedBy = staffId();
    issue.resolvedOn = nowIso();
    issue.resolutionNote = note.trim();
    persist();
    return noContent();
  }),

  // HO-P5 BG-2: the order count in every status under the queue's filters bar `status`, every status listed,
  // zeros included, in pipeline order. Api/Controllers/StaffOrdersController.cs:139-158;
  // Read/QueryHandlers/Order/StaffOrderQueryHandlers.cs:87-105. `total` is the sum, worked out here because
  // this handler IS the server (the browser never adds counts up).
  http.get(`${API}/orders/status-counts`, ({ request }) => {
    expireOverdueTransfers();
    const url = new URL(request.url);
    const refused = refuseQueueFilters(url, false);
    if (refused) return refused;
    const matching = filteredOrders(url, false);
    const counts = PIPELINE_ORDER.map((status) => ({
      status,
      count: matching.filter((o) => o.status === status).length,
    }));
    return HttpResponse.json({ total: counts.reduce((sum, c) => sum + c.count, 0), counts });
  }),

  http.get(`${API}/orders`, ({ request }) => {
    expireOverdueTransfers();
    const url = new URL(request.url);
    const refused = refuseQueueFilters(url, true);
    if (refused) return refused;
    const { pageNumber, pageSize } = pageParams(url, 25);
    const rows = filteredOrders(url, true)
      .sort((a, b) => b.placedOn.localeCompare(a.placedOn))
      .map(queueRow);
    return HttpResponse.json(paged(rows, pageNumber, pageSize));
  }),

  // HO-ORD-001-FU2: the customer's own orders (matched by customer id, never by text), newest first.
  http.get(`${API}/customers/:customerId/orders`, ({ params, request }) => {
    const { pageNumber, pageSize } = pageParams(new URL(request.url), 20);
    // The real endpoint answers 404 when no customer account has that id; the mock knows the customers that have orders.
    if (params.customerId !== ids.customerId && !db.orders.some((o) => o.customerId === params.customerId)) return notFound();
    const rows = db.orders
      .filter((o) => o.customerId === params.customerId)
      .sort((a, b) => b.placedOn.localeCompare(a.placedOn))
      .map((o) => {
        const row: Partial<ReturnType<typeof queueRow>> = queueRow(o);
        delete row.customerName;
        delete row.ageMinutes;
        delete row.flags;
        // StaffCustomerOrderRowViewModel (StaffOrderViewModels.cs:68) carries no delivery area or slot (BG-3).
        delete row.deliveryZone;
        delete row.deliveryDistrict;
        delete row.slotDate;
        delete row.slotWindowLabel;
        return row;
      });
    return HttpResponse.json(paged(rows, pageNumber, pageSize));
  }),

  http.get(`${API}/orders/:orderId/packing-slip`, ({ params }) => {
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    return HttpResponse.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      placedOn: order.placedOn,
      customerName: order.customerName,
      recipientName: order.fulfilment.recipientName,
      recipientPhone: order.fulfilment.recipientPhone,
      fulfilmentMethod: order.fulfilmentMethod,
      addressText: order.fulfilmentMethod === 'Delivery'
        ? [order.fulfilment.line1, order.fulfilment.line2, order.fulfilment.city, order.fulfilment.district, order.fulfilment.postalCode].filter(Boolean).join(', ')
        : null,
      pickupBranchName: order.fulfilment.pickupBranchName,
      slot: order.fulfilment.slotWindow,
      lines: order.lines.map((l) => ({
        lineNumber: l.lineNumber,
        productName: l.productName,
        variantLabel: l.variantLabel,
        quantity: l.quantity,
        batchNumbers: l.allocations.map((a) => a.batchNumber),
      })),
      codAmountDue: order.paymentMethod === 'CashOnDelivery' ? money(order.grandTotalCents) : null,
      deliveryInstructions: order.fulfilment.deliveryInstructions,
      branchTimeZoneId: ids.timeZoneId,
    });
  }),

  http.get(`${API}/orders/:orderId`, ({ params }) => {
    expireOverdueTransfers();
    const order = notFoundOrder(params.orderId);
    return order ? HttpResponse.json(staffDetail(order)) : notFound();
  }),

  // ---- payment ---------------------------------------------------------------------------------------
  http.post(`${API}/orders/:orderId/payment/bank-transfer`, async ({ request, params }) => {
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    const key = request.headers.get('Idempotency-Key');
    if (!key) return violation('Idempotency-Key', 'IdempotencyKeyRequired', 'An Idempotency-Key header is required.');
    const replay = db.idempotency[key];
    if (replay) return HttpResponse.json(replay.body as object, { status: replay.status });
    const body = (await request.json()) as { expectedVersion: number; amount: unknown; bankReference?: string; receivedOn?: string };
    if (order.version !== body.expectedVersion) {
      return violation('ExpectedVersion', 'StaleVersion', 'This order changed while you were working.', 409);
    }
    if (order.status !== 'PendingPayment' || order.paymentMethod !== 'BankTransfer') {
      return violation('OrderId', 'OrderNotAwaitingPayment', 'This order is not waiting for a payment.');
    }
    if (order.held) {
      return violation('OrderId', 'PaymentAlreadyAwaitingApproval', 'A payment for this order is already waiting for approval.');
    }
    const cents = Math.round(Number(body.amount) * 100);
    if (cents !== order.grandTotalCents) {
      return violation('Amount', 'TransferAmountMismatch', `The amount must match the order total of ${formatCents(order.grandTotalCents)}.`);
    }
    if (!body.bankReference?.trim()) {
      return violation('BankReference', 'BankReferenceRequired', 'Enter the reference from the bank record.');
    }
    let response: { status: string; awaitingApproval: boolean };
    if (order.grandTotalCents > APPROVAL_THRESHOLD_CENTS) {
      order.held = {
        amountCents: cents,
        bankReference: body.bankReference.trim(),
        recordedBy: staffId(),
        recordedOn: nowIso(),
      };
      order.invoiceNumber ??= nextInvoiceNumber();
      response = { status: 'PendingPayment', awaitingApproval: true };
    } else {
      pushStatus(order, 'Confirmed', 0, staffId());
      order.amountPaidCents = cents;
      allocateOrder(order);
      response = { status: 'Confirmed', awaitingApproval: false };
    }
    bump(order);
    db.idempotency[key] = { status: 200, body: response };
    persist();
    return HttpResponse.json(response);
  }),

  http.post(`${API}/orders/:orderId/payment/approve`, async ({ request, params }) => {
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    const key = request.headers.get('Idempotency-Key');
    if (!key) return violation('Idempotency-Key', 'IdempotencyKeyRequired', 'An Idempotency-Key header is required.');
    const replay = db.idempotency[key];
    if (replay) return HttpResponse.json(replay.body as object, { status: replay.status });
    const body = (await request.json()) as { expectedVersion: number };
    if (order.version !== body.expectedVersion) {
      return violation('ExpectedVersion', 'StaleVersion', 'This order changed while you were working.', 409);
    }
    if (!order.held) return violation('OrderId', 'NoPaymentAwaitingApproval', 'No payment is waiting for approval on this order.');
    if (order.held.recordedBy === staffId()) {
      return violation('OrderId', 'SecondApproverMustDiffer', 'Someone else must approve a payment you recorded.');
    }
    pushStatus(order, 'Confirmed', 0, staffId());
    order.amountPaidCents = order.held.amountCents;
    order.held = null;
    allocateOrder(order);
    bump(order);
    const response = { status: 'Confirmed' };
    db.idempotency[key] = { status: 200, body: response };
    persist();
    return HttpResponse.json(response);
  }),

  http.post(`${API}/orders/:orderId/payment/reject`, async ({ request, params }) => {
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    const { note } = (await request.json()) as { note?: string };
    if (!order.held) return violation('OrderId', 'NoPaymentAwaitingApproval', 'No payment is waiting for approval on this order.');
    if (order.held.recordedBy === staffId()) {
      return violation('OrderId', 'ApproverMustDiffer', 'Someone else must reject a payment you recorded.');
    }
    if (!note?.trim()) return violation('Note', 'NoteRequired', 'Enter a note saying why you are rejecting it.');
    order.held = null;
    bump(order);
    return noContent();
  }),

  http.post(`${API}/orders/:orderId/cancel`, async ({ request, params }) => {
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    const { note } = (await request.json()) as { note?: string };
    if (!note?.trim()) return violation('Note', 'CancellationReasonRequired', 'Enter a reason for cancelling.');
    // The table lets PendingPayment, Confirmed, Packing and (HO-P5 BG-4) Packed be cancelled: Domain/DomainServices/OrderTransitionRules.cs:50,59,64.
    if (!['PendingPayment', 'Confirmed', 'Packing', 'Packed'].includes(order.status)) {
      return violation('OrderId', 'InvalidOrderTransition', `A ${order.status.toLowerCase()} order cannot be cancelled.`);
    }
    pushStatus(order, 'Cancelled', 0, staffId());
    order.history[order.history.length - 1]!.note = note.trim();
    order.cancellationReason = 'StaffDecision';
    order.held = null;
    if (order.amountPaidCents > 0) order.refundDueCents = order.amountPaidCents - order.amountRefundedCents;
    releaseStock(order);
    bump(order);
    return noContent();
  }),

  // ---- fulfilment -------------------------------------------------------------------------------------
  http.post(`${API}/orders/:orderId/packing`, ({ params }) => {
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    if (order.status !== 'Confirmed') {
      return violation('OrderId', 'InvalidOrderTransition', `A ${order.status.toLowerCase()} order cannot be packed.`);
    }
    pushStatus(order, 'Packing', 0, staffId());
    bump(order);
    return noContent();
  }),

  // HO-P5 BG-4: Packing -> Packed, optional. Api/Controllers/StaffOrdersController.cs:194-205; the handler
  // (Application/CommandHandlers/Order/OrderFulfilmentCommandHandlers.cs:40-60) and OrderAggregate.MarkPacked
  // (Domain/Aggregates/Order/OrderAggregate.cs:406-414): any status but Packing is InvalidOrderTransition naming
  // the state, then every line must be allocated (the pick ticks never gate it). Orders.Fulfil.
  http.post(`${API}/orders/:orderId/packed`, ({ request, params }) => {
    if (lacksRole(request, FULFIL_ROLES)) return forbidden();
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    if (order.status !== 'Packing') {
      return violation('OrderStatus', 'InvalidOrderTransition', `A ${order.status.toLowerCase()} order cannot be marked as packed.`);
    }
    if (order.lines.some((l) => l.allocations.length === 0)) {
      return violation('Lines', 'OrderNotFullyAllocated', 'This order has items that are not reserved from stock. Reallocate them first.');
    }
    pushStatus(order, 'Packed', 0, staffId());
    order.packedOn = nowIso();
    bump(order);
    return noContent();
  }),

  // HO-P5 BG-4: tick or untick one line of the pick list; persisted, idempotent. Api/Controllers/StaffOrdersController.cs:207-221;
  // OrderAggregate.SetLinePicked (Domain/Aggregates/Order/OrderAggregate.cs:421-433): allowed in Confirmed, Packing
  // and Packed only (else 400 InvalidOrderTransition, checked BEFORE the line), an unknown line is 404 OrderLineNotFound,
  // and a repeat changes nothing (the version moves only when the tick changed -- OrderLine.SetPicked, OrderLine.cs:87-95).
  http.put(`${API}/orders/:orderId/lines/:lineId/picked`, async ({ request, params }) => {
    if (lacksRole(request, FULFIL_ROLES)) return forbidden();
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    const body = (await request.json().catch(() => ({}))) as { picked?: boolean };
    if (!['Confirmed', 'Packing', 'Packed'].includes(order.status)) {
      return violation('Status', 'InvalidOrderTransition', 'Pick ticks can only be changed while the order is being prepared.');
    }
    const line = order.lines.find((l) => l.lineId === params.lineId);
    if (!line) return violation('lineId', 'OrderLineNotFound', 'That order line was not found.', 404);
    const picked = body.picked === true;
    if ((line.picked ?? false) === picked) return noContent();
    line.picked = picked;
    line.pickedOn = picked ? nowIso() : null;
    line.pickedBy = picked ? staffId() : null;
    bump(order);
    return noContent();
  }),

  // Dispatch: exactly one of courierId / riderId. The validator runs first
  // (Application/CommandHandlers/Validators/OrderFulfilmentCommandValidators.cs:42-50: `DispatchTargetInvalid` on CourierId; a rider
  // delivery has no tracking number), then the handler (OrderFulfilmentCommandHandlers.cs:105-145): unknown order 404, an
  // unknown or inactive courier 404 CourierNotFound, a rider who is unknown, inactive or of another branch 404 RiderNotFound
  // (Api/Ordering/OrderingResults.cs:15-21), then the aggregate (OrderAggregate.cs:436-447): only a delivery order, every line
  // allocated, then the move from Packing or Packed.
  http.post(`${API}/orders/:orderId/dispatch`, async ({ request, params }) => {
    if (lacksRole(request, FULFIL_ROLES)) return forbidden();
    const body = (await request.json()) as { courierId?: string | null; riderId?: string | null; trackingNumber?: string | null };
    const hasCourier = !!body.courierId && body.courierId !== '00000000-0000-0000-0000-000000000000';
    const hasRider = !!body.riderId && body.riderId !== '00000000-0000-0000-0000-000000000000';
    if (hasCourier === hasRider) {
      return violation('CourierId', 'DispatchTargetInvalid', 'Choose either a courier or a rider to dispatch with, not both and not neither.');
    }
    if (body.riderId && (body.trackingNumber ?? '').trim() !== '') {
      return violation('TrackingNumber', 'DispatchTargetInvalid', 'A rider delivery has no tracking number.');
    }
    if ((body.trackingNumber ?? '').length > 100) {
      return violation('TrackingNumber', 'MaximumLengthValidator', 'Use up to 100 characters for the tracking number.');
    }
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    const courier = hasCourier ? db.couriers.find((c) => c.id === body.courierId && c.isActive) : undefined;
    const rider = hasRider ? db.riders.find((r) => r.id === body.riderId) : undefined;
    if (hasCourier && !courier) return violation('CourierId', 'CourierNotFound', 'That courier is not available.', 404);
    if (hasRider && !(rider && rider.isActive && rider.branchId === ids.mainBranchId)) {
      return violation('RiderId', 'RiderNotFound', 'That rider is not available.', 404);
    }
    if (order.fulfilmentMethod !== 'Delivery') {
      return violation('FulfilmentMethod', 'InvalidOrderTransition', 'A pickup order is marked ready for collection, not dispatched.');
    }
    if (order.lines.some((l) => l.allocations.length === 0)) {
      return violation('Lines', 'OrderNotFullyAllocated', 'This order has items that are not reserved from stock. Reallocate them first.');
    }
    if (order.status !== 'Packing' && order.status !== 'Packed') {
      return violation('OrderStatus', 'InvalidOrderTransition', `A ${order.status.toLowerCase()} order cannot be dispatched.`);
    }
    const recalled = order.lines.find((l) => l.allocations.some((a) => db.recalledBatches.includes(a.batchId)));
    if (recalled) {
      const batch = recalled.allocations.find((a) => db.recalledBatches.includes(a.batchId));
      return violation(
        'OrderId',
        'BatchRecalled',
        `Batch ${batch?.batchNumber ?? ''} of '${recalled.productName}' has been recalled and cannot be sent. Move that line to another batch first.`,
      );
    }
    if (rider) {
      // Shipment.ForRider (Domain/ValueObjects/Shipment.cs:43-44): no courier, the customer-facing carrier name, no tracking.
      order.shipment = {
        courierId: null,
        courierName: RIDER_CARRIER_NAME,
        trackingNumber: null,
        trackingUrl: null,
        dispatchedOn: nowIso(),
        lastTrackingStatus: null,
        riderId: rider.id,
        riderName: rider.name,
      };
    } else if (courier) {
      const tracking = body.trackingNumber?.trim() || null;
      order.shipment = {
        courierId: courier.id,
        courierName: courier.name,
        trackingNumber: tracking,
        trackingUrl: tracking && courier.trackingUrlTemplate ? courier.trackingUrlTemplate.replace('{tracking}', tracking) : null,
        dispatchedOn: nowIso(),
        lastTrackingStatus: null,
        riderId: null,
        riderName: null,
      };
    }
    pushStatus(order, 'Dispatched', 0, staffId());
    bump(order);
    return noContent();
  }),

  // A pickup order only, from Packing or (HO-P5 BG-4) Packed: OrderAggregate.cs:450-455 and OrderTransitionRules.cs:58,63.
  http.post(`${API}/orders/:orderId/ready-for-collection`, ({ request, params }) => {
    if (lacksRole(request, FULFIL_ROLES)) return forbidden();
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    if (order.fulfilmentMethod !== 'Pickup') {
      return violation('FulfilmentMethod', 'InvalidOrderTransition', 'Only a pickup order is marked ready for collection.');
    }
    if (order.lines.some((l) => l.allocations.length === 0)) {
      return violation('Lines', 'OrderNotFullyAllocated', 'This order has items that are not reserved from stock. Reallocate them first.');
    }
    if (order.status !== 'Packing' && order.status !== 'Packed') {
      return violation('OrderStatus', 'InvalidOrderTransition', `A ${order.status.toLowerCase()} order cannot be marked ready for collection.`);
    }
    order.collectBy = addDays(todayLocal(), 7);
    pushStatus(order, 'Dispatched', 0, staffId());
    bump(order);
    return noContent();
  }),

  http.put(`${API}/orders/:orderId/tracking`, async ({ request, params }) => {
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    const { trackingNumber } = (await request.json()) as { trackingNumber?: string };
    if (!order.shipment) return violation('OrderId', 'InvalidOrderTransition', 'This order has not been dispatched.');
    // OrderAggregate.RecordTracking (Domain/Aggregates/Order/OrderAggregate.cs:465-471): a rider delivery has no tracking number.
    if (order.shipment.riderId) {
      return violation('Shipment', 'InvalidOrderTransition', 'An order delivered by an in-house rider has no tracking number.');
    }
    if (!trackingNumber?.trim()) return violation('TrackingNumber', 'TrackingNumberRequired', 'Enter the tracking number.');
    const courier = db.couriers.find((c) => c.id === order.shipment!.courierId);
    order.shipment.trackingNumber = trackingNumber.trim();
    order.shipment.trackingUrl = courier?.trackingUrlTemplate
      ? courier.trackingUrlTemplate.replace('{tracking}', trackingNumber.trim())
      : null;
    bump(order);
    return noContent();
  }),

  http.post(`${API}/orders/:orderId/delivery`, async ({ request, params }) => {
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    const key = request.headers.get('Idempotency-Key');
    if (!key) return violation('Idempotency-Key', 'IdempotencyKeyRequired', 'An Idempotency-Key header is required.');
    if (db.idempotency[key]) return noContent();
    const body = (await request.json()) as {
      expectedVersion: number;
      deliveredOn: string;
      codCollection?: { amount: unknown; collectorKind: string; collectorName?: string; collectorStaffId?: string; collectedOn: string };
      collectionPayment?: { method: string; amount: unknown; reference?: string };
    };
    if (order.version !== body.expectedVersion) {
      return violation('ExpectedVersion', 'StaleVersion', 'This order changed while you were working.', 409);
    }
    if (order.status !== 'Dispatched') {
      return violation('OrderId', 'InvalidOrderTransition', `A ${order.status.toLowerCase()} order cannot be marked delivered.`);
    }
    if (order.paymentMethod === 'CashOnDelivery') {
      if (!body.codCollection) return violation('CodCollection', 'CodCollectionRequired', 'Record the cash collected on delivery.');
      if (body.codCollection.collectorKind === 'Courier' && !body.codCollection.collectorName?.trim()) {
        return violation('CodCollection.CollectorName', 'CodCollectionRequired', 'Enter the rider who collected the cash.');
      }
      const cents = Math.round(Number(body.codCollection.amount) * 100);
      order.cod = {
        amountCents: cents,
        collectorKind: body.codCollection.collectorKind === 'Staff' ? 'Staff' : 'Courier',
        collectorName: body.codCollection.collectorName?.trim() || staffNameOf(staffId()),
        collectedOn: body.codCollection.collectedOn,
        recordedBy: staffId(),
      };
      order.amountPaidCents = cents;
    } else if (order.paymentMethod === 'PayOnCollection') {
      const payment = body.collectionPayment;
      if (!payment) return violation('CollectionPayment', 'CollectionPaymentMismatch', 'Record the payment taken at collection.');
      if (payment.method === 'InStoreCard' && !payment.reference?.trim()) {
        return violation('CollectionPayment.Reference', 'TerminalReferenceRequired', 'Enter the card terminal slip reference.');
      }
      const cents = Math.round(Number(payment.amount) * 100);
      if (cents !== order.grandTotalCents) {
        return violation('CollectionPayment.Amount', 'CollectionPaymentMismatch', `The amount must be the balance due, ${formatCents(order.grandTotalCents)}.`);
      }
      order.amountPaidCents = cents;
    }
    pushStatus(order, 'Delivered', 0, staffId());
    order.returnWindowEndsOn = addDays(todayLocal(), 7);
    order.courierReportsDelivered = false;
    bump(order);
    db.idempotency[key] = { status: 204, body: null };
    persist();
    return noContent();
  }),

  http.post(`${API}/orders/:orderId/delivery-failure`, async ({ request, params }) => {
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    const body = (await request.json()) as { reason: string; note?: string };
    if (order.status !== 'Dispatched') {
      return violation('OrderId', 'InvalidOrderTransition', `A ${order.status.toLowerCase()} order cannot be marked undelivered.`);
    }
    const allowed = order.fulfilmentMethod === 'Pickup' ? ['Uncollected'] : ['Refused', 'Undeliverable'];
    if (!allowed.includes(body.reason)) {
      return violation('Reason', 'DeliveryFailureReasonInvalid', "That reason doesn't apply to this order.");
    }
    pushStatus(order, 'Returned', 0, staffId());
    if (body.note) order.history[order.history.length - 1]!.note = body.note;
    bump(order);
    if (body.reason === 'Uncollected') {
      releaseStock(order);
      persist();
      return noContent();
    }
    const created: DbReturn = {
      id: uuid(),
      version: 1,
      orderId: order.id,
      kind: 'DeliveryFailure',
      status: 'Approved',
      requestedOn: nowIso(),
      requestedBy: staffId(),
      decidedOn: nowIso(),
      decidedBy: staffId(),
      decisionNote: null,
      receivedOn: null,
      recalledBatchLines: [],
      lines: order.lines.map((l) => ({
        orderLineId: l.lineId,
        quantity: l.quantity,
        reason: 'Other',
        condition: 'Sealed',
        customerNote: null,
        defectConfirmed: false,
        defectNote: null,
        quantityReceived: 0,
      })),
    };
    db.returns.unshift(created);
    persist();
    return HttpResponse.json({ returnRequestId: created.id }, { status: 201 });
  }),

  http.post(`${API}/orders/:orderId/lines/:lineId/reallocate`, async ({ request, params }) => {
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    const line = order.lines.find((l) => l.lineId === params.lineId);
    if (!line) return notFound();
    const body = (await request.json()) as { targetBatchId: string; reason?: string };
    if (!['Confirmed', 'Packing'].includes(order.status)) {
      return violation('OrderId', 'InvalidOrderTransition', `A ${order.status.toLowerCase()} order cannot be reallocated.`);
    }
    if (!body.reason?.trim()) {
      return violation('Reason', 'ReallocationReasonRequired', 'Enter a reason for moving this line to another batch.');
    }
    if (db.recalledBatches.includes(body.targetBatchId)) {
      return violation('TargetBatchId', 'BatchRecalled', 'That batch has been recalled and cannot be used.');
    }
    const variantB = batchFor(line.skuId, 'B');
    line.allocations = [
      {
        ...(body.targetBatchId === variantB.batchId ? variantB : batchFor(line.skuId, 'A')),
        batchId: body.targetBatchId,
        quantity: line.quantity,
      },
    ];
    bump(order);
    return noContent();
  }),

  // ---- pick list, couriers, manifest -------------------------------------------------------------------
  http.get(`${API}/fulfilment/pick-list`, ({ request }) => {
    const wanted = new URL(request.url).searchParams.get('orderIds')?.split(',').filter(Boolean);
    const orders = db.orders.filter(
      (o) => (o.status === 'Confirmed' || o.status === 'Packing') && (!wanted || wanted.includes(o.id)),
    );
    const groups = new Map<string, Map<string, { alloc: ReturnType<typeof batchFor>; name: string; label: string; skuId: string; quantity: number; orders: Array<{ orderNumber: string; quantity: number }> }>>();
    for (const order of orders) {
      for (const line of order.lines) {
        for (const a of line.allocations) {
          const location = groups.get(a.locationId) ?? new Map();
          groups.set(a.locationId, location);
          const batch = location.get(a.batchId) ?? { alloc: a, name: line.productName, label: line.variantLabel, skuId: line.skuId, quantity: 0, orders: [] };
          batch.quantity += a.quantity;
          batch.orders.push({ orderNumber: order.orderNumber, quantity: a.quantity });
          location.set(a.batchId, batch);
        }
      }
    }
    return HttpResponse.json({
      generatedOn: nowIso(),
      groups: [...groups.entries()].map(([locationId, batches]) => ({
        locationId,
        locationName: [...batches.values()][0]?.alloc.locationName ?? 'Main shelf',
        batches: [...batches.entries()].map(([batchId, b]) => ({
          batchId,
          batchNumber: b.alloc.batchNumber,
          expiresOn: b.alloc.expiresOn,
          skuId: b.skuId,
          productName: b.name,
          variantLabel: b.label,
          quantity: b.quantity,
          orders: b.orders,
        })),
      })),
    });
  }),

  http.get(`${API}/fulfilment/couriers`, () => HttpResponse.json(db.couriers.filter((c) => c.isActive))),

  // ---- in-house riders (HO-P5 BG-5), Api/Controllers/StaffRidersController.cs -------------------------------
  // The list is Orders.Fulfil (:24-31), name order, `activeOnly` optional (Read/QueryHandlers/Order/RiderQueryHandlers.cs:13-23).
  // The response is `{ id, name, mobileNumber, isActive }` and never the branch.
  http.get(`${API}/riders`, ({ request }) => {
    if (lacksRole(request, FULFIL_ROLES)) return forbidden();
    const activeOnly = new URL(request.url).searchParams.get('activeOnly')?.toLowerCase() === 'true';
    return HttpResponse.json(
      db.riders
        .filter((r) => r.branchId === ids.mainBranchId && (!activeOnly || r.isActive))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(riderView),
    );
  }),

  // Riders.Manage (:34-48). A name already taken at the branch is 400 RiderNameAlreadyExists on `Name`
  // (Application/CommandHandlers/Order/RiderCommandHandlers.cs:13-34): the handler compares the trimmed name exactly
  // (Postgres equality and the unique index `ix_rider_branch_name` are case-sensitive), so "rafiq hasan" is a different rider.
  http.post(`${API}/riders`, async ({ request }) => {
    if (lacksRole(request, RIDER_MANAGE_ROLES)) return forbidden();
    const body = (await request.json()) as RiderBody;
    const refused = refuseRiderBody(body);
    if (refused) return refused;
    const name = (body.name ?? '').trim();
    if (db.riders.some((r) => r.branchId === ids.mainBranchId && r.name === name)) {
      return violation('Name', 'RiderNameAlreadyExists', RIDER_NAME_TAKEN);
    }
    const rider: DbRider = {
      id: uuid(),
      branchId: ids.mainBranchId,
      name,
      mobileNumber: body.mobileNumber?.trim() ? normaliseMobile(body.mobileNumber) : null,
      isActive: body.isActive ?? true,
    };
    db.riders.push(rider);
    persist();
    return HttpResponse.json({ riderId: rider.id }, { status: 201 });
  }),

  // Update: a rider of another branch, or none, is 404 RiderNotFound (RiderCommandHandlers.cs:42-46); the name check excludes the rider itself.
  http.put(`${API}/riders/:riderId`, async ({ request, params }) => {
    if (lacksRole(request, RIDER_MANAGE_ROLES)) return forbidden();
    const body = (await request.json()) as RiderBody;
    const refused = refuseRiderBody(body);
    if (refused) return refused;
    const rider = db.riders.find((r) => r.id === params.riderId && r.branchId === ids.mainBranchId);
    if (!rider) return violation('RiderId', 'RiderNotFound', 'Rider not found.', 404);
    const name = (body.name ?? '').trim();
    if (db.riders.some((r) => r.branchId === ids.mainBranchId && r.name === name && r.id !== rider.id)) {
      return violation('Name', 'RiderNameAlreadyExists', RIDER_NAME_TAKEN);
    }
    rider.name = name;
    rider.mobileNumber = body.mobileNumber?.trim() ? normaliseMobile(body.mobileNumber) : null;
    rider.isActive = body.isActive ?? true;
    persist();
    return noContent();
  }),

  http.get(`${API}/fulfilment/manifest.csv`, ({ request }) => {
    const url = new URL(request.url);
    const courierId = url.searchParams.get('courierId');
    const date = url.searchParams.get('date');
    if (!courierId || !date) return violation('date', 'InvalidQuery', 'courierId and date are required.');
    const rows = db.orders.filter(
      (o) =>
        o.shipment?.courierId === courierId &&
        new Intl.DateTimeFormat('en-CA', { timeZone: ids.timeZoneId }).format(new Date(o.shipment.dispatchedOn)) === date,
    );
    const lines = [
      ['Order number', 'Recipient', 'Phone', 'Address', 'District', 'Postal code', 'Parcels', 'Weight (g)', 'COD amount', 'Tracking number'].join(','),
      ...rows.map((o) =>
        [
          o.orderNumber,
          o.fulfilment.recipientName,
          o.fulfilment.recipientPhone ?? '',
          o.fulfilment.line1 ?? '',
          o.fulfilment.district ?? '',
          o.fulfilment.postalCode ?? '',
          1,
          500,
          o.paymentMethod === 'CashOnDelivery' ? money(o.grandTotalCents).amount : '0.00',
          o.shipment?.trackingNumber ?? '',
        ]
          .map(csvCell)
          .join(','),
      ),
    ];
    return new HttpResponse(lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="manifest-${date}.csv"`,
      },
    });
  }),

  // ---- returns ---------------------------------------------------------------------------------------------
  http.get(`${API}/returns`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const { pageNumber, pageSize } = pageParams(url, 20);
    const rows = db.returns
      .filter((r) => !status || r.status === status)
      .sort((a, b) => b.requestedOn.localeCompare(a.requestedOn))
      .map(returnRow);
    return HttpResponse.json(paged(rows, pageNumber, pageSize));
  }),

  http.get(`${API}/returns/:returnRequestId`, ({ params }) => {
    const ret = findReturn(String(params.returnRequestId));
    return ret ? HttpResponse.json(returnDetail(ret)) : notFound();
  }),

  http.post(`${API}/orders/:orderId/returns`, async ({ request, params }) => {
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    const body = (await request.json()) as {
      lines: Array<{ orderLineId: string; quantity: number; reason: string; condition: string; customerNote?: string }>;
    };
    const created: DbReturn = {
      id: uuid(),
      version: 1,
      orderId: order.id,
      kind: 'CustomerReturn',
      status: 'Requested',
      requestedOn: nowIso(),
      requestedBy: staffId(),
      decidedOn: null,
      decidedBy: null,
      decisionNote: null,
      receivedOn: null,
      recalledBatchLines: [],
      lines: body.lines.map((l) => ({
        orderLineId: l.orderLineId,
        quantity: l.quantity,
        reason: l.reason,
        condition: l.condition,
        customerNote: l.customerNote ?? null,
        defectConfirmed: false,
        defectNote: null,
        quantityReceived: 0,
      })),
    };
    db.returns.unshift(created);
    persist();
    return HttpResponse.json({ returnRequestId: created.id, status: created.status }, { status: 201 });
  }),

  http.post(`${API}/returns/:returnRequestId/approve`, async ({ request, params }) => {
    const ret = findReturn(String(params.returnRequestId));
    if (!ret) return notFound();
    const body = (await request.json()) as {
      note?: string;
      lines: Array<{ orderLineId: string; defectConfirmed: boolean; defectNote?: string }>;
    };
    if (ret.status !== 'Requested') {
      return violation('ReturnRequestId', 'InvalidReturnTransition', "That isn't possible for a return in its current state.");
    }
    const order = findOrder(ret.orderId);
    const problems: Array<{ propertyName: string; errorCode: string; errorMessage: string }> = [];
    ret.lines.forEach((l, index) => {
      const orderLine = order?.lines.find((x) => x.lineId === l.orderLineId);
      const sent = body.lines.find((x) => x.orderLineId === l.orderLineId);
      if (requiresDefect(orderLine?.returnClass ?? 'Other', l.condition, l.reason) && (!sent?.defectConfirmed || !sent.defectNote?.trim())) {
        problems.push({
          propertyName: `Lines[${index}].DefectNote`,
          errorCode: 'DefectConfirmationRequired',
          errorMessage: `Confirm the defect, with a note, for '${orderLine?.productName ?? 'this item'}'.`,
        });
      }
    });
    if (problems.length > 0) return violations(problems);
    for (const l of ret.lines) {
      const sent = body.lines.find((x) => x.orderLineId === l.orderLineId);
      l.defectConfirmed = sent?.defectConfirmed ?? false;
      l.defectNote = sent?.defectNote ?? null;
    }
    ret.status = 'Approved';
    ret.decidedOn = nowIso();
    ret.decidedBy = staffId();
    ret.decisionNote = body.note ?? null;
    ret.version += 1;
    persist();
    return noContent();
  }),

  http.post(`${API}/returns/:returnRequestId/reject`, async ({ request, params }) => {
    const ret = findReturn(String(params.returnRequestId));
    if (!ret) return notFound();
    const { note } = (await request.json()) as { note?: string };
    if (!note?.trim()) return violation('Note', 'NoteRequired', 'Enter a note saying why you are rejecting it.');
    if (ret.status !== 'Requested') {
      return violation('ReturnRequestId', 'InvalidReturnTransition', "That isn't possible for a return in its current state.");
    }
    ret.status = 'Rejected';
    ret.decidedOn = nowIso();
    ret.decidedBy = staffId();
    ret.decisionNote = note.trim();
    ret.version += 1;
    persist();
    return noContent();
  }),

  http.post(`${API}/returns/:returnRequestId/receive`, async ({ request, params }) => {
    const ret = findReturn(String(params.returnRequestId));
    if (!ret) return notFound();
    const body = (await request.json()) as { lines: Array<{ orderLineId: string; quantityReceived: number }> };
    if (ret.status !== 'Approved') {
      return violation('ReturnRequestId', 'InvalidReturnTransition', "That isn't possible for a return in its current state.");
    }
    const problems: Array<{ propertyName: string; errorCode: string; errorMessage: string }> = [];
    body.lines.forEach((sent, index) => {
      const line = ret.lines.find((l) => l.orderLineId === sent.orderLineId);
      if (!line || sent.quantityReceived > line.quantity || sent.quantityReceived < 0) {
        problems.push({
          propertyName: `Lines[${index}].QuantityReceived`,
          errorCode: 'ReturnReceiptExceedsApproved',
          errorMessage: "You can't receive more than was approved.",
        });
      }
    });
    if (problems.length > 0) return violations(problems);
    const order = findOrder(ret.orderId);
    for (const sent of body.lines) {
      const line = ret.lines.find((l) => l.orderLineId === sent.orderLineId);
      if (!line) continue;
      line.quantityReceived = sent.quantityReceived;
      const orderLine = order?.lines.find((l) => l.lineId === sent.orderLineId);
      if (orderLine) orderLine.quantityReturned += sent.quantityReceived;
    }
    ret.status = 'Received';
    ret.receivedOn = nowIso();
    ret.version += 1;
    persist();
    return noContent();
  }),

  // ---- refunds -------------------------------------------------------------------------------------------------
  http.get(`${API}/orders/:orderId/refund-options`, ({ params }) => {
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    const any = order.amountPaidCents > order.amountRefundedCents;
    return HttpResponse.json({
      orderId: order.id,
      methods: [
        { method: 'CashInStore', allowed: any && order.paymentMethod !== 'BankTransfer', available: true, unavailableReason: null },
        { method: 'BankTransfer', allowed: any, available: true, unavailableReason: null },
        { method: 'StoreCredit', allowed: any, available: false, unavailableReason: 'RefundMethodUnavailable' },
      ],
      maxRefundable: money(Math.max(order.amountPaidCents - order.amountRefundedCents, 0)),
      suggestedForReturns: suggestedFor(order),
    });
  }),

  http.post(`${API}/orders/:orderId/refunds`, async ({ request, params }) => {
    const order = notFoundOrder(params.orderId);
    if (!order) return notFound();
    const key = request.headers.get('Idempotency-Key');
    if (!key) return violation('Idempotency-Key', 'IdempotencyKeyRequired', 'An Idempotency-Key header is required.');
    const replay = db.idempotency[key];
    if (replay) return HttpResponse.json(replay.body as object, { status: replay.status });
    const body = (await request.json()) as {
      returnRequestId?: string;
      method: string;
      amount: unknown;
      reference?: string;
      reason?: string;
    };
    if (body.method === 'StoreCredit') {
      return violation('Method', 'RefundMethodUnavailable', "Store credit isn't available yet.");
    }
    if (body.method === 'CashInStore' && order.paymentMethod === 'BankTransfer') {
      return violation('Method', 'RefundMethodNotAllowed', "That refund method isn't allowed for how this order was paid.");
    }
    if (!body.reference?.trim()) {
      return violation('Reference', 'RefundReferenceRequired', body.method === 'BankTransfer' ? 'Enter the transfer reference.' : 'Enter the receipt number.');
    }
    if (!body.reason?.trim()) return violation('Reason', 'ReasonRequired', 'Enter a reason for the refund.');
    const cents = Math.round(Number(body.amount) * 100);
    const max = Math.max(order.amountPaidCents - order.amountRefundedCents, 0);
    if (cents <= 0 || cents > max) {
      return violation('Amount', 'RefundExceedsAmountPaid', `You can refund at most ${formatCents(max)} on this order.`);
    }
    const refund = {
      id: uuid(),
      orderId: order.id,
      returnRequestId: body.returnRequestId ?? null,
      method: body.method,
      amountCents: cents,
      reference: body.reference.trim(),
      reason: body.reason.trim(),
      issuedOn: nowIso(),
    };
    db.refunds.push(refund);
    order.amountRefundedCents += cents;
    order.refundDueCents = Math.max(order.refundDueCents - cents, 0);
    if (order.amountRefundedCents === order.amountPaidCents && ['Delivered', 'Returned'].includes(order.status)) {
      pushStatus(order, 'Refunded', 0, staffId());
    }
    bump(order);
    const response = { refundId: refund.id, creditNoteId: uuid() };
    db.idempotency[key] = { status: 201, body: response };
    persist();
    return HttpResponse.json(response, { status: 201 });
  }),

  // The reallocation dialog reads the SKU's batches from Inventory; for the shop mock's SKUs
  // (which Inventory's mock does not know) the Ordering mock answers, otherwise it falls through.
  http.get('*/api/staff/inventory/batches', ({ request }) => {
    const skuId = new URL(request.url).searchParams.get('skuId');
    if (!skuId || !skuInfo(skuId)) return undefined;
    const info = skuInfo(skuId)!;
    const rows = (['A', 'B'] as const).map((variant) => {
      const batch = batchFor(skuId, variant);
      return {
        id: batch.batchId,
        skuId,
        skuCode: info.code,
        displayName: `${info.productName} ${info.variantLabel}`,
        lotNumber: batch.batchNumber,
        expiresOn: batch.expiresOn,
        isExpired: false,
        daysToExpiry: 160,
        branchTimeZoneId: ids.timeZoneId,
        status: db.recalledBatches.includes(batch.batchId) ? 'Recalled' : 'Available',
        receivedQuantity: '40.000',
        onHand: '25.000',
        stockUnit: 'unit',
        consignmentId: null,
      };
    });
    return HttpResponse.json(paged(rows, 1, 50));
  }),
];

export { forbidden };
