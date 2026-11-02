import { http, HttpResponse, type HttpHandler } from 'msw';
import type {
  GoodsReceiptDetail,
  GoodsReceiptDraft,
  GoodsReceiptDraftSummary,
  GoodsReceiptSummary,
  PostGoodsReceiptRequest,
  SaveGoodsReceiptDraftRequest,
} from '@/lib/api/inventory-receipts';
import {
  BRANCH_NAMES,
  MOCK_BASE_CURRENCY,
  ROLES,
  branchOf,
  guard,
  resolveBranch,
  violation,
  isAllowed,
  nowIso,
  omit,
  notFoundResponse,
  paged,
  q,
  todayDate,
  unitCost,
  violations,
  type Violation,
} from './fixtures';
import { ACTOR_ID, db, docNumber, newId, persist, type MBatch, type MDraft } from './store';
import { locationOf, moveStock, skuOf } from './stock';

/** `mocks/handlers/inventory/receipts.ts` — `StaffGoodsReceiptsController`. The validation mirrors
 *  `GoodsReceiptAggregate.Validate`: EVERY line violation is returned, named `Lines[i].Field`. */

type MReceiptRecord = (typeof db.receipts)[number];

function summary(r: MReceiptRecord): GoodsReceiptSummary {
  return {
    id: r.id,
    number: r.number,
    receivedOn: r.receivedOn,
    supplierId: r.supplierId,
    supplierName: r.supplierName,
    purchaseOrderId: r.purchaseOrderId,
    purchaseOrderNumber: r.purchaseOrderNumber,
    consignmentId: r.consignmentId,
    deliveryReference: r.deliveryReference,
    lineCount: r.lines.length,
    batchCount: r.lines.filter((l) => l.batchId).length,
    receivedBy: r.receivedBy,
  };
}

function detail(r: MReceiptRecord, includeCosts: boolean): GoodsReceiptDetail {
  return {
    ...omit(r, '_poLines', '_branchId'),
    lines: r.lines.map((l) => ({ ...l, unitCost: includeCosts ? l.unitCost : null })),
  };
}

function validate(body: PostGoodsReceiptRequest, branchId: string): Violation[] {
  const problems: Violation[] = [];
  const add = (propertyName: string, errorCode: string, errorMessage: string) =>
    problems.push({ propertyName, errorCode, errorMessage });

  const po = body.purchaseOrderId
    ? db.purchaseOrders.find((p) => p.id === body.purchaseOrderId && p.branchId === branchId)
    : null;
  if (body.purchaseOrderId && (!po || po.status !== 'Issued')) {
    add(
      'PurchaseOrderId',
      'PurchaseOrderNotIssued',
      'Goods can only be received against an issued purchase order.',
    );
  }
  if (po && body.supplierId && body.supplierId !== po.supplierId) {
    add(
      'SupplierId',
      'ReceiptSupplierMismatch',
      "The supplier is not the purchase order's supplier.",
    );
  }
  const consignment = body.consignmentId
    ? db.consignments.find((c) => c.id === body.consignmentId && c.branchId === branchId)
    : null;
  if (body.consignmentId && (!consignment || consignment.status !== 'Cleared')) {
    add(
      'ConsignmentId',
      'ConsignmentNotCleared',
      'Goods can only be received against a cleared consignment.',
    );
  }
  if (problems.length > 0) return problems;

  if (body.lines.length === 0) {
    add('Lines', 'GoodsReceiptLinesRequired', 'A goods receipt has between 1 and 200 lines.');
    return problems;
  }

  const acceptedPerPoLine = new Map<string, number>();
  const seen = new Set<string>();
  body.lines.forEach((line, i) => {
    const prefix = `Lines[${i}]`;
    const sku = db.skus.find((s) => s.skuId === line.skuId);
    if (!sku) {
      add(`${prefix}.SkuId`, 'SkuNotFound', 'That SKU does not exist.');
      return;
    }
    const accepted = parseFloat(line.quantityAccepted || '0');
    const rejected = parseFloat(line.quantityRejected || '0');
    let quantitiesValid = true;
    for (const [value, raw, property] of [
      [accepted, line.quantityAccepted, 'QuantityAccepted'],
      [rejected, line.quantityRejected, 'QuantityRejected'],
    ] as const) {
      if (value < 0) {
        add(`${prefix}.${property}`, 'InvalidQuantity', 'A quantity cannot be negative.');
        quantitiesValid = false;
      } else if (value > 0 && !sku.allowsFractionalQuantity && String(raw).includes('.')) {
        add(
          `${prefix}.${property}`,
          'FractionalQuantityNotAllowed',
          'This item can only be counted in whole units.',
        );
        quantitiesValid = false;
      }
    }
    if (quantitiesValid && accepted + rejected <= 0) {
      add(
        `${prefix}.QuantityAccepted`,
        'InvalidQuantity',
        'A line must receive or reject a quantity.',
      );
    }
    if (rejected > 0 && !line.rejectionReason) {
      add(
        `${prefix}.RejectionReason`,
        'RejectionReasonRequired',
        'A rejected quantity needs a reason.',
      );
    }
    const lot = (line.lotNumber ?? '').trim();
    const takes = accepted > 0;
    if (takes && (lot.length === 0 || lot.length > 60)) {
      add(
        `${prefix}.LotNumber`,
        'LotNumberRequired',
        'A lot number (at most 60 characters) is required for accepted stock.',
      );
    }
    if (takes && sku.expiryRequired && !line.expiresOn) {
      add(
        `${prefix}.ExpiresOn`,
        'ExpiryDateRequired',
        'Food and other perishables must be received with an expiry date.',
      );
    }
    if (takes && line.expiresOn && line.expiresOn < todayDate()) {
      add(
        `${prefix}.ExpiresOn`,
        'BatchAlreadyExpired',
        'Expired goods cannot be accepted -- reject them with the reason Expired.',
      );
    }
    if (
      line.manufacturedOn &&
      (line.manufacturedOn > todayDate() ||
        (line.expiresOn && line.manufacturedOn >= line.expiresOn))
    ) {
      add(
        `${prefix}.ManufacturedOn`,
        'InvalidBatchDates',
        'The manufacture date must be in the past and before the expiry date.',
      );
    }
    if (line.purchaseOrderLineId) {
      const poLine = po?.lines.find((l) => l.lineId === line.purchaseOrderLineId);
      if (!poLine || poLine.skuId !== line.skuId) {
        add(
          `${prefix}.PurchaseOrderLineId`,
          'PurchaseOrderLineMismatch',
          'That purchase order line does not exist for this SKU.',
        );
      } else if (takes) {
        const total = (acceptedPerPoLine.get(poLine.lineId) ?? 0) + accepted;
        acceptedPerPoLine.set(poLine.lineId, total);
        if (poLine.acceptedQuantity + total > poLine.orderedQuantity) {
          add(
            `${prefix}.QuantityAccepted`,
            'ReceiptExceedsOutstanding',
            `Only ${q(Math.max(0, poLine.orderedQuantity - poLine.acceptedQuantity))} is still outstanding on that order line.`,
          );
        }
      }
    } else if (takes && (!line.unitCostAmount || !line.unitCostCurrency)) {
      add(
        `${prefix}.UnitCostAmount`,
        'UnitCostRequired',
        'A unit cost is required when receiving without a purchase order.',
      );
    } else if (takes && line.unitCostCurrency !== MOCK_BASE_CURRENCY) {
      const rate = consignment?.exchangeRates.find((r) => r.currencyCode === line.unitCostCurrency);
      if (!rate && !line.exchangeRateToBase) {
        add(
          `${prefix}.ExchangeRateToBase`,
          'ExchangeRateMissing',
          `No exchange rate to ${MOCK_BASE_CURRENCY} is recorded for ${line.unitCostCurrency}.`,
        );
      }
    }
    const location = locationOf(line.locationId);
    if (!location || location.branchId !== branchId || !location.isActive) {
      add(
        `${prefix}.LocationId`,
        'StockLocationNotFound',
        'That location does not exist at this branch.',
      );
    } else if (!location.permittedMovements.includes('Receipt')) {
      add(
        `${prefix}.LocationId`,
        'MovementNotPermittedAtLocation',
        'Stock cannot be received at that location.',
      );
    }
    const key = `${line.skuId}|${lot}|${line.expiresOn ?? ''}`;
    if (takes) {
      if (seen.has(key))
        add(
          `${prefix}.LotNumber`,
          'DuplicateReceiptLine',
          'The same SKU, lot and expiry cannot appear twice in one receipt.',
        );
      seen.add(key);
    }
  });
  return problems;
}

// ---- HO-P5 BG-18: receipt drafts -----------------------------------------------------------------------------
// `StaffGoodsReceiptDraftsController.cs:14-82`, `SaveGoodsReceiptDraftCommandHandler` (GoodsReceiptDraftCommandHandlers.cs:23-63),
// `GoodsReceiptDraftAggregate.cs:52-130`. The draft is the CALLER'S workspace: ACTOR_ID here.

const MAX_DRAFTS_PER_STAFF = 20; // InventoryRules.cs:33
const MAX_DRAFT_NOTE = 500; // InventoryRules.cs:34
const MAX_RECEIPT_LINES = 200; // InventoryRules.cs:10
const MAX_LOT_LENGTH = 60; // InventoryRules.cs:42
const NOTE_MAX = 500; // InventoryRules.cs:38

const clean = (v: string | null | undefined) => (v && v.trim() !== '' ? v.trim() : null);
const controlCharacter = (v: string | null | undefined) =>
  !!v && /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v);

/** The `ValidationResponse` body (`BadRequest(response.ValidationResult)`), several errors allowed. */
function draftViolations(
  list: Array<{ propertyName: string; errorCode: string; errorMessage: string }>,
): Response {
  return violations(list);
}

/** `SaveGoodsReceiptDraftCommandValidator` + `GoodsReceiptDraftLineInputValidator` (GoodsReceiptAndBatchCommandValidators.cs:27-59). */
function draftShapeProblems(body: SaveGoodsReceiptDraftRequest) {
  const problems: Violation[] = [];
  const tooLong = (property: string, label: string, max: number, length: number) =>
    problems.push({
      propertyName: property,
      errorCode: 'MaximumLengthValidator',
      errorMessage: `The length of '${label}' must be ${max} characters or fewer. You entered ${length} characters.`,
    });
  const controls = (property: string) =>
    problems.push({
      propertyName: property,
      errorCode: 'PredicateValidator',
      errorMessage: 'must not contain control characters.', // ValidationRuleExtensions.cs:31-32
    });
  if ((body.deliveryReference?.length ?? 0) > 60)
    tooLong('DeliveryReference', 'Delivery Reference', 60, body.deliveryReference!.length);
  if (controlCharacter(body.deliveryReference)) controls('DeliveryReference');
  if ((body.note?.length ?? 0) > MAX_DRAFT_NOTE) tooLong('Note', 'Note', MAX_DRAFT_NOTE, body.note!.length);
  if (controlCharacter(body.note)) controls('Note');
  if (body.lines.length > MAX_RECEIPT_LINES)
    problems.push({
      propertyName: 'Lines',
      errorCode: 'PredicateValidator',
      errorMessage: `A goods receipt has at most ${MAX_RECEIPT_LINES} lines.`,
    });
  body.lines.forEach((line, i) => {
    const prefix = `Lines[${i}]`;
    if ((line.lotNumber?.length ?? 0) > MAX_LOT_LENGTH)
      tooLong(`${prefix}.LotNumber`, 'Lot Number', MAX_LOT_LENGTH, line.lotNumber!.length);
    if ((line.rejectionNote?.length ?? 0) > NOTE_MAX)
      tooLong(`${prefix}.RejectionNote`, 'Rejection Note', NOTE_MAX, line.rejectionNote!.length);
    if ((line.rejectionReason?.length ?? 0) > 40)
      tooLong(`${prefix}.RejectionReason`, 'Rejection Reason', 40, line.rejectionReason!.length);
  });
  return problems;
}

/** `GoodsReceiptDraftAggregate.Validate` (the second line, after the validator): one violation, `InvalidGoodsReceiptDraft`. */
function draftAggregateProblem(body: SaveGoodsReceiptDraftRequest): Violation | null {
  const invalid = (propertyName: string, errorMessage: string): Violation => ({
    propertyName,
    errorCode: 'InvalidGoodsReceiptDraft',
    errorMessage,
  });
  if (body.lines.length > MAX_RECEIPT_LINES)
    return invalid('Lines', `A receipt has at most ${MAX_RECEIPT_LINES} lines.`);
  if ((clean(body.deliveryReference)?.length ?? 0) > 60)
    return invalid('DeliveryReference', 'The delivery reference is at most 60 characters.');
  if ((clean(body.note)?.length ?? 0) > MAX_DRAFT_NOTE)
    return invalid('Note', `The note is at most ${MAX_DRAFT_NOTE} characters.`);
  for (let i = 0; i < body.lines.length; i += 1) {
    const line = body.lines[i]!;
    const prefix = `Lines[${i}]`;
    if (!line.skuId || line.skuId === '00000000-0000-0000-0000-000000000000')
      return invalid(`${prefix}.SkuId`, 'Every line needs an item.');
    const accepted = parseFloat(String(line.quantityAccepted ?? '0'));
    const rejected = parseFloat(String(line.quantityRejected ?? '0'));
    if (accepted < 0 || rejected < 0 || accepted > 999_999_999 || rejected > 999_999_999)
      return invalid(`${prefix}.QuantityAccepted`, 'Quantities cannot be negative.');
    if (line.unitCostAmount !== null && line.unitCostAmount !== undefined) {
      const cost = parseFloat(line.unitCostAmount);
      if (cost < 0 || cost > 9_999_999_999)
        return invalid(`${prefix}.UnitCostAmount`, 'The unit cost or exchange rate is out of range.');
    }
  }
  return null;
}

const notFoundResponseForDraft = () => notFoundResponse();

const draftOf = (id: string): MDraft | undefined => db.receiptDrafts.find((d) => d.draftId === id);
/** Another member's draft answers exactly like an unknown one (`GoodsReceiptDraftCommandHandlers.cs:34-35`). */
const ownDraft = (id: string): MDraft | undefined => {
  const draft = draftOf(id);
  return draft && draft.ownerId === ACTOR_ID ? draft : undefined;
};

function draftSummary(d: MDraft): GoodsReceiptDraftSummary {
  const supplier = db.suppliers.find((s) => s.id === d.supplierId);
  return {
    draftId: d.draftId,
    branchId: d.branchId,
    branchName: BRANCH_NAMES[d.branchId] ?? null,
    supplierId: d.supplierId,
    supplierName: supplier?.name ?? null,
    purchaseOrderId: d.purchaseOrderId,
    consignmentId: d.consignmentId,
    deliveryReference: d.deliveryReference,
    lineCount: d.lines.length,
    version: d.version,
    updatedOn: d.updatedOn,
  };
}

function draftView(d: MDraft): GoodsReceiptDraft {
  return {
    draftId: d.draftId,
    branchId: d.branchId,
    branchName: BRANCH_NAMES[d.branchId] ?? null,
    supplierId: d.supplierId,
    purchaseOrderId: d.purchaseOrderId,
    consignmentId: d.consignmentId,
    deliveryReference: d.deliveryReference,
    receivedOn: d.receivedOn,
    note: d.note,
    version: d.version,
    updatedOn: d.updatedOn,
    lines: d.lines.map((line) => {
      const sku = db.skus.find((s) => s.skuId === line.skuId);
      return { ...line, skuCode: sku?.skuCode ?? null, displayName: sku?.displayName ?? null };
    }),
  };
}

/** Closes the caller's draft a receipt was posted from (`CloseDraftAsync`, GoodsReceiptCommandHandler.cs:101-120): the content is cleared. */
function closeDraft(draftId: string | null | undefined, status: 'Posted' | 'Discarded'): void {
  const draft = draftId ? ownDraft(draftId) : undefined;
  if (!draft || draft.status !== 'Open') return;
  draft.status = status;
  draft.lines = [];
  draft.supplierId = draft.purchaseOrderId = draft.consignmentId = null;
  draft.deliveryReference = draft.note = draft.receivedOn = null;
  draft.version += 1;
}

const draftHandlers: HttpHandler[] = [
  http.get('*/api/staff/inventory/goods-receipt-drafts', ({ request }) => {
    const denied = guard(request, ROLES.stockManage);
    if (denied) return denied;
    const branchId = new URL(request.url).searchParams.get('branchId');
    const rows = db.receiptDrafts
      .filter((d) => d.ownerId === ACTOR_ID && d.status === 'Open')
      .filter((d) => !branchId || d.branchId === branchId)
      .sort((a, b) => b.updatedOn.localeCompare(a.updatedOn))
      .map(draftSummary);
    return HttpResponse.json(rows);
  }),

  http.get('*/api/staff/inventory/goods-receipt-drafts/:id', ({ request, params }) => {
    const denied = guard(request, ROLES.stockManage);
    if (denied) return denied;
    const draft = ownDraft(String(params.id));
    return draft && draft.status === 'Open'
      ? HttpResponse.json(draftView(draft))
      : notFoundResponseForDraft();
  }),

  http.put('*/api/staff/inventory/goods-receipt-drafts/:id', async ({ request, params }) => {
    const denied = guard(request, ROLES.stockManage);
    if (denied) return denied;
    const id = String(params.id);
    const body = (await request.json()) as SaveGoodsReceiptDraftRequest;
    body.lines ??= [];
    // 1. The branch: an explicit one the caller is not assigned to is a 403 (`TryResolveBranch`).
    const branch = resolveBranch(request, body.branchId);
    if (branch instanceof Response) return branch;
    // 2. The command validator: shape only, every problem together.
    const shape = draftShapeProblems(body);
    if (shape.length > 0) return draftViolations(shape);
    // 3. The handler: another member's draft is a 404; a NEW one counts against the limit of 20.
    const existing = draftOf(id);
    if (existing && existing.ownerId !== ACTOR_ID) return notFoundResponseForDraft();
    if (!existing) {
      const open = db.receiptDrafts.filter((d) => d.ownerId === ACTOR_ID && d.status === 'Open').length;
      if (open >= MAX_DRAFTS_PER_STAFF)
        return violation(
          'DraftId',
          'GoodsReceiptDraftLimitReached',
          `You already have ${MAX_DRAFTS_PER_STAFF} open drafts. Post or discard one first.`,
        );
    }
    // 4. The aggregate: a closed draft can never be saved again (404); then the shape limits.
    if (existing && existing.status !== 'Open') return notFoundResponseForDraft();
    const problem = draftAggregateProblem(body);
    if (problem) return violations([problem]);

    const draft: MDraft = existing ?? {
      draftId: id,
      ownerId: ACTOR_ID,
      branchId: branch,
      supplierId: null,
      purchaseOrderId: null,
      consignmentId: null,
      deliveryReference: null,
      receivedOn: null,
      note: null,
      version: 0,
      updatedOn: nowIso(),
      status: 'Open',
      lines: [],
    };
    draft.branchId = branch;
    draft.supplierId = body.supplierId ?? null;
    draft.purchaseOrderId = body.purchaseOrderId ?? null;
    draft.consignmentId = body.consignmentId ?? null;
    draft.deliveryReference = clean(body.deliveryReference);
    draft.receivedOn = body.receivedOn ?? null;
    draft.note = clean(body.note);
    draft.lines = body.lines.map((line) => ({
      skuId: line.skuId,
      skuCode: null,
      displayName: null,
      purchaseOrderLineId: line.purchaseOrderLineId ?? null,
      lotNumber: line.lotNumber ?? null,
      manufacturedOn: line.manufacturedOn ?? null,
      expiresOn: line.expiresOn ?? null,
      quantityAccepted: q(parseFloat(String(line.quantityAccepted ?? '0')) || 0),
      quantityRejected: q(parseFloat(String(line.quantityRejected ?? '0')) || 0),
      rejectionReason: line.rejectionReason ?? null,
      rejectionNote: line.rejectionNote ?? null,
      locationId: line.locationId ?? null,
      holdForInspection: !!line.holdForInspection,
      unitCostAmount: line.unitCostAmount ?? null,
      unitCostCurrency: line.unitCostCurrency ?? null,
      exchangeRateToBase: line.exchangeRateToBase ?? null,
    }));
    draft.version += 1;
    draft.updatedOn = nowIso();
    if (!existing) db.receiptDrafts.push(draft);
    persist();
    return HttpResponse.json({ draftId: draft.draftId, version: draft.version, branchId: draft.branchId });
  }),

  http.delete('*/api/staff/inventory/goods-receipt-drafts/:id', ({ request, params }) => {
    const denied = guard(request, ROLES.stockManage);
    if (denied) return denied;
    const draft = ownDraft(String(params.id));
    if (!draft) return notFoundResponseForDraft();
    // An already-closed draft is a success (`DiscardGoodsReceiptDraftCommandHandler`).
    closeDraft(draft.draftId, 'Discarded');
    persist();
    return new HttpResponse(null, { status: 204 });
  }),
];

export const receiptHandlers: HttpHandler[] = [
  ...draftHandlers,
  http.get('*/api/staff/inventory/goods-receipts', ({ request }) => {
    const denied = guard(request, ROLES.stockView);
    if (denied) return denied;
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const supplierId = url.searchParams.get('supplierId');
    const purchaseOrderId = url.searchParams.get('purchaseOrderId');
    const rows = db.receipts
      .filter((r) => r._branchId === branchOf(request))
      .filter((r) => !from || r.receivedOn.slice(0, 10) >= from)
      .filter((r) => !to || r.receivedOn.slice(0, 10) <= to)
      .filter((r) => !supplierId || r.supplierId === supplierId)
      .filter((r) => !purchaseOrderId || r.purchaseOrderId === purchaseOrderId)
      .sort((a, b) => b.number.localeCompare(a.number))
      .map(summary);
    return HttpResponse.json(paged(rows, request));
  }),

  http.get('*/api/staff/inventory/goods-receipts/:id', ({ request, params }) => {
    const denied = guard(request, ROLES.stockView);
    if (denied) return denied;
    const receipt = db.receipts.find(
      (r) => r.id === params.id && r._branchId === branchOf(request),
    );
    return receipt
      ? HttpResponse.json(detail(receipt, isAllowed(request, ROLES.reports)))
      : notFoundResponse();
  }),

  http.post('*/api/staff/inventory/goods-receipts', async ({ request }) => {
    const denied = guard(request, ROLES.stockManage);
    if (denied) return denied;
    const body = (await request.json()) as PostGoodsReceiptRequest;
    // BG-18: `branchId` names the branch to receive into; the caller must be assigned to it, and the order,
    // consignment and every line location are checked against THIS branch (`StaffGoodsReceiptsController.cs:44`).
    const branch = resolveBranch(request, body.branchId);
    if (branch instanceof Response) return branch;
    const branchId = branch;
    const problems = validate(body, branchId);
    if (problems.length > 0) return violations(problems);

    const po = body.purchaseOrderId
      ? db.purchaseOrders.find((p) => p.id === body.purchaseOrderId)!
      : null;
    const consignment = body.consignmentId
      ? db.consignments.find((c) => c.id === body.consignmentId)!
      : null;
    const supplier = db.suppliers.find((s) => s.id === (body.supplierId ?? po?.supplierId));
    const receiptId = newId('61');
    const number = docNumber('GRN');
    const receivedOn = nowIso();
    const batchIds: string[] = [];

    const lines: GoodsReceiptDetail['lines'] = body.lines.map((line) => {
      const sku = skuOf(line.skuId);
      const accepted = parseFloat(line.quantityAccepted || '0');
      const rejected = parseFloat(line.quantityRejected || '0');
      const poLine = po?.lines.find((l) => l.lineId === line.purchaseOrderLineId);
      const cost = poLine ? poLine.unitCost : parseFloat(line.unitCostAmount ?? '0');
      const currency = poLine ? po!.currencyCode : (line.unitCostCurrency ?? MOCK_BASE_CURRENCY);
      const rate =
        consignment?.exchangeRates.find((r) => r.currencyCode === currency)?.rateToBase ??
        line.exchangeRateToBase ??
        '1';
      let batchId: string | null = null;
      if (accepted > 0) {
        batchId = newId('c1');
        batchIds.push(batchId);
        const held = line.holdForInspection;
        const batch: MBatch = {
          id: batchId,
          branchId,
          skuId: sku.skuId,
          lotNumber: line.lotNumber.trim(),
          manufacturedOn: line.manufacturedOn,
          expiresOn: line.expiresOn,
          status: held ? 'Quarantined' : 'Available',
          statusReason: held ? 'Held for inspection' : null,
          receivedOn,
          receivedQuantity: accepted,
          goodsReceiptId: receiptId,
          goodsReceiptNumber: number,
          consignmentId: consignment?.id ?? null,
          supplierId: supplier?.id ?? null,
          originCountryCode: sku.countryOfOriginCode,
          purchaseUnitCost: cost,
          unitCostBase: currency === MOCK_BASE_CURRENCY ? cost : cost * parseFloat(rate),
          costBasis: 'purchase',
          statusHistory: held
            ? [
                {
                  from: 'Available',
                  to: 'Quarantined',
                  reason: 'Held for inspection',
                  changedOn: receivedOn,
                  changedBy: ACTOR_ID,
                },
              ]
            : [],
          recall: null,
          recallStatus: null,
          version: 1,
        };
        db.batches.push(batch);
        moveStock({
          branchId,
          kind: 'Receipt',
          batchId,
          locationId: line.locationId,
          delta: accepted,
          referenceKind: 'GoodsReceipt',
          referenceId: receiptId,
          referenceLabel: number,
        });
      }
      if (poLine) {
        poLine.acceptedQuantity += accepted;
        poLine.rejectedQuantity += rejected;
      }
      return {
        lineId: newId('b2'),
        skuId: sku.skuId,
        skuCode: sku.skuCode,
        displayName: sku.displayName,
        stockUnit: sku.stockUnit,
        lotNumber: line.lotNumber.trim(),
        manufacturedOn: line.manufacturedOn,
        expiresOn: line.expiresOn,
        quantityAccepted: q(accepted),
        quantityRejected: q(rejected),
        rejectionReason: rejected > 0 ? line.rejectionReason : null,
        rejectionNote: line.rejectionNote,
        locationId: line.locationId,
        locationCode: locationOf(line.locationId)?.code ?? null,
        holdForInspection: line.holdForInspection,
        unitCost: accepted > 0 ? { ...unitCost(cost, currency) } : null,
        batchId,
        batchStatus: batchId ? (line.holdForInspection ? 'Quarantined' : 'Available') : null,
        storage: sku.storage,
      };
    });

    db.receipts.push({
      _branchId: branchId,
      _poLines: body.lines.map((l) => l.purchaseOrderLineId),
      id: receiptId,
      number,
      branchId,
      receivedOn,
      receivedBy: ACTOR_ID,
      supplierId: supplier?.id ?? null,
      supplierName: supplier?.name ?? null,
      purchaseOrderId: po?.id ?? null,
      purchaseOrderNumber: po?.number ?? null,
      consignmentId: consignment?.id ?? null,
      consignmentReference: consignment?.reference ?? null,
      deliveryReference: body.deliveryReference,
      lines,
    });
    po?.receipts.push({ goodsReceiptId: receiptId, number, receivedOn });
    if (po) po.version += 1;
    closeDraft(body.draftId, 'Posted');
    persist();
    return HttpResponse.json(
      { goodsReceiptId: receiptId, branchId, number, batchIds },
      { status: 201 },
    );
  }),
];
