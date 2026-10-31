import { http, HttpResponse, type HttpHandler } from 'msw';
import { db as shopDb } from '../shop/store';
import { noContent, notFound, orderingIds as ids, violation } from './fixtures';
import {
  allocateOrder,
  batchFor,
  db,
  findOrder,
  formatCents,
  money,
  nextInvoiceNumber,
  nextOrderNumber,
  nowIso,
  persist,
  skuInfo,
  stockOf,
  uuid,
  type DbOrder,
  type DbOrderLine,
} from './store';
import { computeQuote, type QuoteLineInput } from './quote';
import { orderLineView, totalsView } from './customer';
import { normaliseMobile } from './staff';

/**
 * `mocks/handlers/ordering/pos.ts` — HO-ORD-002 §12.1. The point of sale as `StaffPosController`
 * really answers it: the flat `PosSku` (with `sellable` and `fefoBatches`), a quote WITHOUT any tender
 * evaluation (HO-P5: now a change preview when `tenderedCash` is sent), a sale whose `customerName` + `customerMobile` come together (ADR-216; both left out is an anonymous sale; a refused sale still stores
 * the walk-in), `TendersDoNotCoverTotal` / `TerminalReferenceRequired` from the tender rules, and the
 * `changeDue` only in the sale response.
 */
const API = '*/api/staff/pos';

function posSku(skuId: string) {
  const info = skuInfo(skuId);
  if (!info) return null;
  const sellable = stockOf(skuId);
  const batch = batchFor(skuId);
  return {
    skuId,
    productId: info.productId,
    productName: info.productName,
    variantLabel: info.variantLabel,
    barcode: info.barcode,
    unitPrice: info.priceCents !== null ? money(info.priceCents) : null,
    sellable,
    isBundle: info.isBundle,
    fefoBatches:
      sellable > 0 && !info.isBundle
        ? [
            {
              batchId: batch.batchId,
              lotNumber: batch.batchNumber,
              expiresOn: batch.expiresOn,
              locationId: ids.locationCounterId,
              quantity: `${sellable}.000`,
            },
          ]
        : [],
  };
}

const allSkus = () => shopDb.products.flatMap((p) => p.skus.map((s) => ({ product: p, sku: s })));

/** The fixed `ProductCategory` enumeration: Shared/Common/Enums/ProductCategory.cs:21-31. */
const POS_CATEGORIES = [
  'RiceAndGrains',
  'HoneyAndGur',
  'OilsAndGhee',
  'Spices',
  'Pulses',
  'TeaAndDrinks',
  'FreshProduce',
  'DatesAndDryFruit',
  'DairyAndEggs',
  'SnacksAndSweets',
  'HouseholdAndCare',
];

/** Api/Contracts/Order/PosRequests.cs:31-33 and ReturnAndRefundCommandValidators.cs:93-97: the buyer's details are both given or neither. */
const BOTH_OR_NEITHER = 'must be given with the %s (or leave both empty for a sale without customer details).';
/** Shared/Common/Constants/AnonymousCounterCustomer.cs:19-22 and OrderMessages.cs:20. */
const ANONYMOUS_RECIPIENT = 'Walk-in customer';
/** AnonymousCounterCustomer.NormalisedMobile (AnonymousCounterCustomer.cs:17): every typed form (01…, +8801…, 8801…) normalises to this. */
const ANONYMOUS_RESERVED_NORMALISED = '+8801000000000';

export const posOrderingHandlers: HttpHandler[] = [
  http.get(`${API}/sku`, ({ request }) => {
    const barcode = new URL(request.url).searchParams.get('barcode')?.trim();
    if (!barcode) return violation('barcode', 'InvalidQuery', 'barcode is required (up to 64 characters).');
    const found = allSkus().find(({ sku }) => sku.barcode === barcode && sku.status === 'Active');
    const view = found ? posSku(found.sku.skuId) : null;
    return view ? HttpResponse.json(view) : notFound();
  }),

  http.get(`${API}/skus`, ({ request }) => {
    const q = new URL(request.url).searchParams.get('q')?.trim().toLowerCase() ?? '';
    if (q.length < 2) return violation('q', 'InvalidQuery', 'q must be 2 to 100 characters.');
    const rows = allSkus()
      .filter(
        ({ product, sku }) =>
          sku.status === 'Active' &&
          product.status === 'Active' &&
          (product.name.toLowerCase().includes(q) ||
            sku.code.toLowerCase().includes(q) ||
            (sku.barcode ?? '').includes(q)),
      )
      .slice(0, 20)
      .map(({ sku }) => posSku(sku.skuId))
      .filter((x) => x !== null);
    return HttpResponse.json(rows);
  }),

  // HO-P5 BG-6: the counter grid. Api/Controllers/StaffPosController.cs:50-63 and Read/QueryHandlers/Order/PosQueryHandlers.cs:76-99:
  // sellable SKUs in name order (then code), optionally within one product category, paged -- 20 by default, 100 at most.
  // `category` is a ProductCategory name, matched case-insensitively (EnumerationParsing.cs:20-30), else 400; `pageSize <= 0` is 400;
  // `fefoBatches` is empty here (`withFefoPreview: false`). A page can be short of `pageSize`: the server drops a bundle whose component is not sellable.
  http.get(`${API}/browse`, ({ request }) => {
    const url = new URL(request.url);
    const requested = url.searchParams.get('category')?.trim() ?? '';
    const category = requested === '' ? null : (POS_CATEGORIES.find((name) => name.toLowerCase() === requested.toLowerCase()) ?? undefined);
    if (category === undefined) return HttpResponse.json({ error: 'category is not a product category.' }, { status: 400 });
    const rawNumber = url.searchParams.get('pageNumber');
    const rawSize = url.searchParams.get('pageSize');
    if (rawNumber !== null && Number(rawNumber) > 1_000_000) {
      return violation('pageNumber', 'InvalidPageNumber', 'pageNumber must not exceed 1000000.');
    }
    if (rawSize !== null && Number(rawSize) <= 0) return violation('pageSize', 'InvalidPageSize', 'pageSize must be greater than zero.');
    const pageNumber = rawNumber !== null && Number(rawNumber) > 0 ? Math.trunc(Number(rawNumber)) : 1;
    const pageSize = rawSize !== null ? Math.min(Math.trunc(Number(rawSize)), 100) : 20;

    const rows = allSkus()
      .filter(
        ({ product, sku }) =>
          sku.status === 'Active' &&
          product.status === 'Active' &&
          product.listed &&
          sku.price !== null &&
          (category === null || product.category === category),
      )
      .sort(
        (a, b) =>
          a.product.name.localeCompare(b.product.name) || a.sku.code.localeCompare(b.sku.code) || a.sku.skuId.localeCompare(b.sku.skuId),
      );
    const items = rows
      .slice((pageNumber - 1) * pageSize, pageNumber * pageSize)
      .map(({ sku }) => posSku(sku.skuId))
      .filter((x) => x !== null)
      .map((sku) => ({ ...sku, fefoBatches: [] }));
    return HttpResponse.json({ items, pageNumber, pageSize, totalCount: rows.length });
  }),

  http.post(`${API}/quote`, async ({ request }) => {
    const body = (await request.json()) as {
      customerId?: string | null;
      lines: Array<{ skuId: string; quantity: number }>;
      discountCode?: string | null;
      tenderedCash?: number | null;
    };
    // HO-P5 BG-7: Api/Controllers/StaffPosController.cs:75-76 -- above zero, at most 9,999,999,999.99, at most two decimals.
    const tendered = body.tenderedCash;
    if (tendered !== undefined && tendered !== null) {
      if (typeof tendered !== 'number' || !(tendered > 0) || tendered > 9_999_999_999.99 || Number(tendered.toFixed(2)) !== tendered) {
        return HttpResponse.json({ error: 'tenderedCash must be above zero with at most two decimal places.' }, { status: 400 });
      }
    }
    if (!body.lines || body.lines.length === 0 || body.lines.some((l) => l.quantity < 1)) {
      return violation('Lines', 'InvalidQuery', 'lines must have 1 to 50 items, each with a quantity of at least 1.');
    }
    const lines: QuoteLineInput[] = body.lines.map((l) => ({
      lineId: uuid(),
      skuId: l.skuId,
      quantity: l.quantity,
      priceWhenAddedCents: skuInfo(l.skuId)?.priceCents ?? 0,
    }));
    const result = computeQuote(lines, {
      fulfilment: 'Counter',
      discountCode: body.discountCode ?? undefined,
      customerHasOrders: !!body.customerId,
    });
    // HO-P5 BG-7: with a tendered amount and a sale that can be made (and no quantity cut down), exactly one of
    // `changeDue` (the cash covers the total; zero when exact) and `cashShort` -- both absent otherwise.
    // Read/QueryHandlers/Order/PosQueryHandlers.cs:113-123, by the rule of Domain/DomainServices/TenderCalculator.cs:49-52.
    // The arithmetic is the server's, done here because this handler IS the server.
    const changes = (result.wire.changes as Array<{ kind: string }> | undefined) ?? [];
    if (tendered !== undefined && tendered !== null && result.wire.canSell === true && changes.every((c) => c.kind !== 'QuantityReduced')) {
      const handed = Math.round(tendered * 100);
      const grand = result.totals.grand;
      return HttpResponse.json(
        handed >= grand ? { ...result.wire, changeDue: money(handed - grand), cashShort: null } : { ...result.wire, changeDue: null, cashShort: money(grand - handed) },
      );
    }
    return HttpResponse.json({ ...result.wire, changeDue: null, cashShort: null });
  }),

  http.post(`${API}/sales`, async ({ request }) => {
    const key = request.headers.get('Idempotency-Key');
    if (!key) return violation('Idempotency-Key', 'IdempotencyKeyRequired', 'An Idempotency-Key header is required.');
    const replay = db.idempotency[key];
    if (replay) return HttpResponse.json(replay.body as object, { status: replay.status });
    const body = (await request.json()) as {
      customerName?: string;
      customerMobile?: string;
      lines: Array<{ skuId: string; quantity: number }>;
      discountCode?: string | null;
      tenders: Array<{ method: string; amount: unknown; reference?: string | null }>;
    };
    const name = body.customerName?.trim() ?? '';
    const mobile = body.customerMobile?.trim() ?? '';
    // HO-P5 BG-8: both or neither. Neither is an anonymous walk-in sale (no customer on the order).
    const anonymous = name === '' && mobile === '';
    const problems: Array<{ propertyName: string; errorCode: string; errorMessage: string }> = [];
    if (!anonymous && !name) {
      problems.push({ propertyName: 'CustomerName', errorCode: 'NotEmptyValidator', errorMessage: BOTH_OR_NEITHER.replace('%s', 'mobile number') });
    }
    if (!anonymous && !mobile) {
      problems.push({ propertyName: 'CustomerMobile', errorCode: 'NotEmptyValidator', errorMessage: BOTH_OR_NEITHER.replace('%s', 'name') });
    }
    if (!anonymous && mobile && !/^\+?[0-9]{8,15}$/.test(mobile.replace(/[\s-]/g, ''))) {
      problems.push({ propertyName: 'CustomerMobile', errorCode: 'InvalidMobile', errorMessage: "Enter the customer's mobile number." });
    }
    if (problems.length > 0) {
      return HttpResponse.json(
        { errors: problems.map((p) => ({ ...p, resourceName: 'Ordering' })), isValid: false },
        { status: 400 },
      );
    }
    // The reserved walk-in number cannot be typed as a real customer (CompleteCounterSaleCommandHandler.cs:65-66).
    if (!anonymous && normaliseMobile(mobile) === ANONYMOUS_RESERVED_NORMALISED) {
      return violation('CustomerMobile', 'InvalidMobileNumber', 'This does not look like a valid mobile number.');
    }
    if (mobile === '01700000000') {
      return violation('CustomerMobile', 'AccountNotActive', "This customer's account is closed, so a sale can't be recorded against it.");
    }
    // A code limited per customer or to a first order cannot be policed without a customer on the order (CompleteCounterSaleCommandHandler.cs:82-84).
    if (anonymous && body.discountCode?.trim()) {
      const limited = db.codes.find((c) => c.code.toLowerCase() === body.discountCode!.trim().toLowerCase());
      if (limited && (limited.perCustomerLimit !== null || limited.firstOrderOnly)) {
        return violation(
          'DiscountCode',
          'DiscountCustomerLimitReached',
          "This discount code is limited per customer or to a first order, so it needs the customer's name and mobile number.",
        );
      }
    }
    const lines: QuoteLineInput[] = body.lines.map((l) => ({
      lineId: uuid(),
      skuId: l.skuId,
      quantity: l.quantity,
      priceWhenAddedCents: skuInfo(l.skuId)?.priceCents ?? 0,
    }));
    const result = computeQuote(lines, {
      fulfilment: 'Counter',
      discountCode: body.discountCode ?? undefined,
      customerHasOrders: true,
    });
    if (!result.canPlace && result.blocking.some((c) => c !== 'PaymentMethodUnavailable')) {
      return violation('Lines', result.blocking[0] ?? 'NothingToPlace', '');
    }
    if (result.priced.length === 0 || result.priced.length !== lines.length) {
      return violation('Lines', 'StockNoLongerAvailable', 'An item has just sold out. Remove it and try again.');
    }

    // Tenders (TenderCalculator): card at face value, cash up to the balance, change from the surplus.
    const tenders = body.tenders ?? [];
    const refuse = (code: string, message: string) => violation('Tenders', code, message);
    if (tenders.length === 0 || tenders.length > 6) return refuse('TendersDoNotCoverTotal', 'Take at least one payment, each above zero.');
    const cents = tenders.map((t) => Math.round(Number(t.amount) * 100));
    if (cents.some((c) => !(c > 0))) return refuse('TendersDoNotCoverTotal', 'Take at least one payment, each above zero.');
    const cards = tenders.filter((t) => t.method === 'InStoreCard');
    if (cards.some((c) => !c.reference?.trim())) return refuse('TerminalReferenceRequired', 'Enter the card terminal slip reference.');
    const cardTotal = tenders.reduce((sum, t, i) => (t.method === 'InStoreCard' ? sum + (cents[i] ?? 0) : sum), 0);
    const grand = result.totals.grand;
    if (cardTotal > grand) return refuse('TendersDoNotCoverTotal', 'Card payments cannot be more than what is owed.');
    const cashDue = grand - cardTotal;
    const cashHanded = tenders.reduce((sum, t, i) => (t.method === 'Cash' ? sum + (cents[i] ?? 0) : sum), 0);
    if (cashHanded < cashDue) return refuse('TendersDoNotCoverTotal', 'The payments do not cover the total of the sale.');

    const placedOn = nowIso();
    const orderLines: DbOrderLine[] = result.priced.map((p, index) => ({
      lineId: uuid(),
      lineNumber: index + 1,
      skuId: p.skuId,
      productName: p.productName,
      variantLabel: p.variantLabel,
      quantity: p.quantity,
      unitCents: p.unitCents,
      subtotalCents: p.subtotalCents,
      discountCents: p.discountCents,
      shareCents: p.shareCents,
      taxRatePercent: p.taxRatePercent,
      taxCents: p.taxCents,
      totalCents: p.totalCents,
      quantityReturned: 0,
      returnClass: p.returnClass,
      allocations: [],
    }));
    const known = mobile.endsWith(ids.customerMobile.slice(-9));
    const order: DbOrder = {
      id: uuid(),
      version: 3,
      orderNumber: nextOrderNumber(),
      placedOn,
      channel: 'Counter',
      customerId: known ? ids.customerId : null,
      customerName: anonymous ? ANONYMOUS_RECIPIENT : name,
      customerMobile: anonymous ? null : mobile,
      status: 'Delivered',
      fulfilmentMethod: 'Counter',
      paymentMethod: 'InStore',
      cancellationReason: null,
      lines: orderLines,
      subtotalCents: result.totals.subtotal,
      lineDiscountCents: result.totals.lineDiscount,
      orderDiscountCents: result.totals.orderDiscount,
      deliveryChargeCents: 0,
      taxCents: result.totals.tax,
      grandTotalCents: grand,
      fulfilment: {
        recipientName: anonymous ? ANONYMOUS_RECIPIENT : name,
        recipientPhone: anonymous ? null : mobile,
        line1: null,
        line2: null,
        city: null,
        district: null,
        postalCode: null,
        deliveryInstructions: null,
        zoneName: null,
        serviceLevel: null,
        slotDate: null,
        slotWindow: null,
        pickupBranchId: null,
        pickupBranchName: null,
        pickupBranchAddress: null,
      },
      history: [
        { from: null, to: 'PendingPayment', changedOn: placedOn, changedBy: db.actor, changedByName: 'Amina Hossain', note: null },
        { from: 'PendingPayment', to: 'Confirmed', changedOn: placedOn, changedBy: db.actor, changedByName: 'Amina Hossain', note: null },
        { from: 'Confirmed', to: 'Delivered', changedOn: placedOn, changedBy: db.actor, changedByName: 'Amina Hossain', note: null },
      ],
      paymentDueBy: null,
      customerTransferReference: null,
      transferReportedOn: null,
      held: null,
      cod: null,
      shipment: null,
      collectBy: null,
      invoiceNumber: nextInvoiceNumber(),
      amountPaidCents: grand,
      amountRefundedCents: 0,
      refundDueCents: 0,
      discountCode: result.discountApplied ? (body.discountCode?.toUpperCase() ?? null) : null,
      returnWindowEndsOn: null,
      courierReportsDelivered: false,
      tenders: tenders.map((t, i) => ({
        method: t.method === 'InStoreCard' ? 'InStoreCard' : 'Cash',
        amountCents: t.method === 'InStoreCard' ? (cents[i] ?? 0) : cashDue,
        reference: t.reference?.trim() ?? null,
      })),
      changeDueCents: cashHanded - cashDue,
      cashier: 'Amina Hossain',
    };
    allocateOrder(order);
    for (const l of order.lines) db.stock[l.skuId] = stockOf(l.skuId) - l.quantity;
    db.orders.unshift(order);
    const response = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      invoiceNumber: order.invoiceNumber,
      grandTotal: money(grand),
      changeDue: money(order.changeDueCents),
    };
    db.idempotency[key] = { status: 201, body: response };
    persist();
    return HttpResponse.json(response, { status: 201 });
  }),

  http.get(`${API}/sales/:orderId/receipt`, ({ params }) => {
    const order = findOrder(String(params.orderId));
    if (!order || order.channel !== 'Counter') return notFound();
    const lines = order.lines.map((l) => {
      const view = orderLineView(l);
      return {
        description: `${l.productName} ${l.variantLabel}`.trim(),
        quantity: l.quantity,
        unitPrice: view.unitPrice,
        lineDiscount: view.lineDiscount,
        taxRatePercent: l.taxRatePercent,
        taxAmount: view.taxAmount,
        lineTotal: view.lineTotal,
      };
    });
    const pad = (left: string, right: string) => `${left}${' '.repeat(Math.max(1, 48 - left.length - right.length))}${right}`;
    const text = [
      'Amar Gram Dhanmondi'.padStart(33),
      'House 12, Road 5, Dhanmondi, Dhaka',
      '='.repeat(48),
      pad('Order', order.orderNumber),
      pad('Invoice', order.invoiceNumber ?? ''),
      '-'.repeat(48),
      ...order.lines.map((l) => pad(`${l.quantity} x ${l.productName}`.slice(0, 34), formatCents(l.totalCents))),
      '-'.repeat(48),
      pad('TOTAL', formatCents(order.grandTotalCents)),
      ...order.tenders.map((t) => pad(t.method === 'Cash' ? 'Cash' : 'Card in store', formatCents(t.amountCents))),
      pad('Change', formatCents(order.changeDueCents)),
    ].join('\n');
    return HttpResponse.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      invoiceNumber: order.invoiceNumber ?? '',
      branchName: 'Amar Gram Dhanmondi',
      branchAddress: 'House 12, Road 5, Dhanmondi, Dhaka',
      branchPhone: '+880 1700 000001',
      legalName: 'Amar Gram Ltd',
      taxRegistrationNumber: 'BIN 000123456-0101',
      soldOn: order.placedOn,
      soldOnLocal: new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: ids.timeZoneId }).format(new Date(order.placedOn)),
      branchTimeZoneId: ids.timeZoneId,
      cashier: order.cashier ?? 'Amina Hossain',
      customerName: order.customerId ? order.customerName : null,
      lines,
      totals: totalsView(order),
      tenders: order.tenders.map((t) => ({ method: t.method, amount: money(t.amountCents) })),
      changeDue: money(order.changeDueCents),
      text,
    });
  }),
];

export { noContent };
