'use client';

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { ApiForbiddenError, ApiNotFoundError } from '@/lib/api/client';
import { findCustomers } from '@/lib/api/staff-customers';
import {
  browsePosSkus,
  completeCounterSale,
  getCounterQuote,
  getReceipt,
  lookupPosSku,
  POS_BROWSE_PAGE_SIZE,
  searchPosSkus,
  type CounterQuoteInput,
  type CounterSaleInput,
} from '@/lib/api/pos';
import { useBranchScope } from './useBranchScope';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * `lib/hooks/usePos.ts` — HO-ORD-002 §8.3, ADR-FE-095. The point of sale. The counter quote is the
 * server's, debounced 300 ms; the basket itself is component state in `/staff/pos` and never storage.
 */
export const POS_QUOTE_DEBOUNCE_MS = 300;

function noRetryOnRefusal(failureCount: number, error: unknown) {
  if (error instanceof ApiForbiddenError || error instanceof ApiNotFoundError) return false;
  return failureCount < 1;
}

export function usePosBarcodeLookup() {
  return useMutation({ mutationFn: (barcode: string) => lookupPosSku(barcode), retry: false });
}

export function usePosSkuSearch(text: string) {
  const { branchId, ready } = useBranchScope();
  const settled = useDebouncedValue(text.trim(), 300);
  return useQuery({
    queryKey: ['pos', 'sku-search', branchId, settled],
    queryFn: () => searchPosSkus(settled),
    enabled: ready && settled.length >= 2,
    placeholderData: keepPreviousData,
    retry: noRetryOnRefusal,
  });
}

/** HO-P5 ADR-FE-191: the tendered cash is debounced a little longer than the basket, so typing a number sends one quote. */
export const POS_TENDER_DEBOUNCE_MS = 400;

/**
 * The counter quote. The basket part is debounced 300 ms; `tenderedCash` (kept in component state, never
 * storage) 400 ms, and it asks the server for `changeDue` / `cashShort` (HO-P5 BG-7).
 */
export function useCounterQuote(input: CounterQuoteInput) {
  const { branchId, ready } = useBranchScope();
  const { tenderedCash, ...basket } = input;
  const serialized = JSON.stringify(basket);
  const settledBasket = useDebouncedValue(serialized, POS_QUOTE_DEBOUNCE_MS);
  const settledTender = useDebouncedValue(tenderedCash ?? '', POS_TENDER_DEBOUNCE_MS);
  const settledInput: CounterQuoteInput = {
    ...(JSON.parse(settledBasket) as Omit<CounterQuoteInput, 'tenderedCash'>),
    tenderedCash: settledTender || undefined,
  };
  const query = useQuery({
    queryKey: ['pos', 'quote', branchId, settledInput],
    queryFn: () => getCounterQuote(settledInput),
    enabled: ready && settledInput.lines.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    retry: noRetryOnRefusal,
  });
  return { ...query, isSettling: serialized !== settledBasket || (tenderedCash ?? '') !== settledTender };
}

/**
 * HO-P5 BG-6: the counter grid, paged ("Show more" asks for the next page). `category` is a `ProductCategory`
 * name or empty for all. The next page is decided by the server's `totalCount`, because a page can be a row or
 * two short of `pageSize` (a bundle whose component is not sellable is dropped from its page).
 */
export function usePosBrowse(category: string, enabled = true) {
  const { branchId, ready } = useBranchScope();
  return useInfiniteQuery({
    queryKey: ['pos', 'browse', branchId, category],
    queryFn: ({ pageParam }) =>
      browsePosSkus({ category: category || undefined, pageNumber: pageParam, pageSize: POS_BROWSE_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.pageNumber * last.pageSize < last.totalCount ? last.pageNumber + 1 : undefined),
    enabled: ready && enabled,
    retry: noRetryOnRefusal,
  });
}

export function useCompleteCounterSale() {
  return useMutation({
    mutationFn: (input: { sale: CounterSaleInput; idempotencyKey: string }) =>
      completeCounterSale(input.sale, input.idempotencyKey),
    retry: false,
  });
}

export function useReceipt(orderId: string) {
  const { branchId, ready } = useBranchScope();
  return useQuery({
    queryKey: ['pos', 'receipt', branchId, orderId],
    queryFn: () => getReceipt(orderId),
    enabled: ready && !!orderId,
    retry: noRetryOnRefusal,
  });
}

/** "Find an existing customer" by mobile number — runs only when the cashier asks. */
export function usePosCustomerLookup() {
  return useMutation({ mutationFn: (mobile: string) => findCustomers({ mobile: mobile.trim() }), retry: false });
}
