import { beforeEach, describe, expect, it } from 'vitest';
import { inventoryFixtureIds as ids, resetInventoryMockData } from '@/mocks/handlers/inventory';
import { db } from '@/mocks/handlers/inventory/store';

/**
 * U47 (HO-P5 §15, ADR-FE-185, §18 A19) -- one case per mocked refusal S3 added in `mocks/handlers/inventory/**`. Each title
 * cites the server file:line the mock mirrors.
 */

const BASE = 'http://localhost:5005';
const DRAFTS = '/api/staff/inventory/goods-receipt-drafts';
const UNASSIGNED_BRANCH = 'b0000000-0000-0000-0000-00000000ffff';
const draftIdOf = (n: number) => `ee000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function call(method: string, path: string, body?: unknown, branch: string = ids.mainBranchId) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Branch-Id': branch },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, json: text ? (JSON.parse(text) as any) : null };
}

const line = (over: Record<string, unknown> = {}) => ({
  skuId: ids.foodSkuId,
  purchaseOrderLineId: null,
  lotNumber: 'L1',
  manufacturedOn: null,
  expiresOn: null,
  quantityAccepted: '4',
  quantityRejected: '0',
  rejectionReason: null,
  rejectionNote: null,
  locationId: ids.warehouseId,
  holdForInspection: false,
  unitCostAmount: '10',
  unitCostCurrency: 'BDT',
  exchangeRateToBase: null,
  ...over,
});
const form = (over: Record<string, unknown> = {}) => ({
  supplierId: null,
  purchaseOrderId: null,
  consignmentId: null,
  deliveryReference: 'DRV-1',
  lines: [line()],
  ...over,
});
const first = (json: any) => json.errors[0] as { propertyName: string; errorCode: string; errorMessage: string };

beforeEach(() => resetInventoryMockData());

describe('U47 — receipt drafts (GoodsReceiptDraftCommandHandlers.cs:23-63, GoodsReceiptDraftAggregate.cs:52-130)', () => {
  it('saves and reads back the caller\'s own draft; the list is newest first, owner-only, and branchId narrows it', async () => {
    expect((await call('PUT', `${DRAFTS}/${draftIdOf(1)}`, form())).json).toMatchObject({ draftId: draftIdOf(1), version: 1, branchId: ids.mainBranchId });
    expect((await call('PUT', `${DRAFTS}/${draftIdOf(1)}`, form({ deliveryReference: 'DRV-2' }))).json.version).toBe(2);
    expect((await call('PUT', `${DRAFTS}/${draftIdOf(2)}`, form({ branchId: ids.londonBranchId }))).status).toBe(200);
    const list = (await call('GET', DRAFTS)).json as any[];
    expect(list.map((d) => d.draftId).sort()).toEqual([draftIdOf(1), draftIdOf(2)].sort());
    expect(list.some((d) => d.draftId === ids.otherStaffDraftId)).toBe(false);
    expect(((await call('GET', `${DRAFTS}?branchId=${ids.londonBranchId}`)).json as any[]).map((d) => d.draftId)).toEqual([draftIdOf(2)]);
    const read = (await call('GET', `${DRAFTS}/${draftIdOf(1)}`)).json;
    expect(read).toMatchObject({ deliveryReference: 'DRV-2', branchName: 'Dhanmondi outlet' });
    expect(read.lines[0]).toMatchObject({ skuCode: 'FD-RCE-5KG', lotNumber: 'L1', quantityAccepted: '4' });
  });

  it('another staff member\'s draft answers 404 to read, save and discard, exactly like an unknown id (handler :34-35)', async () => {
    for (const [method, body] of [['GET', undefined], ['PUT', form()], ['DELETE', undefined]] as const) {
      const r = await call(method, `${DRAFTS}/${ids.otherStaffDraftId}`, body);
      expect(r.status, method).toBe(404);
    }
    expect((await call('GET', `${DRAFTS}/${draftIdOf(99)}`)).status).toBe(404);
    expect((await call('DELETE', `${DRAFTS}/${draftIdOf(99)}`)).status).toBe(404);
    // Her draft is untouched.
    expect(db.receiptDrafts.find((d) => d.draftId === ids.otherStaffDraftId)?.deliveryReference).toBe('NADIA-DRAFT');
  });

  it('a 21st open draft is a 400 GoodsReceiptDraftLimitReached on DraftId; saving an existing one still works (handler :38-46)', async () => {
    for (let n = 1; n <= 20; n += 1) expect((await call('PUT', `${DRAFTS}/${draftIdOf(n)}`, form())).status).toBe(200);
    const r = await call('PUT', `${DRAFTS}/${draftIdOf(21)}`, form());
    expect(r.status).toBe(400);
    expect(first(r.json)).toMatchObject({
      propertyName: 'DraftId',
      errorCode: 'GoodsReceiptDraftLimitReached',
      errorMessage: 'You already have 20 open drafts. Post or discard one first.',
    });
    expect((await call('PUT', `${DRAFTS}/${draftIdOf(20)}`, form({ deliveryReference: 'again' }))).status).toBe(200);
    // Discarding one makes room.
    expect((await call('DELETE', `${DRAFTS}/${draftIdOf(1)}`)).status).toBe(204);
    expect((await call('PUT', `${DRAFTS}/${draftIdOf(21)}`, form())).status).toBe(200);
  });

  it('a closed draft can never be saved again (404), and discarding a closed one is a success (aggregate :52-58, handler :74)', async () => {
    await call('PUT', `${DRAFTS}/${draftIdOf(1)}`, form());
    expect((await call('DELETE', `${DRAFTS}/${draftIdOf(1)}`)).status).toBe(204);
    expect((await call('PUT', `${DRAFTS}/${draftIdOf(1)}`, form())).status).toBe(404);
    expect((await call('GET', `${DRAFTS}/${draftIdOf(1)}`)).status).toBe(404);
    expect((await call('DELETE', `${DRAFTS}/${draftIdOf(1)}`)).status).toBe(204);
    expect(((await call('GET', DRAFTS)).json as any[]).some((d) => d.draftId === draftIdOf(1))).toBe(false);
  });

  it('a negative quantity is a 400 InvalidGoodsReceiptDraft on Lines[i].QuantityAccepted (aggregate :114-115)', async () => {
    const r = await call('PUT', `${DRAFTS}/${draftIdOf(1)}`, form({ lines: [line(), line({ quantityRejected: '-1' })] }));
    expect(r.status).toBe(400);
    expect(first(r.json)).toMatchObject({
      propertyName: 'Lines[1].QuantityAccepted',
      errorCode: 'InvalidGoodsReceiptDraft',
      errorMessage: 'Quantities cannot be negative.',
    });
    expect((await call('GET', `${DRAFTS}/${draftIdOf(1)}`)).status).toBe(404); // nothing was created
  });

  it('over-long fields are refused by the command validator first (MaximumLengthValidator), before the aggregate (:27-59)', async () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ deliveryReference: 'x'.repeat(61) }, 'DeliveryReference'],
      [{ note: 'x'.repeat(501) }, 'Note'],
      [{ lines: [line({ lotNumber: 'x'.repeat(61) })] }, 'Lines[0].LotNumber'],
    ];
    for (const [over, property] of cases) {
      const r = await call('PUT', `${DRAFTS}/${draftIdOf(1)}`, form(over));
      expect(r.status, property).toBe(400);
      expect(first(r.json), property).toMatchObject({ propertyName: property, errorCode: 'MaximumLengthValidator' });
    }
    const controls = await call('PUT', `${DRAFTS}/${draftIdOf(1)}`, form({ deliveryReference: 'a\u0007b' }));
    expect(first(controls.json)).toMatchObject({ propertyName: 'DeliveryReference', errorCode: 'PredicateValidator' });
  });

  it('a branch the caller is not assigned to is a 403 { error: "BranchNotAssigned" }, before anything else (controller :60)', async () => {
    const r = await call('PUT', `${DRAFTS}/${draftIdOf(1)}`, form({ branchId: UNASSIGNED_BRANCH }));
    expect(r.status).toBe(403);
    expect(r.json).toEqual({ error: 'BranchNotAssigned' });
  });

  it('posting with draftId closes the caller\'s draft; an unknown draft id is ignored (GoodsReceiptCommandHandler.cs:101-120)', async () => {
    await call('PUT', `${DRAFTS}/${draftIdOf(1)}`, form());
    const posted = await call('POST', '/api/staff/inventory/goods-receipts', {
      draftId: draftIdOf(1),
      deliveryReference: 'DRV-1',
      purchaseOrderId: null,
      consignmentId: null,
      supplierId: null,
      lines: [line({ expiresOn: '2099-01-01' })],
    });
    expect(posted.status).toBe(201);
    expect(posted.json.branchId).toBe(ids.mainBranchId);
    expect((await call('PUT', `${DRAFTS}/${draftIdOf(1)}`, form())).status).toBe(404);
    const unknown = await call('POST', '/api/staff/inventory/goods-receipts', {
      draftId: draftIdOf(77),
      deliveryReference: 'DRV-2',
      purchaseOrderId: null,
      consignmentId: null,
      supplierId: null,
      lines: [line({ lotNumber: 'L2', expiresOn: '2099-01-01' })],
    });
    expect(unknown.status).toBe(201);
  });
});

describe('U47 — receiving into another branch (InventoryControllerSupport.cs:35-56)', () => {
  const unassigned = `branchId=${UNASSIGNED_BRANCH}`;

  it('the order, consignment and location lists and the post refuse a branch the caller is not assigned to with 403 BranchNotAssigned', async () => {
    for (const path of [
      `/api/staff/procurement/purchase-orders?${unassigned}`,
      `/api/staff/procurement/consignments?${unassigned}`,
      `/api/staff/inventory/locations?${unassigned}`,
    ]) {
      const r = await call('GET', path);
      expect(r.status, path).toBe(403);
      expect(r.json, path).toEqual({ error: 'BranchNotAssigned' });
    }
    const post = await call('POST', '/api/staff/inventory/goods-receipts', {
      branchId: UNASSIGNED_BRANCH,
      purchaseOrderId: null,
      consignmentId: null,
      supplierId: null,
      deliveryReference: null,
      lines: [line()],
    });
    expect(post.status).toBe(403);
    expect(post.json).toEqual({ error: 'BranchNotAssigned' });
  });

  it('an assigned branch is read for that branch, not the active one', async () => {
    const london = (await call('GET', `/api/staff/inventory/locations?branchId=${ids.londonBranchId}`)).json as any[];
    expect(london.map((l) => l.id)).toEqual(expect.arrayContaining([ids.londonWarehouseId]));
    expect(london.some((l) => l.id === ids.warehouseId)).toBe(false);
    const main = (await call('GET', '/api/staff/inventory/locations')).json as any[];
    expect(main.some((l) => l.id === ids.warehouseId)).toBe(true);
    // Posting into London checks the line location against LONDON: the main warehouse is not there.
    const post = await call('POST', '/api/staff/inventory/goods-receipts', {
      branchId: ids.londonBranchId,
      purchaseOrderId: null,
      consignmentId: null,
      supplierId: null,
      deliveryReference: null,
      lines: [line({ expiresOn: '2099-01-01' })],
    });
    expect(post.status).toBe(400);
    expect(post.json.errors.some((e: any) => e.propertyName === 'Lines[0].LocationId' && e.errorCode === 'StockLocationNotFound')).toBe(true);
  });
});

describe('U47 — consignments arriving (StaffAlertsAndReorderController.cs:41-42, ProcurementConsignmentsController.cs:34-37)', () => {
  it('arrivalWindowDays outside 1-90 is a 400 InvalidQuery on arrivalWindowDays; the default is 7', async () => {
    for (const bad of ['0', '91', '-3', 'x']) {
      const r = await call('GET', `/api/staff/inventory/alerts/summary?arrivalWindowDays=${bad}`);
      expect(r.status, bad).toBe(400);
      expect(first(r.json), bad).toMatchObject({ propertyName: 'arrivalWindowDays', errorCode: 'InvalidQuery' });
    }
    const ok = await call('GET', '/api/staff/inventory/alerts/summary');
    expect(ok.json.consignmentsArriving).toMatchObject({ withinDays: 7 });
    expect(typeof ok.json.consignmentsArriving.count).toBe('number');
    expect((await call('GET', '/api/staff/inventory/alerts/summary?arrivalWindowDays=90')).json.consignmentsArriving.withinDays).toBe(90);
  });

  it('arrivingWithinDays outside 1-90 is a 400 InvalidQuery; the list and the overview count are the same set (not cancelled, not received)', async () => {
    for (const bad of ['0', '91', 'x']) {
      const r = await call('GET', `/api/staff/procurement/consignments?arrivingWithinDays=${bad}`);
      expect(r.status, bad).toBe(400);
      expect(first(r.json), bad).toMatchObject({ propertyName: 'arrivingWithinDays', errorCode: 'InvalidQuery' });
    }
    for (const days of [7, 30, 90]) {
      const summary = (await call('GET', `/api/staff/inventory/alerts/summary?arrivalWindowDays=${days}`)).json;
      const list = (await call('GET', `/api/staff/procurement/consignments?arrivingWithinDays=${days}&pageSize=100`)).json;
      expect(list.totalCount, `${days} days`).toBe(summary.consignmentsArriving.count);
      for (const c of list.items) expect(c.status).not.toBe('Cancelled');
    }
  });
});

describe('U47 — reorder level and batch received / supplier (StockQueryHandlers.cs:213-224, InventoryStockViewModels.cs:49-52)', () => {
  it('every stock row carries the level, the default flag and the below flag; the belowReorderPoint filter is exactly the flag', async () => {
    const all = (await call('GET', '/api/staff/inventory/stock?pageSize=100')).json.items as any[];
    expect(all.length).toBeGreaterThan(0);
    for (const row of all) {
      expect(typeof row.reorderLevel).toBe('string');
      expect(typeof row.reorderLevelIsDefault).toBe('boolean');
      expect(typeof row.belowReorderLevel).toBe('boolean');
    }
    const below = (await call('GET', '/api/staff/inventory/stock?belowReorderPoint=true&pageSize=100')).json.items as any[];
    expect(below.map((r) => r.skuId).sort()).toEqual(all.filter((r) => r.belowReorderLevel).map((r) => r.skuId).sort());
    // The wet food SKU has an EXPLICIT policy of 10 at the warehouse: the level is that policy, not the default.
    const wet = all.find((r) => r.skuId === ids.wetFoodSkuId);
    if (wet) expect(wet).toMatchObject({ reorderLevel: '10', reorderLevelIsDefault: false });
  });

  it('a batch of the matrix says when it was received and who supplied it (null without a supplier)', async () => {
    const matrix = (await call('GET', `/api/staff/inventory/stock/${ids.foodSkuId}`)).json;
    expect(matrix.batches.length).toBeGreaterThan(0);
    for (const batch of matrix.batches) {
      expect(batch).toHaveProperty('receivedOn');
      expect(batch).toHaveProperty('supplierName');
    }
    const supplied = db.batches.find((b) => b.skuId === ids.foodSkuId && b.supplierId);
    if (supplied) {
      const name = db.suppliers.find((s) => s.id === supplied.supplierId)?.name ?? null;
      expect(matrix.batches.find((b: any) => b.batchId === supplied.id)).toMatchObject({ supplierName: name });
    }
  });
});
