import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiFetch, ApiError, ApiForbiddenError, ApiNotFoundError, ApiValidationError } from '@/lib/api/client';
import { getSalesSeries } from '@/lib/api/dashboard';
import {
  browsePosSkus,
  completeCounterSale,
  getCounterQuote,
  getReceipt,
} from '@/lib/api/pos';
import {
  createRider,
  dispatchOrder,
  getStaffOrder,
  getStaffOrderStatusCounts,
  listRiders,
  markPacked,
  markReadyForCollection,
  recordTracking,
  setLinePicked,
  cancelStaffOrder,
  updateRider,
} from '@/lib/api/staff-orders';
import { orderingIds as ids } from '../../../mocks/handlers/ordering/fixtures';
import { findOrder, p5OrderIds, resetOrderingMockData, riderIds } from '../../../mocks/handlers/ordering/store';
import { resetReportsMockData } from '../../../mocks/handlers/reports';
import { setMockReportRoles } from '../../../mocks/handlers/reports/fixtures';
import { setMockOrderingRoles } from '../../../mocks/handlers/ordering/staff';

/**
 * HO-P5 S2 — U47 (§15): one case per mocked refusal this slice added, so the mock answers as the real server does. Each
 * `describe` names the server file and line it mirrors. The roles come from the staff session the accounts mock holds; the
 * unit environment carries no cookie, so each mock's role seam stands one in (`asRoles`).
 */
function asRoles(roles: string[] | null): void {
  setMockOrderingRoles(roles);
  setMockReportRoles(roles);
}

beforeEach(() => {
  resetOrderingMockData();
  resetReportsMockData();
  asRoles(null);
});
afterEach(() => asRoles(null));

async function failureOf(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error('expected the request to be refused');
}

async function violationOf(run: () => Promise<unknown>) {
  const error = await failureOf(run);
  expect(error).toBeInstanceOf(ApiValidationError);
  return (error as ApiValidationError).response.errors[0]!;
}

async function statusOf(run: () => Promise<unknown>): Promise<number> {
  const error = await failureOf(run);
  expect(error).toBeInstanceOf(ApiError);
  return (error as ApiError).status;
}

const postRaw = (orderId: string, path: string, body: unknown) =>
  apiFetch(`/api/staff/orders/${orderId}/${path}`, { method: 'POST', body });

describe('Packed and pick ticks - StaffOrdersController.cs:194-221, OrderAggregate.cs:406-433', () => {
  it('POST …/packed moves only a Packing order, naming the state otherwise (400 InvalidOrderTransition)', async () => {
    const refusal = await violationOf(() => markPacked(ids.orders.confirmedCod));
    expect(refusal.errorCode).toBe('InvalidOrderTransition');
    expect(refusal.errorMessage).toBe('A confirmed order cannot be marked as packed.');

    const packing = findOrder(ids.orders.packingPickup)!;
    const version = packing.version;
    await markPacked(packing.id);
    expect(packing.status).toBe('Packed');
    expect(packing.packedOn).toBeTruthy();
    expect(packing.version).toBe(version + 1);
    expect((await getStaffOrder(packing.id)).packedOn).toBe(packing.packedOn);
  });

  it('POST …/packed refuses an order with an unallocated line (400 OrderNotFullyAllocated)', async () => {
    const packing = findOrder(ids.orders.packingPickup)!;
    packing.lines[0]!.allocations = [];
    expect((await violationOf(() => markPacked(packing.id))).errorCode).toBe('OrderNotFullyAllocated');
  });

  it('an unknown order is 404', async () => {
    expect(await failureOf(() => markPacked('f0000000-0000-0000-0000-00000000ffff'))).toBeInstanceOf(ApiNotFoundError);
  });

  it('PUT …/picked is idempotent: a repeat changes nothing, an untick clears who and when', async () => {
    const order = findOrder(ids.orders.confirmedCod)!;
    const line = order.lines[0]!;
    await setLinePicked(order.id, line.lineId, true);
    const first = { version: order.version, on: line.pickedOn };
    expect(line.picked).toBe(true);
    expect(first.on).toBeTruthy();
    await setLinePicked(order.id, line.lineId, true);
    expect(order.version).toBe(first.version);
    expect((await getStaffOrder(order.id)).lines[0]).toMatchObject({ picked: true, pickedOn: first.on, pickedBy: line.pickedBy });
    await setLinePicked(order.id, line.lineId, false);
    expect(order.lines[0]).toMatchObject({ picked: false, pickedOn: null, pickedBy: null });
  });

  it('PUT …/picked: an unknown line is 404, and once the order left the shelf it is 400 InvalidOrderTransition (checked first)', async () => {
    const order = findOrder(ids.orders.confirmedCod)!;
    expect(await failureOf(() => setLinePicked(order.id, 'f1111111-1111-1111-1111-111111111111', true))).toBeInstanceOf(ApiNotFoundError);
    const dispatched = findOrder(ids.orders.dispatchedCod)!;
    const refusal = await violationOf(() => setLinePicked(dispatched.id, dispatched.lines[0]!.lineId, true));
    expect(refusal.errorCode).toBe('InvalidOrderTransition');
    // The status is checked before the line, so an unknown line on a dispatched order is the same 400, not a 404.
    expect((await violationOf(() => setLinePicked(dispatched.id, 'f1111111-1111-1111-1111-111111111111', true))).errorCode).toBe('InvalidOrderTransition');
  });

  it('the packed seed order accepts ticks, and a Packed order can still be cancelled (OrderTransitionRules.cs:64)', async () => {
    const packed = findOrder(p5OrderIds.packedWaiting)!;
    await setLinePicked(packed.id, packed.lines[0]!.lineId, false);
    expect(packed.lines[0]!.picked).toBe(false);
    expect((await getStaffOrder(packed.id)).allowedActions).toEqual(['Dispatch', 'Cancel']);
    await cancelStaffOrder(packed.id, 'Customer rang to cancel');
    expect(packed.status).toBe('Cancelled');
  });
});

describe('Dispatch target - OrderFulfilmentCommandValidators.cs:42-50, OrderFulfilmentCommandHandlers.cs:105-145, OrderAggregate.cs:436-447', () => {
  const packedId = p5OrderIds.packedWaiting;

  it('both courier and rider, or neither, is 400 DispatchTargetInvalid on CourierId', async () => {
    for (const body of [{ courierId: ids.courierPathaoId, riderId: riderIds.rafiq }, {}]) {
      const refusal = await violationOf(() => postRaw(packedId, 'dispatch', body));
      expect(refusal).toMatchObject({ errorCode: 'DispatchTargetInvalid', propertyName: 'CourierId' });
    }
    expect(findOrder(packedId)!.status).toBe('Packed');
  });

  it('a rider delivery has no tracking number (400 DispatchTargetInvalid)', async () => {
    const refusal = await violationOf(() => postRaw(packedId, 'dispatch', { riderId: riderIds.rafiq, trackingNumber: 'X1' }));
    expect(refusal.errorCode).toBe('DispatchTargetInvalid');
  });

  it('an unknown, inactive or foreign rider and an unknown courier are 404', async () => {
    expect(await failureOf(() => dispatchOrder(packedId, { riderId: riderIds.kamalInactive }))).toBeInstanceOf(ApiNotFoundError);
    expect(await failureOf(() => dispatchOrder(packedId, { riderId: 'a2000000-0000-0000-0000-0000000000ff' }))).toBeInstanceOf(ApiNotFoundError);
    expect(await failureOf(() => dispatchOrder(packedId, { courierId: 'c1000000-0000-0000-0000-0000000000ff' }))).toBeInstanceOf(ApiNotFoundError);
    expect(findOrder(packedId)!.status).toBe('Packed');
  });

  it('a Packed delivery dispatches to a rider: courierId null, the rider’s id and name, no tracking, and no tracking can be added', async () => {
    await dispatchOrder(packedId, { riderId: riderIds.jahid });
    const shipment = (await getStaffOrder(packedId)).shipment!;
    expect(shipment).toMatchObject({ courierId: null, riderId: riderIds.jahid, riderName: 'Jahid Alam', trackingNumber: null });
    expect(findOrder(packedId)!.status).toBe('Dispatched');
    const refusal = await violationOf(() => recordTracking(packedId, 'PC-1'));
    expect(refusal.errorCode).toBe('InvalidOrderTransition');
  });

  it('a courier dispatch still carries the courier and tracking, with the rider fields null', async () => {
    await dispatchOrder(packedId, { courierId: ids.courierPathaoId }, 'PC-9');
    expect((await getStaffOrder(packedId)).shipment).toMatchObject({ courierId: ids.courierPathaoId, riderId: null, riderName: null, trackingNumber: 'PC-9' });
  });

  it('a pickup order is never dispatched, and an order that is not Packing or Packed is refused naming its state', async () => {
    const pickup = findOrder(ids.orders.packingPickup)!;
    expect((await violationOf(() => dispatchOrder(pickup.id, { riderId: riderIds.rafiq }))).errorMessage).toBe('A pickup order is marked ready for collection, not dispatched.');
    const refusal = await violationOf(() => dispatchOrder(ids.orders.confirmedCod, { riderId: riderIds.rafiq }));
    expect(refusal).toMatchObject({ errorCode: 'InvalidOrderTransition', errorMessage: 'A confirmed order cannot be dispatched.' });
  });

  it('ready-for-collection works from Packed for a pickup and refuses a delivery (OrderAggregate.cs:450-455)', async () => {
    const pickup = findOrder(ids.orders.packingPickup)!;
    await markPacked(pickup.id);
    await markReadyForCollection(pickup.id);
    expect(pickup.status).toBe('Dispatched');
    const refusal = await violationOf(() => markReadyForCollection(p5OrderIds.packedWaiting));
    expect(refusal.errorMessage).toBe('Only a pickup order is marked ready for collection.');
  });
});

describe('status-counts - StaffOrdersController.cs:139-158, StaffOrderQueryHandlers.cs:87-105', () => {
  it('lists every status in pipeline order, zeros included, with the total', async () => {
    const counts = await getStaffOrderStatusCounts({});
    expect(counts.counts.map((c) => c.status)).toEqual([
      'PendingPayment', 'Confirmed', 'Packing', 'Packed', 'Dispatched', 'Delivered', 'Cancelled', 'Returned', 'Refunded',
    ]);
    expect(counts.counts.find((c) => c.status === 'Packed')!.count).toBe(1);
    expect(counts.counts.find((c) => c.status === 'Refunded')!.count).toBe(0);
    expect(counts.total).toBe(counts.counts.reduce((sum, c) => sum + c.count, 0));
  });

  it('follows the queue’s other filters', async () => {
    const counts = await getStaffOrderStatusCounts({ fulfilment: 'Pickup' });
    expect(counts.total).toBeGreaterThan(0);
    expect(counts.total).toBeLessThan((await getStaffOrderStatusCounts({})).total);
  });

  it('refuses a malformed fulfilment, payment method or channel, and a search over 100 characters (400)', async () => {
    for (const filters of [{ fulfilment: 'Teleport' }, { paymentMethod: 'Barter' }, { channel: 'Telepathy' }, { search: 'x'.repeat(101) }]) {
      expect(await statusOf(() => getStaffOrderStatusCounts(filters))).toBe(400);
    }
    // A name matches whatever its case, as EnumerationParsing does; `Subscription` is a channel the filter accepts.
    await expect(getStaffOrderStatusCounts({ channel: 'subscription' })).resolves.toMatchObject({ total: 0 });
  });
});

describe('Riders - StaffRidersController.cs, RiderCommandHandlers.cs, RiderAggregate.cs, RiderViewModel', () => {
  it('lists name order, never the branch, with the mobile number normalised; activeOnly drops the inactive', async () => {
    const all = await listRiders(false);
    expect(all.map((r) => r.name)).toEqual(['Jahid Alam', 'Kamal Mia', 'Rafiq Hasan']);
    for (const rider of all) expect(Object.keys(rider).sort()).toEqual(['id', 'isActive', 'mobileNumber', 'name']);
    expect(all.find((r) => r.name === 'Rafiq Hasan')!.mobileNumber).toBe('+8801711000101');
    expect((await listRiders(true)).map((r) => r.name)).toEqual(['Jahid Alam', 'Rafiq Hasan']);
  });

  it('a name already used at the branch is 400 RiderNameAlreadyExists on Name (compared trimmed, exactly)', async () => {
    const refusal = await violationOf(() => createRider({ name: '  Rafiq Hasan ', isActive: true }));
    expect(refusal).toMatchObject({ errorCode: 'RiderNameAlreadyExists', propertyName: 'Name' });
    await expect(createRider({ name: 'rafiq hasan', isActive: true })).resolves.toHaveProperty('riderId');
    const taken = await violationOf(() => updateRider(riderIds.jahid, { name: 'Rafiq Hasan', isActive: true }));
    expect(taken.errorCode).toBe('RiderNameAlreadyExists');
    // Saving a rider under its own name is not a clash.
    await expect(updateRider(riderIds.jahid, { name: 'Jahid Alam', mobileNumber: '01712345678', isActive: true })).resolves.toBeUndefined();
    expect((await listRiders(false)).find((r) => r.id === riderIds.jahid)!.mobileNumber).toBe('+8801712345678');
  });

  it('refuses a missing or over-long name, control characters and a mobile that is not a Bangladesh number (400)', async () => {
    expect((await violationOf(() => createRider({ name: '', isActive: true }))).propertyName).toBe('Name');
    expect((await violationOf(() => createRider({ name: 'x'.repeat(101), isActive: true }))).propertyName).toBe('Name');
    expect((await violationOf(() => createRider({ name: 'Bad\u0007Name', isActive: true }))).propertyName).toBe('Name');
    expect(await violationOf(() => createRider({ name: 'Nur', mobileNumber: '12345', isActive: true }))).toMatchObject({
      errorCode: 'InvalidMobileNumber',
      propertyName: 'MobileNumber',
    });
  });

  it('an unknown rider on update is 404 RiderNotFound', async () => {
    expect(await failureOf(() => updateRider('a2000000-0000-0000-0000-0000000000ff', { name: 'Nobody', isActive: true }))).toBeInstanceOf(ApiNotFoundError);
  });

  it('reading needs Orders.Fulfil and writing needs Riders.Manage (403)', async () => {
    asRoles(['Reception']);
    await expect(listRiders(true)).resolves.toHaveLength(2);
    expect(await failureOf(() => createRider({ name: 'Nur', isActive: true }))).toBeInstanceOf(ApiForbiddenError);
    expect(await failureOf(() => updateRider(riderIds.jahid, { name: 'Jahid', isActive: true }))).toBeInstanceOf(ApiForbiddenError);
    asRoles(['Inventory']);
    expect(await failureOf(() => listRiders(true))).toBeInstanceOf(ApiForbiddenError);
    expect(await failureOf(() => markPacked(ids.orders.packingPickup))).toBeInstanceOf(ApiForbiddenError);
    asRoles(['ShopManager']);
    await expect(createRider({ name: 'Nur', isActive: true })).resolves.toHaveProperty('riderId');
  });
});


describe('POS browse - StaffPosController.cs:50-63, PosQueryHandlers.cs:76-99', () => {
  it('pages sellable items by name with the server’s total, and sends no FEFO preview', async () => {
    const first = await browsePosSkus({ pageNumber: 1, pageSize: 5 });
    expect(first.items).toHaveLength(5);
    expect(first.totalCount).toBeGreaterThan(5);
    expect(first.items.every((sku) => sku.fefoBatches.length === 0)).toBe(true);
    const names = first.items.map((sku) => sku.productName);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    const second = await browsePosSkus({ pageNumber: 2, pageSize: 5 });
    expect(second.items[0]!.skuId).not.toBe(first.items[0]!.skuId);
  });

  it('narrows to one category by name, whatever its case; an unknown category is 400; pageSize 0 is 400 and is capped at 100', async () => {
    const rice = await browsePosSkus({ category: 'riceandgrains', pageNumber: 1, pageSize: 100 });
    expect(rice.items.length).toBeGreaterThan(0);
    expect(rice.totalCount).toBeLessThan((await browsePosSkus({ pageNumber: 1, pageSize: 100 })).totalCount);
    expect(await statusOf(() => browsePosSkus({ category: 'Gadgets', pageNumber: 1, pageSize: 20 }))).toBe(400);
    expect(await statusOf(() => browsePosSkus({ pageNumber: 1, pageSize: 0 }))).toBe(400);
    expect((await browsePosSkus({ pageNumber: 1, pageSize: 500 })).pageSize).toBe(100);
  });
});

describe('Counter quote tender - StaffPosController.cs:75-76, PosQueryHandlers.cs:111-122', () => {
  const lines = [{ skuId: ids.skuJasmineRice, quantity: 1 }];

  it('answers exactly one of changeDue and cashShort for the cash typed, none without a tender', async () => {
    const none = await getCounterQuote({ lines });
    expect(none.changeDue ?? null).toBeNull();
    expect(none.cashShort ?? null).toBeNull();
    const over = await getCounterQuote({ lines, tenderedCash: '1000' });
    expect(over.changeDue).toEqual({ amount: '220.00', currencyCode: 'BDT' });
    expect(over.cashShort ?? null).toBeNull();
    const exact = await getCounterQuote({ lines, tenderedCash: '780.00' });
    expect(exact.changeDue).toEqual({ amount: '0.00', currencyCode: 'BDT' });
    const short = await getCounterQuote({ lines, tenderedCash: '500.00' });
    expect(short.cashShort).toEqual({ amount: '280.00', currencyCode: 'BDT' });
    expect(short.changeDue ?? null).toBeNull();
  });

  it('refuses a tender that is zero, negative or has more than two decimals (400), and answers no change for a sale that cannot be made', async () => {
    for (const tenderedCash of ['0', '0.00', '12.345']) {
      expect(await statusOf(() => getCounterQuote({ lines, tenderedCash }))).toBe(400);
    }
    const sellOut = await getCounterQuote({ lines: [{ skuId: ids.skuOutOfStock, quantity: 1 }], tenderedCash: '5000' });
    expect(sellOut.canSell).toBe(false);
    expect(sellOut.changeDue ?? null).toBeNull();
    expect(sellOut.cashShort ?? null).toBeNull();
  });
});

describe('Walk-in sale - PosRequests.cs:31-33, ReturnAndRefundCommandValidators.cs:93-97, CompleteCounterSaleCommandHandler.cs:50-84', () => {
  const sale = (customer: { customerName?: string; customerMobile?: string }, extra: { discountCode?: string } = {}) =>
    completeCounterSale(
      { ...customer, ...extra, lines: [{ skuId: ids.skuJasmineRice, quantity: 1 }], tenders: [{ method: 'Cash', amount: '1000.00' }] },
      crypto.randomUUID(),
    );

  it('a name without a mobile, or a mobile without a name, is 400 on the missing field', async () => {
    expect(await violationOf(() => sale({ customerName: 'Rana' }))).toMatchObject({ propertyName: 'CustomerMobile', errorCode: 'NotEmptyValidator' });
    expect(await violationOf(() => sale({ customerMobile: '01711112222' }))).toMatchObject({ propertyName: 'CustomerName', errorCode: 'NotEmptyValidator' });
  });

  it('neither is an anonymous sale: it completes, the order has no customer and the receipt names none', async () => {
    const done = await sale({});
    expect(done.changeDue).toEqual({ amount: '220.00', currencyCode: 'BDT' });
    const order = findOrder(done.orderId)!;
    expect(order.customerId).toBeNull();
    expect(order.fulfilment.recipientName).toBe('Walk-in customer');
    expect((await getReceipt(done.orderId)).customerName).toBeNull();
  });

  it('the reserved walk-in number cannot be typed as a customer, and a limited discount code needs a customer (400)', async () => {
    expect(await violationOf(() => sale({ customerName: 'Rana', customerMobile: '01000000000' }))).toMatchObject({
      errorCode: 'InvalidMobileNumber',
      propertyName: 'CustomerMobile',
    });
    expect(await violationOf(() => sale({}, { discountCode: 'SAVE100' }))).toMatchObject({
      errorCode: 'DiscountCustomerLimitReached',
      propertyName: 'DiscountCode',
    });
  });
});

describe('Gate follow-ups - mock truthfulness', () => {
  const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';
  const sale = (customerMobile: string) =>
    completeCounterSale(
      { customerName: 'Rana', customerMobile, lines: [{ skuId: ids.skuJasmineRice, quantity: 1 }], tenders: [{ method: 'Cash', amount: '1000.00' }] },
      crypto.randomUUID(),
    );

  it('the reserved walk-in number is refused in every form it can be typed (CompleteCounterSaleCommandHandler.cs:57,65)', async () => {
    for (const typed of ['01000000000', '+8801000000000', '8801000000000', '+880 1000-000000', '008801000000000']) {
      expect(await violationOf(() => sale(typed))).toMatchObject({ errorCode: 'InvalidMobileNumber', propertyName: 'CustomerMobile' });
    }
  });

  it('the quote always sends changeDue and cashShort, null when absent (the view model has no ignore-null setting)', async () => {
    const lines = [{ skuId: ids.skuJasmineRice, quantity: 1 }];
    const raw = await apiFetch<Record<string, unknown>>('/api/staff/pos/quote', { method: 'POST', body: { lines } });
    expect(raw).toHaveProperty('changeDue', null);
    expect(raw).toHaveProperty('cashShort', null);
    const over = await apiFetch<Record<string, unknown>>('/api/staff/pos/quote', { method: 'POST', body: { lines, tenderedCash: 1000 } });
    expect(over).toHaveProperty('cashShort', null);
    expect(over.changeDue).toEqual({ amount: '220.00', currencyCode: 'BDT' });
  });

  it('rider writes check in the server’s order: shape, then 404, then duplicate name, then the mobile number', async () => {
    // A whitespace-only name is NotEmpty, not a domain refusal.
    expect(await violationOf(() => createRider({ name: '   ', isActive: true }))).toMatchObject({ errorCode: 'NotEmptyValidator', propertyName: 'Name' });
    // A bad mobile on a duplicate name reports the duplicate first.
    expect((await violationOf(() => createRider({ name: 'Rafiq Hasan', mobileNumber: '12345', isActive: true }))).errorCode).toBe('RiderNameAlreadyExists');
    expect((await violationOf(() => updateRider(riderIds.jahid, { name: 'Rafiq Hasan', mobileNumber: '12345', isActive: true }))).errorCode).toBe('RiderNameAlreadyExists');
    // A bad mobile for a rider that does not exist reports the missing rider (404), not the mobile.
    expect(await failureOf(() => updateRider('a2000000-0000-0000-0000-0000000000ff', { name: 'Nobody', mobileNumber: '12345', isActive: true }))).toBeInstanceOf(ApiNotFoundError);
    expect((await violationOf(() => updateRider(riderIds.jahid, { name: 'Jahid Alam', mobileNumber: '12345', isActive: true }))).errorCode).toBe('InvalidMobileNumber');
  });

  it('an empty-Guid courier beside a real rider passes the validator and is refused by the handler (OrderFulfilmentCommandHandlers.cs:108)', async () => {
    const refusal = await violationOf(() => postRaw(p5OrderIds.packedWaiting, 'dispatch', { courierId: EMPTY_GUID, riderId: riderIds.rafiq }));
    expect(refusal.errorCode).toBe('DispatchTargetInvalid');
    expect(findOrder(p5OrderIds.packedWaiting)!.status).toBe('Packed');
  });

  it('start-packing, tracking and cancel are role-gated like the other writes (Orders.Fulfil, Orders.Cancel)', async () => {
    asRoles(['Accountant']);
    expect(await failureOf(() => postRaw(ids.orders.confirmedCod, 'packing', {}))).toBeInstanceOf(ApiForbiddenError);
    expect(await failureOf(() => recordTracking(ids.orders.dispatchedCod, 'PC-1'))).toBeInstanceOf(ApiForbiddenError);
    expect(await failureOf(() => cancelStaffOrder(ids.orders.confirmedCod, 'no'))).toBeInstanceOf(ApiForbiddenError);
    asRoles(['Reception']);
    await expect(cancelStaffOrder(ids.orders.confirmedCod, 'Customer rang')).resolves.toBeUndefined();
  });
});

describe('Sales series - StaffDashboardController.cs:38-61, SalesSeriesQueries.cs:13-14', () => {
  it('returns 14 days by default, oldest first, every day present, with the server’s total', async () => {
    const series = await getSalesSeries();
    expect(series.days).toHaveLength(14);
    expect(series.days.map((d) => d.date)).toEqual([...series.days.map((d) => d.date)].sort());
    expect(series.days.at(-1)!.date).toBe(series.to);
    expect(series.days[0]!.date).toBe(series.from);
    expect(series.total.currencyCode).toBe('BDT');
    expect(series.days.some((d) => d.net.amount === '0.00' && d.orders === 0)).toBe(true);
    expect((await getSalesSeries(31)).days).toHaveLength(31);
  });

  it('refuses days outside 1 to 31 (400)', async () => {
    for (const days of [0, 32, -3]) expect(await statusOf(() => getSalesSeries(days))).toBe(400);
    expect(await statusOf(() => apiFetch('/api/staff/dashboard/sales-series?days=abc'))).toBe(400);
  });

  it('is Reports.SalesView only (403 for another role) and 403 BranchNotAssigned without a branch', async () => {
    asRoles(['Inventory']);
    expect(await failureOf(() => getSalesSeries())).toBeInstanceOf(ApiForbiddenError);
    asRoles(['NoBranch', 'Administrator']);
    expect(await failureOf(() => getSalesSeries())).toBeInstanceOf(ApiForbiddenError);
  });

  it('the dashboard shows the rider cash tile to ShopManager, Accountant and Administrator only', async () => {
    const tiles = async (r: string[]) => {
      asRoles(r);
      return (await apiFetch<{ tiles: Array<{ key: string; figures: Array<{ key: string; value: unknown }> }> }>('/api/staff/dashboard')).tiles;
    };
    const cod = (await tiles(['Administrator'])).find((t) => t.key === 'orders.cod-with-riders')!;
    expect(cod.figures.map((f) => f.key)).toEqual(['riders', 'orders', 'amount']);
    expect(cod.figures.find((f) => f.key === 'orders')!.value).toBe(1);
    expect((await tiles(['Inventory'])).some((t) => t.key === 'orders.cod-with-riders')).toBe(false);
    expect((await tiles(['Accountant'])).some((t) => t.key === 'orders.cod-with-riders')).toBe(true);
  });
});

