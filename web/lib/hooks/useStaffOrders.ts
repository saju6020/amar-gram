'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { ApiForbiddenError, ApiNotFoundError } from '@/lib/api/client';
import {
  approveHeldPayment,
  cancelStaffOrder,
  confirmBankTransfer,
  createRider,
  dispatchOrder,
  getPackingSlip,
  getPickList,
  getStaffOrder,
  getStaffOrderStatusCounts,
  listAwaitingPayment,
  listDispatchCouriers,
  listReconciliationIssues,
  listRiders,
  listStaffCustomerOrders,
  listStaffOrders,
  markPacked,
  markReadyForCollection,
  reallocateLine,
  recordDelivery,
  recordDeliveryFailure,
  recordTracking,
  rejectHeldPayment,
  setLinePicked,
  resolveReconciliationIssue,
  startPacking,
  updateRider,
  type ConfirmTransferInput,
  type DeliveryFailureReason,
  type DispatchTarget,
  type RecordDeliveryInput,
  type RiderInput,
  type StaffOrderCountFilters,
  type StaffOrderDetail,
  type StaffOrderFilters,
} from '@/lib/api/staff-orders';
import { useBranchScope } from './useBranchScope';

/**
 * `lib/hooks/useStaffOrders.ts` — HO-ORD-002 §8.3, UI-5. The staff order screens' reads and writes.
 * Keys carry the active branch (a switch refetches). The queue, the awaiting-payment list and the
 * order detail refetch every 30 s; because the refetch only changes cached data, an open dialog or
 * form keeps what its owner typed (ADR-FE-027). A `403`/`404` is never retried.
 */
export const STAFF_ORDER_POLL_MS = 30_000;

function noRetryOnRefusal(failureCount: number, error: unknown) {
  if (error instanceof ApiForbiddenError || error instanceof ApiNotFoundError) return false;
  return failureCount < 1;
}

const POLL = { refetchInterval: STAFF_ORDER_POLL_MS, refetchIntervalInBackground: false } as const;

export function useStaffOrderQueue(filters: StaffOrderFilters) {
  const { branchId, ready } = useBranchScope();
  return useQuery({
    queryKey: ['staff', 'orders', branchId, filters],
    queryFn: () => listStaffOrders(filters),
    enabled: ready,
    placeholderData: keepPreviousData,
    retry: noRetryOnRefusal,
    ...POLL,
  });
}

/**
 * HO-P5 BG-2: the count in every status under the queue's filters bar `status`. It shares the queue's 30 s
 * refetch (UI-5) and its key prefix, so every order write refreshes it with the list.
 */
export function useStaffOrderStatusCounts(filters: StaffOrderCountFilters) {
  const { branchId, ready } = useBranchScope();
  return useQuery({
    queryKey: ['staff', 'orders', 'status-counts', branchId, filters],
    queryFn: () => getStaffOrderStatusCounts(filters),
    enabled: ready,
    placeholderData: keepPreviousData,
    retry: noRetryOnRefusal,
    ...POLL,
  });
}

/** HO-P5 BG-5: the branch's riders. `activeOnly` is what a dispatch chooses from; the registry page lists all. */
export function useRiders(activeOnly: boolean, enabled = true) {
  const { branchId, ready } = useBranchScope();
  return useQuery({
    queryKey: ['staff', 'riders', branchId, activeOnly],
    queryFn: () => listRiders(activeOnly),
    enabled: ready && enabled,
    retry: noRetryOnRefusal,
  });
}

/** HO-ORD-002 §11.14: the customer page's Orders panel. Keyed by branch (the endpoint is active-branch scoped). */
export function useStaffCustomerOrders(customerId: string, pageNumber: number, pageSize: number) {
  const { branchId, ready } = useBranchScope();
  return useQuery({
    queryKey: ['staff', 'orders', 'customer', branchId, customerId, pageNumber, pageSize],
    queryFn: () => listStaffCustomerOrders(customerId, { pageNumber, pageSize }),
    enabled: ready && !!customerId,
    placeholderData: keepPreviousData,
    retry: noRetryOnRefusal,
  });
}

export function useStaffOrder(orderId: string) {
  const { branchId, ready } = useBranchScope();
  return useQuery({
    queryKey: ['staff', 'order', branchId, orderId],
    queryFn: () => getStaffOrder(orderId),
    enabled: ready && !!orderId,
    retry: noRetryOnRefusal,
    ...POLL,
  });
}

export function useAwaitingPayment() {
  const { branchId, ready } = useBranchScope();
  return useQuery({
    queryKey: ['staff', 'awaiting-payment', branchId],
    queryFn: listAwaitingPayment,
    enabled: ready,
    retry: noRetryOnRefusal,
    ...POLL,
  });
}

export function useDispatchCouriers(enabled = true) {
  return useQuery({
    queryKey: ['staff', 'dispatch-couriers'],
    queryFn: listDispatchCouriers,
    enabled,
    staleTime: 5 * 60_000,
    retry: noRetryOnRefusal,
  });
}

export function usePickList(orderIds: string[] | undefined, enabled = true) {
  const { branchId, ready } = useBranchScope();
  return useQuery({
    queryKey: ['staff', 'pick-list', branchId, orderIds ?? 'all'],
    queryFn: () => getPickList(orderIds),
    enabled: ready && enabled,
    retry: noRetryOnRefusal,
  });
}

export function usePackingSlip(orderId: string) {
  const { branchId, ready } = useBranchScope();
  return useQuery({
    queryKey: ['staff', 'packing-slip', branchId, orderId],
    queryFn: () => getPackingSlip(orderId),
    enabled: ready && !!orderId,
    retry: noRetryOnRefusal,
  });
}

export function useReconciliationIssues(filters: {
  status?: string;
  pageNumber?: number;
  pageSize?: number;
}) {
  const { branchId, ready } = useBranchScope();
  return useQuery({
    queryKey: ['staff', 'reconciliation-issues', branchId, filters],
    queryFn: () => listReconciliationIssues(filters),
    enabled: ready,
    placeholderData: keepPreviousData,
    retry: noRetryOnRefusal,
  });
}

/** After any order write: the queue, the awaiting list, this order, the refunds list, the pick list. */
function refreshOrders(queryClient: QueryClient, orderId?: string) {
  void queryClient.invalidateQueries({ queryKey: ['staff', 'orders'] });
  void queryClient.invalidateQueries({ queryKey: ['staff', 'awaiting-payment'] });
  void queryClient.invalidateQueries({ queryKey: ['staff', 'refunds-due'] });
  void queryClient.invalidateQueries({ queryKey: ['staff', 'pick-list'] });
  void queryClient.invalidateQueries({
    queryKey: ['staff', 'order'],
    predicate: (query) => !orderId || query.queryKey[3] === orderId,
  });
}

export function useConfirmBankTransfer(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { request: ConfirmTransferInput; idempotencyKey: string }) =>
      confirmBankTransfer(orderId, input.request, input.idempotencyKey),
    retry: false,
    onSuccess: () => refreshOrders(queryClient, orderId),
  });
}

export function useApproveHeldPayment(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { expectedVersion: number; idempotencyKey: string }) =>
      approveHeldPayment(orderId, input.expectedVersion, input.idempotencyKey),
    retry: false,
    onSuccess: () => refreshOrders(queryClient, orderId),
  });
}

export function useRejectHeldPayment(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => rejectHeldPayment(orderId, note),
    retry: false,
    onSuccess: () => refreshOrders(queryClient, orderId),
  });
}

export function useCancelStaffOrder(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => cancelStaffOrder(orderId, note),
    onSuccess: () => refreshOrders(queryClient, orderId),
  });
}

/** Start packing / ready for collection — one request per order (the pick list's bulk action loops). */
export function useStartPacking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => startPacking(orderId),
    onSuccess: (_result, orderId) => refreshOrders(queryClient, orderId),
  });
}

export function useMarkReadyForCollection(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markReadyForCollection(orderId),
    onSuccess: () => refreshOrders(queryClient, orderId),
  });
}

/** HO-P5 BG-4: `Packing -> Packed`, optional. */
export function useMarkPacked(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markPacked(orderId),
    onSuccess: () => refreshOrders(queryClient, orderId),
  });
}

/**
 * HO-P5 BG-4 (8.4): the pick-list tick is server state. The tick shows at once (the cached order is updated),
 * a refusal puts it back (`InvalidOrderTransition` once the order has left the shelf), and the order refetches
 * when the request settles, so the tick survives a reload and another device sees it.
 */
export function useSetLinePicked(orderId: string) {
  const queryClient = useQueryClient();
  const { branchId } = useBranchScope();
  const key = ['staff', 'order', branchId, orderId] as const;
  return useMutation({
    mutationFn: (input: { lineId: string; picked: boolean }) => setLinePicked(orderId, input.lineId, input.picked),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<StaffOrderDetail>(key);
      if (previous) {
        queryClient.setQueryData<StaffOrderDetail>(key, {
          ...previous,
          lines: previous.lines.map((line) => (line.lineId === input.lineId ? { ...line, picked: input.picked } : line)),
        });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** Exactly one target: a courier (tracking optional) or an in-house rider (no tracking). */
export function useDispatchOrder(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { target: DispatchTarget; trackingNumber?: string }) =>
      dispatchOrder(orderId, input.target, input.trackingNumber),
    onSuccess: () => refreshOrders(queryClient, orderId),
  });
}

export function useCreateRider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RiderInput) => createRider(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff', 'riders'] }),
  });
}

export function useUpdateRider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { riderId: string; rider: RiderInput }) => updateRider(input.riderId, input.rider),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff', 'riders'] }),
  });
}

export function useRecordTracking(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trackingNumber: string) => recordTracking(orderId, trackingNumber),
    onSuccess: () => refreshOrders(queryClient, orderId),
  });
}

export function useRecordDelivery(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { request: RecordDeliveryInput; idempotencyKey: string }) =>
      recordDelivery(orderId, input.request, input.idempotencyKey),
    retry: false,
    onSuccess: () => refreshOrders(queryClient, orderId),
  });
}

export function useRecordDeliveryFailure(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: DeliveryFailureReason; note?: string }) =>
      recordDeliveryFailure(orderId, input),
    onSuccess: () => {
      refreshOrders(queryClient, orderId);
      void queryClient.invalidateQueries({ queryKey: ['staff', 'returns'] });
    },
  });
}

export function useReallocateLine(orderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { lineId: string; targetBatchId: string; reason: string }) =>
      reallocateLine(orderId, input.lineId, {
        targetBatchId: input.targetBatchId,
        reason: input.reason,
      }),
    onSuccess: () => refreshOrders(queryClient, orderId),
  });
}

export function useResolveReconciliationIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { issueId: string; note: string }) =>
      resolveReconciliationIssue(input.issueId, input.note),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['staff', 'reconciliation-issues'] }),
  });
}
