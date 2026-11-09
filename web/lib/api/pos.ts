import { apiFetch, ApiNotFoundError } from './client';
import type { Money } from '../format/money';
import { wireMoney } from '../money';
import type { CheckoutChange, ExcludedLine, OrderTotals, QuoteDiscount, QuoteLine } from './checkout';
import type { PagedResult } from './types';

/**
 * `lib/api/pos.ts` — HO-ORD-002 §8.2. The point of sale, as `StaffPosController` / `PosViewModels.cs`
 * send them. The counter quote, the change due and the receipt are the server's; the browser never
 * totals a basket or works out change (ADR-FE-092).
 *
 * Differences from the handover's §12.4 table (recorded in HO-ORD-002 §1 Amended): the search route is
 * `GET /api/staff/pos/skus?q`, the lookup returns the FLAT `PosSku` (with `sellable` and
 * `fefoBatches[]`), the sale needs `customerName` + `customerMobile` (ADR-216) and returns the grand
 * total as well, and the quote carries no change.
 */

export interface PosFefoBatch {
  batchId: string;
  lotNumber: string;
  expiresOn: string | null;
  locationId: string;
  quantity: string;
}

export interface PosSku {
  skuId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  barcode: string | null;
  unitPrice: Money | null;
  sellable: number;
  isBundle: boolean;
  fefoBatches: PosFefoBatch[];
}

/** `null` for an unknown barcode (`404`). */
export async function lookupPosSku(barcode: string): Promise<PosSku | null> {
  try {
    return await apiFetch<PosSku>(`/api/staff/pos/sku?barcode=${encodeURIComponent(barcode)}`);
  } catch (error) {
    if (error instanceof ApiNotFoundError) return null;
    throw error;
  }
}

export function searchPosSkus(text: string): Promise<PosSku[]> {
  return apiFetch(`/api/staff/pos/skus?q=${encodeURIComponent(text)}`);
}

/** The counter grid is paged 20 by default, 100 at most. Read/QueryHandlers/Order/OrderQueryHandlers.cs:20 */
export const POS_BROWSE_PAGE_SIZE = 20;

/**
 * HO-P5 BG-6: `GET /api/staff/pos/browse?category=&pageNumber=&pageSize=` -- sellable SKUs by name, optionally
 * within one `ProductCategory` name. Same row shape as the search; `fefoBatches` is empty here.
 * // Api/Controllers/StaffPosController.cs:50-52; Read/Queries/Order/PosQueries.cs:22-24
 */
export function browsePosSkus(params: {
  category?: string;
  pageNumber: number;
  pageSize: number;
}): Promise<PagedResult<PosSku>> {
  const search = new URLSearchParams();
  if (params.category) search.set('category', params.category);
  search.set('pageNumber', String(params.pageNumber));
  search.set('pageSize', String(params.pageSize));
  return apiFetch(`/api/staff/pos/browse?${search.toString()}`);
}

export interface PosLineInput {
  skuId: string;
  quantity: number;
}

export interface CounterQuote {
  lines: QuoteLine[];
  excludedLines: ExcludedLine[];
  changes: CheckoutChange[];
  discount: QuoteDiscount | null;
  totals: OrderTotals;
  canSell: boolean;
  blockingReasons: string[];
  currencyCode: string;
  /**
   * HO-P5 BG-7: with a `tenderedCash` and a sale that can be made, exactly one of these is set (`changeDue`
   * when the cash covers the total, zero when exact; `cashShort` when it does not). Both are absent without
   * a tender. The server's answer, never worked out here.
   * // Read/ViewModels/PosViewModels.cs:12-17
   */
  changeDue?: Money | null;
  cashShort?: Money | null;
}

export interface CounterQuoteInput {
  customerId?: string;
  lines: PosLineInput[];
  discountCode?: string;
  /** A typed amount (`"1000"` or `"1000.00"`), sent as a JSON number through `wireMoney`. Above zero, at most two decimals. */
  tenderedCash?: string; // Api/Contracts/Order/PosRequests.cs:24
}

export function getCounterQuote(input: CounterQuoteInput): Promise<CounterQuote> {
  return apiFetch('/api/staff/pos/quote', {
    method: 'POST',
    body: {
      ...input,
      discountCode: input.discountCode || undefined,
      tenderedCash: input.tenderedCash ? wireMoney(input.tenderedCash) : undefined,
    },
  });
}

export type TenderMethod = 'Cash' | 'InStoreCard';

export interface TenderInput {
  method: TenderMethod;
  /** Cash: the money handed over. Card: the amount charged on the terminal. A typed string. */
  amount: string;
  /** The terminal slip number for a card tender — never a card number. */
  reference?: string;
}

export interface CounterSaleInput {
  /** Both or neither; neither is an anonymous walk-in sale (HO-P5 BG-8). Api/Contracts/Order/PosRequests.cs:31-33 */
  customerName?: string;
  customerMobile?: string;
  lines: PosLineInput[];
  discountCode?: string;
  tenders: TenderInput[];
}

export interface CounterSale {
  orderId: string;
  orderNumber: string;
  invoiceNumber: string;
  grandTotal: Money;
  changeDue: Money;
}

export function completeCounterSale(
  input: CounterSaleInput,
  idempotencyKey: string,
): Promise<CounterSale> {
  return apiFetch('/api/staff/pos/sales', {
    method: 'POST',
    body: {
      customerName: input.customerName || undefined,
      customerMobile: input.customerMobile || undefined,
      lines: input.lines,
      discountCode: input.discountCode || undefined,
      tenders: input.tenders.map((tender) => ({ ...tender, amount: wireMoney(tender.amount) })),
    },
    idempotencyKey,
  });
}

export interface ReceiptLine {
  description: string;
  quantity: number;
  unitPrice: Money;
  lineDiscount: Money;
  taxRatePercent: number;
  taxAmount: Money;
  lineTotal: Money;
}

export interface Receipt {
  orderId: string;
  orderNumber: string;
  invoiceNumber: string;
  branchName: string;
  branchAddress: string | null;
  branchPhone: string | null;
  legalName: string | null;
  taxRegistrationNumber: string | null;
  soldOn: string;
  soldOnLocal: string;
  branchTimeZoneId: string;
  cashier: string;
  customerName: string | null;
  lines: ReceiptLine[];
  totals: OrderTotals;
  tenders: Array<{ method: string; amount: Money }>;
  changeDue: Money;
  /** The same receipt laid out in 48 columns for an 80 mm printer. */
  text: string;
}

export function getReceipt(orderId: string): Promise<Receipt> {
  return apiFetch(`/api/staff/pos/sales/${encodeURIComponent(orderId)}/receipt`);
}
