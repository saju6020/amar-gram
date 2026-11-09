import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getBatch,
  getBatches,
  getFefoPreview,
  getSkuStockMatrix,
  getStockSummary,
  quarantineBatch,
  releaseBatch,
  searchLedger,
  writeOffBatch,
  type BatchListParams,
  type FefoPurpose,
  type LedgerParams,
  type StockListParams,
} from '@/lib/api/inventory-stock';
import {
  discardReceiptDraft,
  getGoodsReceipt,
  getGoodsReceipts,
  getReceiptDraft,
  listReceiptDrafts,
  postGoodsReceipt,
  saveReceiptDraft,
  type GoodsReceiptListParams,
  type PostGoodsReceiptRequest,
  type SaveGoodsReceiptDraftRequest,
} from '@/lib/api/inventory-receipts';
import { ApiNotFoundError } from '@/lib/api/client';
import { describeApiError } from '@/lib/api/errors';
import {
  approveAdjustment,
  approveCount,
  cancelCount,
  commitCount,
  getAdjustment,
  getAdjustments,
  getCount,
  getCounts,
  getCountVariance,
  getTransfer,
  getTransfers,
  openCount,
  postTransfer,
  recordCountLines,
  rejectAdjustment,
  rejectCount,
  requestAdjustment,
  submitCount,
  withdrawAdjustment,
  type CountScope,
  type PostTransferRequest,
  type RequestAdjustmentRequest,
} from '@/lib/api/inventory-control';
import { acknowledgeAlert, getAlertSummary, getAlerts } from '@/lib/api/inventory-alerts';
import {
  getNearExpiryReport,
  getReconciliation,
  getStockOnHandReport,
  type NearExpiryParams,
  type StockOnHandParams,
} from '@/lib/api/inventory-reports';
import { noRetryOnRefusal, useInventoryQuery, useInvalidateInventory } from './useInventoryQuery';

/** HO-IMP-002 §8.2/§8.3 — receipts, stock, batches, ledger, control, alerts, reports. */

// ---- stock ----------------------------------------------------------------------------------

export function useStockSummary(params: StockListParams) {
  return useInventoryQuery('stock', ['list', params], () => getStockSummary(params));
}

/** Item id → stock unit, from the stock summary. Reports whose rows carry no unit use it, so a
 *  quantity is never shown bare (UI-8). Empty for a caller who cannot read stock. */
export function useUnitBySku(): Record<string, string> {
  const query = useStockSummary({ pageNumber: 1, pageSize: 100 });
  return useMemo(
    () => Object.fromEntries((query.data?.items ?? []).map((s) => [s.skuId, s.stockUnit])),
    [query.data],
  );
}

export function useSkuStockMatrix(skuId: string) {
  return useInventoryQuery('stock', ['matrix', skuId], () => getSkuStockMatrix(skuId), {
    enabled: !!skuId,
  });
}

export function useFefoPreview(
  params: { skuId: string; quantity: string; purpose: FefoPurpose; locationId?: string } | null,
) {
  return useInventoryQuery(
    'fefo',
    [params],
    () => getFefoPreview(params as NonNullable<typeof params>),
    { enabled: params !== null },
  );
}

export function useBatches(params: BatchListParams, enabled = true) {
  return useInventoryQuery('batches', ['list', params], () => getBatches(params), { enabled });
}

export function useBatch(id: string) {
  return useInventoryQuery('batches', ['detail', id], () => getBatch(id), { enabled: !!id });
}

export function useBatchActions(id: string) {
  const invalidate = useInvalidateInventory();
  const done = () => invalidate('batches', 'stock', 'fefo', 'recalls', 'ledger');
  return {
    quarantine: useMutation({
      mutationFn: (reason: string) => quarantineBatch(id, reason),
      onSuccess: done,
    }),
    release: useMutation({ mutationFn: () => releaseBatch(id), onSuccess: done }),
    writeOff: useMutation({
      mutationFn: (reason: string) => writeOffBatch(id, reason),
      onSuccess: done,
    }),
  };
}

export function useLedger(params: LedgerParams, enabled = true) {
  return useInventoryQuery('ledger', [params], () => searchLedger(params), { enabled });
}

// ---- receipts -------------------------------------------------------------------------------

export function useGoodsReceipts(params: GoodsReceiptListParams) {
  return useInventoryQuery('receipts', ['list', params], () => getGoodsReceipts(params));
}

export function useGoodsReceipt(id: string) {
  return useInventoryQuery('receipts', ['detail', id], () => getGoodsReceipt(id), {
    enabled: !!id,
  });
}

// ---- receipt drafts (HO-P5 BG-18, ADR-FE-190) -------------------------------------------------

/** The caller's own open drafts, newest first (`branchId` narrows to one). */
export function useReceiptDrafts(branchId?: string, enabled = true) {
  return useInventoryQuery(
    'receipt-drafts',
    ['list', branchId ?? null],
    () => listReceiptDrafts(branchId),
    { enabled },
  );
}

/** One draft in full. The form takes its first values from it ONCE, so a screen should wait for
 *  `isFetchedAfterMount` rather than build the form from a cached older copy. */
export function useReceiptDraft(draftId: string | null) {
  // NOT keyed by the active branch (unlike the other inventory reads): the server filters the detail by id and owner only
  // (StockQueryHandlers.cs:137), and a draft being worked on must not refetch, and so remount its form, on a sidebar switch.
  return useQuery({
    queryKey: ['inventory', 'receipt-drafts', 'detail', draftId],
    queryFn: () => getReceiptDraft(draftId as string),
    enabled: !!draftId,
    retry: noRetryOnRefusal,
  });
}

export function useDiscardReceiptDraft() {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (draftId: string) => discardReceiptDraft(draftId),
    onSuccess: () => invalidate('receipt-drafts'),
  });
}

/** NFR-USA-4: the draft codes in plain language (the server's own message is preferred). */
export const DRAFT_CODE_MESSAGES: Readonly<Record<string, string>> = {
  GoodsReceiptDraftLimitReached: 'You already have 20 open drafts. Post or discard one of them first.',
  InvalidGoodsReceiptDraft:
    'Something in the form is too long or out of range, so it was not saved as a draft.',
};

/** ADR-FE-190: 1.5 s after the last change, and on blur. */
export const RECEIPT_DRAFT_AUTOSAVE_MS = 1500;

export type ReceiptDraftSaveState = 'idle' | 'saving' | 'saved' | 'error' | 'closed';

/**
 * `useReceiptDraftAutosave` -- ADR-FE-190. Whole-form `PUT` to the caller's server draft:
 *  - `payload` is the form as a request, or `null` while there is nothing to save (a form nobody has
 *    touched must not create a draft). A change schedules one save after `delayMs` of quiet; `flush()`
 *    (a field blur) saves at once;
 *  - never more than one request in flight: a change made meanwhile waits, and when the request settles
 *    the NEWEST form is sent (it supersedes any older one, which is never sent);
 *  - a 404 means the draft was closed elsewhere (posted or discarded): autosaving stops for good and
 *    `state` is `'closed'`; any other failure sets `'error'` in plain language and the next change tries
 *    again (`GoodsReceiptDraftLimitReached` is a 400 on the first save of a new draft);
 *  - `hasUnsavedChanges` stays true until the newest form has been saved: that is what the
 *    unsaved-changes guard waits for (NFR-USA-5).
 * The saved time is the browser's clock when the server answered; the draft itself is the server's.
 */
export function useReceiptDraftAutosave(options: {
  draftId: string;
  payload: SaveGoodsReceiptDraftRequest | null;
  enabled?: boolean;
  delayMs?: number;
}) {
  const { draftId, payload, enabled = true, delayMs = RECEIPT_DRAFT_AUTOSAVE_MS } = options;
  const key = payload ? JSON.stringify(payload) : null;
  const [state, setState] = useState<ReceiptDraftSaveState>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  const latest = useRef<{ payload: SaveGoodsReceiptDraftRequest | null; key: string | null }>({
    payload: null,
    key: null,
  });
  const savedKeyRef = useRef<string | null>(null);
  const inFlight = useRef(false);
  const stopped = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef(delayMs);
  const inFlightSave = useRef<Promise<unknown> | null>(null);
  const draftIdRef = useRef(draftId);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    latest.current = { payload, key };
    draftIdRef.current = draftId;
    enabledRef.current = enabled;
    delayRef.current = delayMs;
  });

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const run = useCallback(async () => {
    clearTimer();
    // One request at a time: the change waits, and `run` is called again when this one settles.
    while (!inFlight.current && !stopped.current && enabledRef.current) {
      const { payload: body, key: bodyKey } = latest.current;
      if (!body || bodyKey === savedKeyRef.current) return;
      inFlight.current = true;
      setState('saving');
      let retryNow = false;
      let retryLater = false;
      try {
        const sending = saveReceiptDraft(draftIdRef.current, body);
        inFlightSave.current = sending;
        await sending;
        savedKeyRef.current = bodyKey;
        setSavedKey(bodyKey);
        setSavedAt(new Date().toISOString());
        setMessage(null);
        setState('saved');
        retryNow = latest.current.key !== bodyKey; // a newer form arrived meanwhile: send it now
      } catch (error) {
        if (error instanceof ApiNotFoundError) {
          stopped.current = true;
          setClosed(true);
          setMessage(
            'This draft was closed somewhere else, so it is no longer being saved. Nothing you typed here has been lost.',
          );
          setState('closed');
        } else {
          setMessage(describeApiError(error, DRAFT_CODE_MESSAGES));
          setState('error');
          // A change made while this request was in flight had no timer left to carry it: try it again after a pause.
          retryLater = latest.current.key !== bodyKey;
        }
      } finally {
        inFlightSave.current = null;
        inFlight.current = false;
      }
      if (retryLater && !stopped.current) timer.current = setTimeout(() => void run(), delayRef.current);
      if (!retryNow) return;
    }
  }, [clearTimer]);

  // A change: wait for a quiet moment, then save.
  useEffect(() => {
    if (!enabled || stopped.current || key === null || key === savedKeyRef.current) return;
    clearTimer();
    timer.current = setTimeout(() => void run(), delayMs);
    return clearTimer;
  }, [key, enabled, delayMs, run, clearTimer]);

  // Leaving the screen with a change not yet saved: send it (best effort). The change effect's own cleanup has
  // already cleared the timer by now, so this goes by what is unsaved, not by whether a timer is pending.
  useEffect(
    () => () => {
      const { payload: body, key: bodyKey } = latest.current;
      if (body && bodyKey !== savedKeyRef.current && !stopped.current && enabledRef.current) void run();
    },
    [run],
  );

  const stop = useCallback(() => {
    stopped.current = true;
    clearTimer();
  }, [clearTimer]);

  /** Undo `stop()` after a post or discard was refused: the draft is still open, so edits must be saved again. The change
   *  effect picks the unsaved form up on the next render. */
  const resume = useCallback(() => {
    stopped.current = false;
  }, []);

  /** Resolves once a save already in flight has settled (it may be the one that CREATES the draft), so a post or a
   *  discard goes after it and not before. Call `stop()` first so nothing new starts. */
  const settle = useCallback(async () => {
    try {
      await inFlightSave.current;
    } catch {
      // a failed save left nothing behind to wait for
    }
  }, []);

  return {
    state,
    savedAt,
    message,
    hasUnsavedChanges: enabled && !closed && key !== null && key !== savedKey,
    flush: () => void run(),
    stop,
    resume,
    settle,
  };
}

export function usePostGoodsReceipt() {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (request: PostGoodsReceiptRequest) => postGoodsReceipt(request),
    onSuccess: () =>
      invalidate(
        'receipts',
        'receipt-drafts',
        'stock',
        'batches',
        'purchase-orders',
        'consignments',
        'reorder',
        'ledger',
      ),
  });
}

// ---- transfers / adjustments / counts -------------------------------------------------------

export function useTransfers(params: { pageNumber?: number; pageSize?: number }) {
  return useInventoryQuery('transfers', ['list', params], () => getTransfers(params));
}

export function useTransfer(id: string) {
  return useInventoryQuery('transfers', ['detail', id], () => getTransfer(id), { enabled: !!id });
}

export function usePostTransfer() {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (request: PostTransferRequest) => postTransfer(request),
    onSuccess: () => invalidate('transfers', 'stock', 'batches', 'ledger'),
  });
}

export function useAdjustments(params: {
  status?: string;
  pageNumber?: number;
  pageSize?: number;
}) {
  return useInventoryQuery('adjustments', ['list', params], () => getAdjustments(params));
}

export function useAdjustment(id: string) {
  return useInventoryQuery('adjustments', ['detail', id], () => getAdjustment(id), {
    enabled: !!id,
  });
}

export function useRequestAdjustment() {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (request: RequestAdjustmentRequest) => requestAdjustment(request),
    onSuccess: () => invalidate('adjustments', 'stock', 'batches', 'ledger'),
  });
}

export function useAdjustmentActions(id: string) {
  const invalidate = useInvalidateInventory();
  const done = () => invalidate('adjustments', 'stock', 'batches', 'ledger');
  return {
    approve: useMutation({
      mutationFn: (note: string | null) => approveAdjustment(id, note),
      onSuccess: done,
    }),
    reject: useMutation({
      mutationFn: (note: string) => rejectAdjustment(id, note),
      onSuccess: done,
    }),
    withdraw: useMutation({ mutationFn: () => withdrawAdjustment(id), onSuccess: done }),
  };
}

export function useCounts(params: {
  status?: string;
  locationId?: string;
  pageNumber?: number;
  pageSize?: number;
}) {
  return useInventoryQuery('counts', ['list', params], () => getCounts(params));
}

export function useCount(id: string) {
  return useInventoryQuery('counts', ['detail', id], () => getCount(id), { enabled: !!id });
}

export function useCountVariance(id: string, enabled: boolean) {
  return useInventoryQuery('counts', ['variance', id], () => getCountVariance(id), {
    enabled: !!id && enabled,
  });
}

export function useOpenCount() {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (request: { locationId: string; scope: CountScope; skuIds: string[] }) =>
      openCount(request),
    onSuccess: () => invalidate('counts'),
  });
}

export function useCountActions(id: string) {
  const invalidate = useInvalidateInventory();
  const done = () => invalidate('counts', 'stock', 'batches', 'adjustments', 'ledger');
  return {
    recordLines: useMutation({
      mutationFn: (lines: Array<{ skuId: string; batchId: string; countedQuantity: string }>) =>
        recordCountLines(id, lines),
      // A saved line needs no refetch: the sheet shows its own per-row saved state.
    }),
    submit: useMutation({ mutationFn: () => submitCount(id), onSuccess: done }),
    commit: useMutation({ mutationFn: () => commitCount(id), onSuccess: done }),
    cancel: useMutation({ mutationFn: () => cancelCount(id), onSuccess: done }),
    approve: useMutation({ mutationFn: () => approveCount(id), onSuccess: done }),
    reject: useMutation({ mutationFn: () => rejectCount(id), onSuccess: done }),
  };
}

// ---- alerts ---------------------------------------------------------------------------------

export function useAlerts(params: {
  status?: string;
  kind?: string;
  locationId?: string;
  pageNumber?: number;
  pageSize?: number;
}) {
  return useInventoryQuery('alerts', ['list', params], () => getAlerts(params));
}

/** ADR-FE-045 — the ONLY polling query: the nav badge, every 60 s. */
export const ALERT_BADGE_POLL_MS = 60_000;

export function useAlertSummary(enabled = true) {
  // An arrow, not the function itself: react-query hands its context object to a bare `queryFn`, which would become
  // `getAlertSummary`'s `arrivalWindowDays` argument (the server answers that with a 400 `InvalidQuery`).
  return useInventoryQuery('alerts', ['summary'], () => getAlertSummary(), {
    refetchInterval: ALERT_BADGE_POLL_MS,
    enabled,
  });
}

export function useAcknowledgeAlert() {
  const invalidate = useInvalidateInventory();
  return useMutation({
    mutationFn: (args: { id: string; note: string | null }) => acknowledgeAlert(args.id, args.note),
    onSuccess: () => invalidate('alerts'),
  });
}

// ---- reports --------------------------------------------------------------------------------

export function useNearExpiryReport(params: NearExpiryParams) {
  return useInventoryQuery('reports', ['near-expiry', params], () => getNearExpiryReport(params));
}

export function useStockOnHandReport(params: StockOnHandParams) {
  return useInventoryQuery('reports', ['stock-on-hand', params], () =>
    getStockOnHandReport(params),
  );
}

export function useReconciliation() {
  return useInventoryQuery('reports', ['reconciliation'], getReconciliation);
}
