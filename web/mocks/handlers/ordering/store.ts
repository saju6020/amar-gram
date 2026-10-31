import { isFoodCategory } from '@/lib/shop/labels';
import { clearPersisted, loadPersisted, savePersisted } from '../admin/fixtures';
import { findSku } from '../shop/store';
import { orderingIds as ids } from './fixtures';

/**
 * `mocks/handlers/ordering/store.ts` — HO-ORD-002 §12.1. One in-memory (sessionStorage-persisted, like
 * the other mock stores) Ordering database plus the *mock server's* rules. Amounts are integer minor
 * units here and ONLY here; every response renders them as the API does
 * (`{ amount: "1250.00", currencyCode: "BDT" }`). The real UI never computes any of this
 * (ADR-FE-092). The catalogue (names, prices, in-stock flags, barcodes) is the SHOP
 * mock's, so Add to cart on a real product page reaches a real cart line.
 */

// HO-P5 S0: bumped (v2) so a stale sessionStorage copy without riders, picked ticks or the new seeds is not loaded.
const PERSIST_KEY = '__purrcare_ordering_mock_db__v2';

/** Seed ids HO-P5 adds (kept here: `ordering/fixtures.ts` is not S0's file). */
export const riderIds = {
  rafiq: 'a2000000-0000-0000-0000-000000000001',
  jahid: 'a2000000-0000-0000-0000-000000000002',
  kamalInactive: 'a2000000-0000-0000-0000-000000000003',
} as const;
export const p5OrderIds = {
  packedWaiting: 'f0000000-0000-0000-0000-000000000112',
  dispatchedWithRider: 'f0000000-0000-0000-0000-000000000113',
} as const;
/** Customer-facing carrier name of an in-house dispatch: Shared/Common/Constants/OrderRules.cs:25 */
export const RIDER_CARRIER_NAME = 'Our delivery rider';
export const CURRENCY = 'BDT';
export const ZONE = ids.timeZoneId;
export const DEFAULT_STOCK = 25;
export const APPROVAL_THRESHOLD_CENTS = 5_000_000; // BDT 50,000.00 — a transfer above it needs a second person
export const MAX_QUANTITY_PER_LINE = 20;
export const MAX_CART_LINES = 50;

export type Cents = number;

export function money(cents: Cents): { amount: string; currencyCode: string } {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return {
    amount: `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`,
    currencyCode: CURRENCY,
  };
}

/** `"850.00"` → 85000 by string handling (a typed or wire amount). */
export function centsOfString(text: string): Cents {
  const [whole = '0', fraction = ''] = text.replace(/[^0-9.]/g, '').split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
}

/** A request amount (a JSON number from `JSON.rawJSON`, or a string) → minor units. */
export function toCents(value: unknown): Cents {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '0'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function formatCents(cents: Cents): string {
  const { amount } = money(cents);
  const [whole = '0', fraction = '00'] = amount.split('.');
  return `${CURRENCY} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
}

// ---- database types ---------------------------------------------------------------------------------

export interface DbCartLine {
  lineId: string;
  skuId: string;
  quantity: number;
  priceWhenAddedCents: Cents;
}

export interface DbAllocation {
  batchId: string;
  batchNumber: string;
  expiresOn: string | null;
  locationId: string;
  locationName: string;
  quantity: number;
}

export interface DbOrderLine {
  lineId: string;
  lineNumber: number;
  skuId: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitCents: Cents;
  subtotalCents: Cents;
  discountCents: Cents;
  shareCents: Cents;
  taxRatePercent: number;
  taxCents: Cents;
  totalCents: Cents;
  quantityReturned: number;
  returnClass: 'Food' | 'Household' | 'Other';
  allocations: DbAllocation[];
  /** HO-P5 BG-4 pick-list tick: Read/ViewModels/StaffOrderViewModels.cs:19. Absent = not picked (optional so unrelated builders compile). */
  picked?: boolean;
  pickedOn?: string | null;
  pickedBy?: string | null;
}

export type OrderStatusName =
  | 'PendingPayment'
  | 'Confirmed'
  | 'Packing'
  | 'Packed'
  | 'Dispatched'
  | 'Delivered'
  | 'Cancelled'
  | 'Returned'
  | 'Refunded';

export interface DbHistory {
  from: OrderStatusName | null;
  to: OrderStatusName;
  changedOn: string;
  changedBy: string;
  changedByName: string | null;
  note: string | null;
}

export interface DbFulfilment {
  recipientName: string;
  recipientPhone: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  district: string | null;
  postalCode: string | null;
  deliveryInstructions: string | null;
  zoneName: string | null;
  serviceLevel: string | null;
  slotDate: string | null;
  slotWindow: string | null;
  pickupBranchId: string | null;
  pickupBranchName: string | null;
  pickupBranchAddress: string | null;
  /** HO-P5 G4: Read/ViewModels/OrderViewModels.cs:23. Absent = none (optional so unrelated builders compile). */
  riderNote?: string | null;
}

export interface DbOrder {
  id: string;
  version: number;
  orderNumber: string;
  placedOn: string;
  channel: 'Online' | 'Counter';
  customerId: string | null;
  customerName: string;
  customerMobile: string | null;
  status: OrderStatusName;
  fulfilmentMethod: 'Delivery' | 'Pickup' | 'Counter';
  paymentMethod: 'CashOnDelivery' | 'BankTransfer' | 'PayOnCollection' | 'InStore';
  cancellationReason: 'CustomerRequest' | 'StaffDecision' | 'PaymentWindowExpired' | null;
  lines: DbOrderLine[];
  subtotalCents: Cents;
  lineDiscountCents: Cents;
  orderDiscountCents: Cents;
  deliveryChargeCents: Cents;
  taxCents: Cents;
  grandTotalCents: Cents;
  fulfilment: DbFulfilment;
  history: DbHistory[];
  paymentDueBy: string | null;
  customerTransferReference: string | null;
  transferReportedOn: string | null;
  held: { amountCents: Cents; bankReference: string; recordedBy: string; recordedOn: string } | null;
  cod: {
    amountCents: Cents;
    collectorKind: 'Courier' | 'Staff';
    collectorName: string;
    collectedOn: string;
    recordedBy: string;
  } | null;
  /** HO-P5 BG-5: Read/ViewModels/StaffOrderViewModels.cs:27-30 -- `courierId` is null when the order left with an in-house rider. */
  shipment: {
    courierId: string | null;
    courierName: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    dispatchedOn: string;
    lastTrackingStatus: string | null;
    riderId?: string | null;
    riderName?: string | null;
  } | null;
  /** HO-P5 BG-4: when the order was marked packed (StaffOrderViewModels.cs:38 `PackedOn`). */
  packedOn?: string | null;
  collectBy: string | null;
  invoiceNumber: string | null;
  amountPaidCents: Cents;
  amountRefundedCents: Cents;
  refundDueCents: Cents;
  discountCode: string | null;
  returnWindowEndsOn: string | null;
  courierReportsDelivered: boolean;
  tenders: Array<{ method: 'Cash' | 'InStoreCard'; amountCents: Cents; reference: string | null }>;
  changeDueCents: Cents;
  cashier: string | null;
}

export type ReturnStatusName = 'Requested' | 'Approved' | 'Rejected' | 'Received' | 'Closed';

export interface DbReturnLine {
  orderLineId: string;
  quantity: number;
  reason: string;
  condition: string;
  customerNote: string | null;
  defectConfirmed: boolean;
  defectNote: string | null;
  quantityReceived: number;
}

export interface DbReturn {
  id: string;
  version: number;
  orderId: string;
  kind: 'CustomerReturn' | 'DeliveryFailure';
  status: ReturnStatusName;
  requestedOn: string;
  requestedBy: string;
  decidedOn: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
  receivedOn: string | null;
  lines: DbReturnLine[];
  recalledBatchLines: string[];
}

export interface DbRefund {
  id: string;
  orderId: string;
  returnRequestId: string | null;
  method: string;
  amountCents: Cents;
  reference: string | null;
  reason: string;
  issuedOn: string;
}

export interface DbIssue {
  id: string;
  orderId: string | null;
  kind: string;
  paymentMethod: string;
  amountCents: Cents;
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

export interface DbZoneService {
  serviceLevel: 'Standard' | 'Express';
  isActive: boolean;
  baseChargeCents: Cents;
  freeOverCents: Cents | null;
  leadTimeDays: number;
  weightBands: Array<{ upToGrams: number | null; surchargeCents: Cents }>;
  slotWindows: Array<{ dayOfWeek: string; start: string; end: string }>;
}

export interface DbZone {
  id: string;
  branchId: string;
  name: string;
  priority: number;
  isActive: boolean;
  codEnabled: boolean;
  codMaxCents: Cents | null;
  version: number;
  coverage: Array<{ district: string; postalCodes: string[] }>;
  services: DbZoneService[];
}

export interface DbCourier {
  id: string;
  name: string;
  trackingUrlTemplate: string | null;
  supportsCod: boolean;
  isActive: boolean;
}

export interface DbCode {
  id: string;
  code: string;
  description: string | null;
  kind: 'Percentage' | 'FixedAmount';
  percent: number | null;
  amountCents: Cents | null;
  minimumSpendCents: Cents | null;
  scope: 'Order' | 'Products' | 'Categories';
  productIds: string[];
  categoryIds: number[];
  firstOrderOnly: boolean;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  timesRedeemed: number;
  version: number;
}

/** HO-P5 BG-5: Read/ViewModels/RiderViewModels.cs:3-4 plus the owning branch. */
export interface DbRider {
  id: string;
  branchId: string;
  name: string;
  mobileNumber: string | null;
  isActive: boolean;
}

export interface DbBank {
  configured: boolean;
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  branchName: string | null;
  routingNumber: string | null;
  isActive: boolean;
}

export interface Db {
  guestLines: DbCartLine[];
  customerLines: DbCartLine[];
  orders: DbOrder[];
  returns: DbReturn[];
  refunds: DbRefund[];
  issues: DbIssue[];
  zones: DbZone[];
  couriers: DbCourier[];
  riders: DbRider[];
  codes: DbCode[];
  bank: DbBank;
  stock: Record<string, number>;
  /** Batch ids a recall has been recorded against (BatchRecalled on dispatch, U-D3). */
  recalledBatches: string[];
  /** The staff member the mock acts as (`__orderingMock.actAs`). */
  actor: string;
  transferWindowSeconds: number;
  taxRatePercent: number;
  pendingPolicies: Array<{ key: string; versionNumber: number; title: string }>;
  nextOrderSeq: number;
  nextInvoiceSeq: number;
  /** key → the status and body the first call answered (a repeat replays it). */
  idempotency: Record<string, { status: number; body: unknown }>;
  inFlightKeys: string[];
}

// ---- time ---------------------------------------------------------------------------------------------

export const nowIso = (): string => new Date().toISOString();
export const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString();
export const hoursFromNow = (hours: number): string =>
  new Date(Date.now() + hours * 3_600_000).toISOString();

export function todayLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(new Date());
}

export function addDays(dateIso: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekdayName(dateIso: string): string {
  const [y = 1970, m = 1, d = 1] = dateIso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

// ---- catalogue (the shop mock's) ----------------------------------------------------------------------

export interface SkuInfo {
  skuId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  code: string;
  barcode: string | null;
  priceCents: Cents | null;
  purchasable: boolean;
  isBundle: boolean;
  returnClass: 'Food' | 'Household' | 'Other';
  categoryId: number;
}

export function skuInfo(skuId: string): SkuInfo | undefined {
  const found = findSku(skuId);
  if (!found) return undefined;
  const { product, sku } = found;
  return {
    skuId,
    productId: product.productId,
    productName: product.name,
    variantLabel: sku.sizeOrWeight ?? sku.flavour ?? sku.colour ?? sku.code,
    code: sku.code,
    barcode: sku.barcode,
    priceCents: sku.price ? centsOfString(sku.price) : null,
    purchasable: product.status === 'Active' && sku.status === 'Active' && sku.price !== null,
    isBundle: product.kind === 'Bundle',
    returnClass:
      isFoodCategory(product.category)
        ? 'Food'
        : product.category === 'HouseholdAndCare'
          ? 'Household'
          : 'Other',
    categoryId: 1,
  };
}

export function stockOf(skuId: string): number {
  const stored = db.stock[skuId];
  if (stored !== undefined) return stored;
  const found = findSku(skuId);
  return found && found.sku.inStock ? DEFAULT_STOCK : 0;
}

export const PICKUP_BRANCHES = [
  { id: ids.mainBranchId, name: 'Amar Gram Dhanmondi', address: 'House 12, Road 5, Dhanmondi, Dhaka', phone: '+880 1700 000001' },
  { id: ids.secondBranchId, name: 'Amar Gram Chattogram', address: '45 Agrabad Road, Chattogram', phone: '+880 1700 000002' },
];

export function batchFor(skuId: string, variant: 'A' | 'B' = 'A'): DbAllocation {
  const info = skuInfo(skuId);
  const code = info?.code ?? 'SKU';
  return {
    batchId: `ba000000-0000-0000-0000-${skuId.slice(-6)}00000${variant === 'A' ? 1 : 2}`,
    batchNumber: `LOT-${code}-${variant}`,
    expiresOn: variant === 'A' ? '2027-03-31' : '2027-09-30',
    locationId: ids.locationShelfId,
    locationName: 'Main shelf',
    quantity: 0,
  };
}

// ---- ids and numbering ----------------------------------------------------------------------------------

export const uuid = (): string => crypto.randomUUID();

export function nextOrderNumber(): string {
  const n = db.nextOrderSeq;
  db.nextOrderSeq += 1;
  return `ORD-2026-${String(n).padStart(6, '0')}`;
}

export function nextInvoiceNumber(): string {
  const n = db.nextInvoiceSeq;
  db.nextInvoiceSeq += 1;
  return `INV-MAIN-2627-${String(n).padStart(6, '0')}`;
}

// ---- seed -----------------------------------------------------------------------------------------------

function line(
  n: number,
  skuId: string,
  quantity: number,
  extra: Partial<DbOrderLine> = {},
): DbOrderLine {
  const info = skuInfo(skuId);
  const unit = info?.priceCents ?? 100_000;
  return {
    lineId: `fa000000-0000-0000-0000-${skuId.slice(-6)}00000${n}`,
    lineNumber: n,
    skuId,
    productName: info?.productName ?? 'Product',
    variantLabel: info?.variantLabel ?? '',
    quantity,
    unitCents: unit,
    subtotalCents: unit * quantity,
    discountCents: 0,
    shareCents: 0,
    taxRatePercent: 0,
    taxCents: 0,
    totalCents: unit * quantity,
    quantityReturned: 0,
    returnClass: info?.returnClass ?? 'Other',
    allocations: [],
    ...extra,
  };
}

function allocated(l: DbOrderLine): DbOrderLine {
  return { ...l, allocations: [{ ...batchFor(l.skuId), quantity: l.quantity }] };
}

interface OrderSpec {
  id: string;
  seq: number;
  status: OrderStatusName;
  placedMinutesAgo: number;
  fulfilmentMethod?: DbOrder['fulfilmentMethod'];
  paymentMethod: DbOrder['paymentMethod'];
  lines: DbOrderLine[];
  channel?: 'Online' | 'Counter';
  customerName?: string;
  customerId?: string | null;
  deliveryChargeCents?: Cents;
  extra?: Partial<DbOrder>;
}

function orderFrom(spec: OrderSpec): DbOrder {
  const method = spec.fulfilmentMethod ?? 'Delivery';
  const subtotal = spec.lines.reduce((sum, l) => sum + l.subtotalCents, 0);
  const delivery = spec.deliveryChargeCents ?? (method === 'Delivery' ? 8000 : 0);
  const grand = subtotal + delivery;
  const placedOn = minutesAgo(spec.placedMinutesAgo);
  const customerName = spec.customerName ?? ids.customerName;
  const base: DbOrder = {
    id: spec.id,
    version: 1,
    orderNumber: `ORD-2026-${String(spec.seq).padStart(6, '0')}`,
    placedOn,
    channel: spec.channel ?? 'Online',
    customerId: spec.customerId === undefined ? ids.customerId : spec.customerId,
    customerName,
    customerMobile: ids.customerMobile,
    status: spec.status,
    fulfilmentMethod: method,
    paymentMethod: spec.paymentMethod,
    cancellationReason: null,
    lines: spec.lines,
    subtotalCents: subtotal,
    lineDiscountCents: 0,
    orderDiscountCents: 0,
    deliveryChargeCents: delivery,
    taxCents: 0,
    grandTotalCents: grand,
    fulfilment: {
      recipientName: customerName,
      recipientPhone: ids.customerMobile,
      line1: method === 'Delivery' ? 'House 7, Road 3, Dhanmondi' : null,
      line2: null,
      city: method === 'Delivery' ? 'Dhaka' : null,
      district: method === 'Delivery' ? 'Dhaka' : null,
      postalCode: method === 'Delivery' ? '1209' : null,
      deliveryInstructions: method === 'Delivery' ? 'Call from the gate.' : null,
      zoneName: method === 'Delivery' ? 'Dhaka City' : null,
      serviceLevel: method === 'Delivery' ? 'Standard' : null,
      slotDate: null,
      slotWindow: null,
      pickupBranchId: method === 'Pickup' ? ids.mainBranchId : null,
      pickupBranchName: method === 'Pickup' ? 'Amar Gram Dhanmondi' : null,
      pickupBranchAddress: method === 'Pickup' ? 'House 12, Road 5, Dhanmondi, Dhaka' : null,
    },
    history: [
      {
        from: null,
        to: spec.paymentMethod === 'BankTransfer' ? 'PendingPayment' : 'Confirmed',
        changedOn: placedOn,
        changedBy: ids.customerId,
        changedByName: null,
        note: null,
      },
    ],
    paymentDueBy: null,
    customerTransferReference: null,
    transferReportedOn: null,
    held: null,
    cod: null,
    shipment: null,
    collectBy: null,
    invoiceNumber: null,
    amountPaidCents: 0,
    amountRefundedCents: 0,
    refundDueCents: 0,
    discountCode: null,
    returnWindowEndsOn: null,
    courierReportsDelivered: false,
    tenders: [],
    changeDueCents: 0,
    cashier: null,
  };
  return { ...base, ...spec.extra };
}

function step(order: DbOrder, to: OrderStatusName, minutes: number, by: string = ids.adminStaffId): void {
  const from = order.history[order.history.length - 1]?.to ?? null;
  order.history.push({
    from,
    to,
    changedOn: minutesAgo(minutes),
    changedBy: by,
    changedByName: by === ids.adminStaffId ? 'Amina Hossain' : 'Rahim Uddin',
    note: null,
  });
  order.status = to;
}

function seedOrders(): DbOrder[] {
  const oats2 = ids.skuOats2kg;
  const oats400 = ids.skuOats400;
  const rice = ids.skuJasmineRice;

  const awaiting = orderFrom({
    id: ids.orders.awaitingTransfer,
    seq: 101,
    status: 'PendingPayment',
    placedMinutesAgo: 90,
    paymentMethod: 'BankTransfer',
    lines: [line(1, oats2, 2)],
    extra: { paymentDueBy: hoursFromNow(30) },
  });

  const reported = orderFrom({
    id: ids.orders.transferReported,
    seq: 102,
    status: 'PendingPayment',
    placedMinutesAgo: 240,
    paymentMethod: 'BankTransfer',
    lines: [line(1, oats400, 3)],
    customerName: 'Farhana Yasmin',
    customerId: 'c0000000-0000-0000-0000-0000000000a2',
    extra: {
      paymentDueBy: hoursFromNow(5.5),
      customerTransferReference: 'TRF-20261008-77',
      transferReportedOn: minutesAgo(30),
    },
  });

  const held = orderFrom({
    id: ids.orders.heldPayment,
    seq: 103,
    status: 'PendingPayment',
    placedMinutesAgo: 600,
    paymentMethod: 'BankTransfer',
    lines: [line(1, oats2, 80)],
    customerName: 'Nusrat Jahan',
    customerId: 'c0000000-0000-0000-0000-0000000000a3',
    extra: {
      paymentDueBy: hoursFromNow(20),
      customerTransferReference: 'BRAC-55120',
      transferReportedOn: minutesAgo(200),
      invoiceNumber: 'INV-MAIN-2627-000412',
    },
  });
  held.held = {
    amountCents: held.grandTotalCents,
    bankReference: 'BRAC-55120',
    recordedBy: ids.otherStaffId,
    recordedOn: minutesAgo(45),
  };

  const confirmed = orderFrom({
    id: ids.orders.confirmedCod,
    seq: 104,
    status: 'Confirmed',
    placedMinutesAgo: 120,
    paymentMethod: 'CashOnDelivery',
    lines: [allocated(line(1, oats2, 1)), allocated(line(2, rice, 2))],
  });

  const packing = orderFrom({
    id: ids.orders.packingPickup,
    seq: 105,
    status: 'Confirmed',
    placedMinutesAgo: 300,
    fulfilmentMethod: 'Pickup',
    paymentMethod: 'PayOnCollection',
    lines: [allocated(line(1, oats400, 2))],
    extra: { collectBy: addDays(todayLocal(), 6) },
  });
  step(packing, 'Packing', 200);

  const dispatched = orderFrom({
    id: ids.orders.dispatchedCod,
    seq: 106,
    status: 'Confirmed',
    placedMinutesAgo: 1500,
    paymentMethod: 'CashOnDelivery',
    lines: [allocated(line(1, oats2, 2))],
  });
  step(dispatched, 'Packing', 1400);
  step(dispatched, 'Dispatched', 1300);
  dispatched.shipment = {
    courierId: ids.courierPathaoId,
    courierName: 'Pathao Courier',
    trackingNumber: 'PC-88213004',
    trackingUrl: 'https://track.example/pathao/PC-88213004',
    dispatchedOn: minutesAgo(1300),
    lastTrackingStatus: 'Out for delivery',
    riderId: null,
    riderName: null,
  };

  const delivered = orderFrom({
    id: ids.orders.delivered,
    seq: 107,
    status: 'Confirmed',
    placedMinutesAgo: 4000,
    paymentMethod: 'CashOnDelivery',
    lines: [allocated(line(1, oats2, 2)), allocated(line(2, oats400, 1))],
  });
  step(delivered, 'Packing', 3900);
  step(delivered, 'Dispatched', 3800);
  step(delivered, 'Delivered', 3000);
  delivered.shipment = {
    courierId: ids.courierInHouseId,
    courierName: 'In-house rider',
    trackingNumber: null,
    trackingUrl: null,
    dispatchedOn: minutesAgo(3800),
    lastTrackingStatus: null,
    riderId: null,
    riderName: null,
  };
  delivered.cod = {
    amountCents: delivered.grandTotalCents,
    collectorKind: 'Courier',
    collectorName: 'Rafiq (rider)',
    collectedOn: minutesAgo(3000),
    recordedBy: ids.adminStaffId,
  };
  delivered.fulfilment.riderNote = 'Please ring the bell twice; the gate is stiff.';
  delivered.amountPaidCents = delivered.grandTotalCents;
  delivered.invoiceNumber = 'INV-MAIN-2627-000398';
  delivered.returnWindowEndsOn = addDays(todayLocal(), 5);

  const expired = orderFrom({
    id: ids.orders.expired,
    seq: 108,
    status: 'PendingPayment',
    placedMinutesAgo: 3200,
    paymentMethod: 'BankTransfer',
    lines: [line(1, oats400, 2)],
  });
  step(expired, 'Cancelled', 100, ids.adminStaffId);
  expired.cancellationReason = 'PaymentWindowExpired';
  expired.paymentDueBy = minutesAgo(120);

  const counter = orderFrom({
    id: ids.orders.counterSale,
    seq: 109,
    status: 'Confirmed',
    placedMinutesAgo: 60,
    fulfilmentMethod: 'Counter',
    paymentMethod: 'InStore',
    channel: 'Counter',
    customerName: 'Walk-in customer',
    customerId: null,
    lines: [allocated(line(1, rice, 1))],
  });
  step(counter, 'Delivered', 59);
  counter.invoiceNumber = 'INV-MAIN-2627-000401';
  counter.amountPaidCents = counter.grandTotalCents;
  counter.tenders = [{ method: 'Cash', amountCents: 100_000, reference: null }];
  counter.changeDueCents = 100_000 - counter.grandTotalCents;
  counter.cashier = 'Amina Hossain';

  const openedFood = orderFrom({
    id: ids.orders.deliveredOpenedFood,
    seq: 110,
    status: 'Confirmed',
    placedMinutesAgo: 2500,
    paymentMethod: 'CashOnDelivery',
    lines: [allocated(line(1, rice, 1))],
  });
  step(openedFood, 'Packing', 2400);
  step(openedFood, 'Dispatched', 2300);
  step(openedFood, 'Delivered', 2000);
  openedFood.amountPaidCents = openedFood.grandTotalCents;
  openedFood.invoiceNumber = 'INV-MAIN-2627-000399';
  openedFood.returnWindowEndsOn = addDays(todayLocal(), 4);

  const cancelledPaid = orderFrom({
    id: ids.orders.cancelledPaid,
    seq: 111,
    status: 'PendingPayment',
    placedMinutesAgo: 900,
    paymentMethod: 'BankTransfer',
    lines: [line(1, oats400, 1)],
    customerName: 'Tanvir Ahmed',
    customerId: 'c0000000-0000-0000-0000-0000000000a4',
  });
  step(cancelledPaid, 'Confirmed', 800);
  step(cancelledPaid, 'Cancelled', 700);
  cancelledPaid.cancellationReason = 'StaffDecision';
  cancelledPaid.amountPaidCents = cancelledPaid.grandTotalCents;
  cancelledPaid.refundDueCents = cancelledPaid.grandTotalCents;
  cancelledPaid.invoiceNumber = 'INV-MAIN-2627-000397';

  // HO-P5 S0 (BG-4): packed, every line picked, waiting for a rider. Another customer, so Sam's list is unchanged.
  const packedAt = minutesAgo(55);
  const packedWaiting = orderFrom({
    id: p5OrderIds.packedWaiting,
    seq: 112,
    status: 'Confirmed',
    placedMinutesAgo: 400,
    paymentMethod: 'CashOnDelivery',
    lines: [
      allocated(line(1, oats2, 1, { picked: true, pickedOn: minutesAgo(70), pickedBy: ids.adminStaffId })),
      allocated(line(2, rice, 1, { picked: true, pickedOn: minutesAgo(65), pickedBy: ids.adminStaffId })),
    ],
    customerName: 'Mizanur Rahman',
    customerId: 'c0000000-0000-0000-0000-0000000000a5',
  });
  step(packedWaiting, 'Packing', 90);
  step(packedWaiting, 'Packed', 55);
  packedWaiting.packedOn = packedAt;
  packedWaiting.fulfilment.slotDate = addDays(todayLocal(), 1);
  packedWaiting.fulfilment.slotWindow = '10:00-13:00';

  // HO-P5 S0 (BG-5): cash on delivery on the road with an in-house rider (feeds the orders.cod-with-riders tile).
  const withRider = orderFrom({
    id: p5OrderIds.dispatchedWithRider,
    seq: 113,
    status: 'Confirmed',
    placedMinutesAgo: 500,
    paymentMethod: 'CashOnDelivery',
    lines: [allocated(line(1, oats400, 2, { picked: true, pickedOn: minutesAgo(200), pickedBy: ids.adminStaffId }))],
    customerName: 'Shirin Akter',
    customerId: 'c0000000-0000-0000-0000-0000000000a6',
  });
  step(withRider, 'Packing', 220);
  step(withRider, 'Dispatched', 120);
  withRider.shipment = {
    courierId: null,
    courierName: RIDER_CARRIER_NAME,
    trackingNumber: null,
    trackingUrl: null,
    dispatchedOn: minutesAgo(120),
    lastTrackingStatus: null,
    riderId: riderIds.rafiq,
    riderName: 'Rafiq Hasan',
  };
  withRider.fulfilment.slotDate = todayLocal();
  withRider.fulfilment.slotWindow = '14:00-17:00';

  return [
    awaiting,
    reported,
    held,
    confirmed,
    packing,
    dispatched,
    delivered,
    expired,
    counter,
    openedFood,
    cancelledPaid,
    packedWaiting,
    withRider,
  ];
}

function seedRiders(): DbRider[] {
  return [
    { id: riderIds.rafiq, branchId: ids.mainBranchId, name: 'Rafiq Hasan', mobileNumber: '01711000101', isActive: true },
    { id: riderIds.jahid, branchId: ids.mainBranchId, name: 'Jahid Alam', mobileNumber: '01711000102', isActive: true },
    { id: riderIds.kamalInactive, branchId: ids.mainBranchId, name: 'Kamal Mia', mobileNumber: null, isActive: false },
  ];
}

function seedReturns(): DbReturn[] {
  const base = { version: 1, requestedBy: ids.customerId, decidedOn: null, decidedBy: null, receivedOn: null };
  return [
    {
      ...base,
      id: ids.returns.requested,
      orderId: ids.orders.delivered,
      kind: 'CustomerReturn',
      status: 'Requested',
      requestedOn: minutesAgo(180),
      decisionNote: null,
      recalledBatchLines: [],
      lines: [
        {
          orderLineId: seedOrders()[6]!.lines[1]!.lineId,
          quantity: 1,
          reason: 'WrongItem',
          condition: 'Sealed',
          customerNote: 'This is the 400 g, I ordered 2 kg.',
          defectConfirmed: false,
          defectNote: null,
          quantityReceived: 0,
        },
      ],
    },
    {
      ...base,
      id: ids.returns.requestedDefect,
      orderId: ids.orders.deliveredOpenedFood,
      kind: 'CustomerReturn',
      status: 'Requested',
      requestedOn: minutesAgo(90),
      decisionNote: null,
      recalledBatchLines: [],
      lines: [
        {
          orderLineId: seedOrders()[9]!.lines[0]!.lineId,
          quantity: 1,
          reason: 'QualityDefect',
          condition: 'Opened',
          customerNote: 'The rice smelled stale.',
          defectConfirmed: false,
          defectNote: null,
          quantityReceived: 0,
        },
      ],
    },
  ];
}

function seedZones(): DbZone[] {
  const windows = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday', 'Sunday'].flatMap(
    (dayOfWeek) => [
      { dayOfWeek, start: '10:00', end: '13:00' },
      { dayOfWeek, start: '14:00', end: '17:00' },
    ],
  );
  return [
    {
      id: ids.zoneDhakaId,
      branchId: ids.mainBranchId,
      name: 'Dhaka City',
      priority: 1,
      isActive: true,
      codEnabled: true,
      codMaxCents: 500_000,
      version: 1,
      coverage: [
        { district: 'Dhaka', postalCodes: [] },
        { district: 'Narayanganj', postalCodes: ['1400', '1410'] },
      ],
      services: [
        {
          serviceLevel: 'Standard',
          isActive: true,
          baseChargeCents: 8000,
          freeOverCents: 500_000,
          leadTimeDays: 1,
          weightBands: [{ upToGrams: 5000, surchargeCents: 0 }, { upToGrams: null, surchargeCents: 5000 }],
          slotWindows: windows,
        },
        {
          serviceLevel: 'Express',
          isActive: true,
          baseChargeCents: 15_000,
          freeOverCents: null,
          leadTimeDays: 0,
          weightBands: [],
          slotWindows: [],
        },
      ],
    },
    {
      id: ids.zoneInactiveId,
      branchId: ids.mainBranchId,
      name: 'Chattogram (paused)',
      priority: 2,
      isActive: false,
      codEnabled: false,
      codMaxCents: null,
      version: 1,
      coverage: [{ district: 'Chattogram', postalCodes: [] }],
      services: [
        {
          serviceLevel: 'Standard',
          isActive: true,
          baseChargeCents: 12_000,
          freeOverCents: null,
          leadTimeDays: 3,
          weightBands: [],
          slotWindows: [],
        },
      ],
    },
  ];
}

function seedCodes(): DbCode[] {
  const base = {
    description: null,
    productIds: [] as string[],
    categoryIds: [] as number[],
    firstOrderOnly: false,
    usageLimit: null,
    perCustomerLimit: null,
    validFrom: null,
    validTo: null,
    isActive: true,
    timesRedeemed: 0,
    version: 1,
  };
  return [
    {
      ...base,
      id: ids.codeWelcomeId,
      code: 'WELCOME10',
      description: '10% off your order',
      kind: 'Percentage',
      percent: 10,
      amountCents: null,
      minimumSpendCents: null,
      scope: 'Order',
      timesRedeemed: 12,
    },
    {
      ...base,
      id: ids.codeSaveId,
      code: 'SAVE100',
      description: 'BDT 100 off orders of BDT 5,000 or more',
      kind: 'FixedAmount',
      percent: null,
      amountCents: 10_000,
      minimumSpendCents: 500_000,
      scope: 'Order',
      perCustomerLimit: 1,
    },
    {
      ...base,
      id: ids.codeExpiredId,
      code: 'EARLYBIRD',
      kind: 'Percentage',
      percent: 15,
      amountCents: null,
      minimumSpendCents: null,
      scope: 'Order',
      validTo: '2026-08-31T00:00:00Z',
      timesRedeemed: 40,
    },
  ];
}

function seedIssues(): DbIssue[] {
  return [
    {
      id: ids.issueId,
      orderId: ids.orders.transferReported,
      kind: 'TransferConfirmationFailed',
      paymentMethod: 'BankTransfer',
      amountCents: 270_000,
      paymentReference: 'TRF-20261008-77',
      paymentReceivedOn: minutesAgo(60),
      errorSummary: 'Billing could not record the payment.',
      raisedBy: ids.adminStaffId,
      raisedOn: minutesAgo(55),
      status: 'Open',
      resolvedBy: null,
      resolvedOn: null,
      resolutionNote: null,
    },
  ];
}

function seed(): Db {
  return {
    guestLines: [],
    customerLines: [],
    orders: seedOrders(),
    returns: seedReturns(),
    refunds: [],
    issues: seedIssues(),
    zones: seedZones(),
    riders: seedRiders(),
    couriers: [
      { id: ids.courierPathaoId, name: 'Pathao Courier', trackingUrlTemplate: 'https://track.example/pathao/{tracking}', supportsCod: true, isActive: true },
      { id: ids.courierInHouseId, name: 'In-house rider', trackingUrlTemplate: null, supportsCod: true, isActive: true },
    ],
    codes: seedCodes(),
    bank: {
      configured: true,
      accountName: 'Amar Gram Ltd',
      accountNumber: '1234567890123',
      bankName: 'BRAC Bank',
      branchName: 'Gulshan',
      routingNumber: '060261726',
      isActive: true,
    },
    stock: { [ids.skuJasmineRice]: 1 },
    recalledBatches: [],
    actor: ids.adminStaffId,
    transferWindowSeconds: 48 * 3600,
    taxRatePercent: 0,
    pendingPolicies: [],
    nextOrderSeq: 200,
    nextInvoiceSeq: 500,
    idempotency: {},
    inFlightKeys: [],
  };
}

export const db: Db = loadPersisted<Db>(PERSIST_KEY) ?? seed();

export function persist(): void {
  savePersisted(PERSIST_KEY, db);
}

export function resetOrderingMockData(): void {
  Object.assign(db, seed());
  clearPersisted(PERSIST_KEY);
}

export function findOrder(orderId: string): DbOrder | undefined {
  return db.orders.find((o) => o.id === orderId);
}

export function findReturn(returnId: string): DbReturn | undefined {
  return db.returns.find((r) => r.id === returnId);
}

export function staffNameOf(staffId: string): string {
  return staffId === ids.otherStaffId ? 'Rahim Uddin' : 'Amina Hossain';
}

/** Lazy expiry (the worker's job on the real server): an unpaid transfer past its window is cancelled. */
export function expireOverdueTransfers(): void {
  const now = Date.now();
  let changed = false;
  for (const order of db.orders) {
    if (
      order.status === 'PendingPayment' &&
      order.paymentMethod === 'BankTransfer' &&
      order.paymentDueBy &&
      order.held === null &&
      Date.parse(order.paymentDueBy) <= now
    ) {
      step(order, 'Cancelled', 0, ids.adminStaffId);
      order.cancellationReason = 'PaymentWindowExpired';
      order.version += 1;
      changed = true;
    }
  }
  if (changed) persist();
}

export { step as pushStatus };

/** FEFO allocation, once an order is confirmed: each line takes its SKU's first batch. */
export function allocateOrder(order: DbOrder): void {
  for (const l of order.lines) l.allocations = [{ ...batchFor(l.skuId), quantity: l.quantity }];
}
