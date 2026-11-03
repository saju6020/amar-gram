/**
 * `lib/drafts/receipt-draft.ts` — the goods-receipt form's line and draft shapes. The `sessionStorage`
 * draft this file used to keep (HO-IMP-002 §8.3, ADR-FE-043) is gone: drafts are saved on the server
 * (ADR-FE-190, HO-P5 Amended (an)), and only these types are still imported.
 */
export interface ReceiptDraftLine {
  key: string;
  skuId: string;
  skuLabel: string;
  stockUnit: string;
  allowsFractional: boolean;
  expiryRequired: boolean;
  storageLabel: string | null;
  purchaseOrderLineId: string;
  lotNumber: string;
  manufacturedOn: string;
  expiresOn: string;
  quantityAccepted: string;
  quantityRejected: string;
  rejectionReason: string;
  rejectionNote: string;
  locationId: string;
  holdForInspection: boolean;
  unitCostAmount: string;
  unitCostCurrency: string;
  exchangeRateToBase: string;
  costFromPurchaseOrder: boolean;
}

export interface ReceiptDraft {
  source: 'direct' | 'purchase-order' | 'consignment';
  purchaseOrderId: string;
  consignmentId: string;
  deliveryReference: string;
  lines: ReceiptDraftLine[];
  savedAt: string;
}
