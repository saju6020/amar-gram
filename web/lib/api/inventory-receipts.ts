import { apiFetch } from './client';
import { buildQuery, type Storage } from './inventory-lookup';
import type { PagedResult } from './types';
import type { Money } from '@/lib/format/money';

/**
 * `lib/api/inventory-receipts.ts` — HO-IMP-002 §8.2, US-IMP-04. `StaffGoodsReceiptsController`.
 * A receipt is posted in ONE command and is immutable afterwards. A `400` carries EVERY line
 * violation, named `Lines[i].Field`.
 */

export interface GoodsReceiptSummary {
  id: string;
  number: string;
  receivedOn: string;
  supplierId: string | null;
  supplierName: string | null;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  consignmentId: string | null;
  deliveryReference: string | null;
  lineCount: number;
  batchCount: number;
  receivedBy: string;
}

export interface GoodsReceiptLine {
  lineId: string;
  skuId: string;
  skuCode: string;
  displayName: string;
  stockUnit: string;
  lotNumber: string;
  manufacturedOn: string | null;
  expiresOn: string | null;
  quantityAccepted: string;
  quantityRejected: string;
  rejectionReason: string | null;
  rejectionNote: string | null;
  locationId: string;
  locationCode: string | null;
  holdForInspection: boolean;
  /** `null` for a caller without `InventoryReports.View`. */
  unitCost: Money | null;
  batchId: string | null;
  batchStatus: string | null;
  storage: Storage | null;
}

export interface GoodsReceiptDetail {
  id: string;
  number: string;
  branchId: string;
  receivedOn: string;
  receivedBy: string;
  supplierId: string | null;
  supplierName: string | null;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  consignmentId: string | null;
  consignmentReference: string | null;
  deliveryReference: string | null;
  lines: GoodsReceiptLine[];
}

export interface GoodsReceiptListParams {
  from?: string;
  to?: string;
  supplierId?: string;
  purchaseOrderId?: string;
  pageNumber?: number;
  pageSize?: number;
}

export async function getGoodsReceipts(
  params: GoodsReceiptListParams,
): Promise<PagedResult<GoodsReceiptSummary>> {
  return apiFetch(`/api/staff/inventory/goods-receipts${buildQuery({ ...params })}`);
}

export async function getGoodsReceipt(id: string): Promise<GoodsReceiptDetail> {
  return apiFetch(`/api/staff/inventory/goods-receipts/${encodeURIComponent(id)}`);
}

export interface PostGoodsReceiptLine {
  skuId: string;
  purchaseOrderLineId: string | null;
  lotNumber: string;
  manufacturedOn: string | null;
  expiresOn: string | null;
  quantityAccepted: string;
  quantityRejected: string;
  rejectionReason: string | null;
  rejectionNote: string | null;
  locationId: string;
  holdForInspection: boolean;
  unitCostAmount: string | null;
  unitCostCurrency: string | null;
  exchangeRateToBase: string | null;
}

export interface PostGoodsReceiptRequest {
  /** HO-P5 BG-18 -- the branch to receive into when it is not the active one; the caller must be assigned to it
   *  (403 `BranchNotAssigned`), and the order, consignment and line locations are checked against THIS branch
   *  (`Api/Contracts/Inventory/StockRequests.cs:27-34`). */
  branchId?: string | null;
  /** HO-P5 BG-18 -- the caller's own draft this receipt was filled in from; closed once posted. */
  draftId?: string | null;
  supplierId: string | null;
  purchaseOrderId: string | null;
  consignmentId: string | null;
  deliveryReference: string | null;
  lines: PostGoodsReceiptLine[];
}

export async function postGoodsReceipt(
  request: PostGoodsReceiptRequest,
): Promise<{ goodsReceiptId: string; branchId?: string; number: string; batchIds: string[] }> {
  return apiFetch('/api/staff/inventory/goods-receipts', { method: 'POST', body: request });
}

// ---- HO-P5 BG-18: server-side receipt drafts (autosave) ---------------------------------------
// `StaffGoodsReceiptDraftsController.cs:14-82`. A draft is the CALLER'S OWN workspace: another staff member's
// draft answers 404 exactly like an unknown id, and a closed (posted or discarded) draft answers 404 on save.

/** One row of the caller's draft list (`Read/ViewModels/InventoryStockViewModels.cs:32-35`). */
export interface GoodsReceiptDraftSummary {
  draftId: string;
  branchId: string;
  branchName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  purchaseOrderId: string | null;
  consignmentId: string | null;
  deliveryReference: string | null;
  lineCount: number;
  version: number;
  /** When it was last autosaved (an instant). */
  updatedOn: string;
}

/** `Read/ViewModels/InventoryStockViewModels.cs:37-39`. Quantities and costs are strings. */
export interface GoodsReceiptDraftLine {
  skuId: string;
  skuCode: string | null;
  displayName: string | null;
  purchaseOrderLineId: string | null;
  lotNumber: string | null;
  manufacturedOn: string | null;
  expiresOn: string | null;
  quantityAccepted: string;
  quantityRejected: string;
  rejectionReason: string | null;
  rejectionNote: string | null;
  locationId: string | null;
  holdForInspection: boolean;
  unitCostAmount: string | null;
  unitCostCurrency: string | null;
  exchangeRateToBase: string | null;
}

/** `Read/ViewModels/InventoryStockViewModels.cs:41-45`: a draft in full, lines in the order typed. */
export interface GoodsReceiptDraft {
  draftId: string;
  branchId: string;
  branchName: string | null;
  supplierId: string | null;
  purchaseOrderId: string | null;
  consignmentId: string | null;
  deliveryReference: string | null;
  receivedOn: string | null;
  note: string | null;
  version: number;
  updatedOn: string;
  lines: GoodsReceiptDraftLine[];
}

/** The body of the whole-form `PUT` (`StockRequests.cs:47-81`). */
export interface SaveGoodsReceiptDraftRequest {
  branchId?: string | null;
  supplierId: string | null;
  purchaseOrderId: string | null;
  consignmentId: string | null;
  deliveryReference: string | null;
  receivedOn?: string | null;
  note?: string | null;
  lines: Array<{
    skuId: string;
    purchaseOrderLineId: string | null;
    lotNumber: string | null;
    manufacturedOn: string | null;
    expiresOn: string | null;
    quantityAccepted: string;
    quantityRejected: string;
    rejectionReason: string | null;
    rejectionNote: string | null;
    locationId: string | null;
    holdForInspection: boolean;
    unitCostAmount: string | null;
    unitCostCurrency: string | null;
    exchangeRateToBase: string | null;
  }>;
}

/** 200 `{ draftId, version, branchId }` (`StaffGoodsReceiptDraftsController.cs:64-65`). */
export interface SavedGoodsReceiptDraft {
  draftId: string;
  version: number;
  branchId: string;
}

const draftsPath = '/api/staff/inventory/goods-receipt-drafts';

/** The caller's open drafts, newest first, across their branches; `branchId` narrows to one. */
export async function listReceiptDrafts(branchId?: string): Promise<GoodsReceiptDraftSummary[]> {
  return apiFetch(`${draftsPath}${buildQuery({ branchId })}`);
}

export async function getReceiptDraft(draftId: string): Promise<GoodsReceiptDraft> {
  return apiFetch(`${draftsPath}/${encodeURIComponent(draftId)}`);
}

/** Creates the draft with this client-minted id, or replaces its content. */
export async function saveReceiptDraft(
  draftId: string,
  request: SaveGoodsReceiptDraftRequest,
): Promise<SavedGoodsReceiptDraft> {
  return apiFetch(`${draftsPath}/${encodeURIComponent(draftId)}`, { method: 'PUT', body: request });
}

/** 204; unknown or another member's draft is a 404, an already-closed one a success. */
export async function discardReceiptDraft(draftId: string): Promise<void> {
  return apiFetch(`${draftsPath}/${encodeURIComponent(draftId)}`, { method: 'DELETE' });
}
