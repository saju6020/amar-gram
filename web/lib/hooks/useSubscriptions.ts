'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiForbiddenError, ApiNotFoundError } from '@/lib/api/client';
import { getPublicBranches } from '@/lib/api/admin-branches';
import {
  cancelSubscription,
  changeSubscriptionTerms,
  createSubscription,
  getMySubscription,
  getMySubscriptionCycles,
  getSubscriptionOptions,
  getSubscriptionPaymentMethods,
  listMySubscriptions,
  pauseSubscription,
  resumeSubscription,
  skipSubscriptionDelivery,
  withdrawPendingSubscriptionChanges,
  type CancelSubscriptionInput,
  type ChangeSubscriptionTermsInput,
  type CreateSubscriptionInput,
  type CustomerSubscriptionDetail,
  type SubscriptionChangeResult,
  type SubscriptionFulfilment,
  type SubscriptionView,
} from '@/lib/api/subscriptions';
import {
  SUBSCRIPTION_OPTIONS_STALE_MS,
  SUBSCRIPTION_QUANTITY_DEBOUNCE_MS,
  subscriptionKeys,
} from '@/lib/subscriptions/keys';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * `lib/hooks/useSubscriptions.ts` — HO-P6 S1 (§8.3, §11.2.1, ADR-FE-194). The customer's subscription queries
 * and mutations over `lib/api/subscriptions.ts`, with the keys of `lib/subscriptions/keys.ts`. No polling
 * (UI-5): every action re-evaluates the lock on the server and answers with the real outcome.
 *
 * Cache rule (ADR-FE-194): a change result's `subscription` replaces the `subscription` part of the detail cache
 * (its `cycles` are kept); the list, the cycles and the options are then invalidated. Create (201) seeds the
 * detail with `cycles: []` and invalidates the list. A refused action re-reads the detail, so a stale screen
 * (409, a skip that is no longer possible) shows the latest.
 */

/** A refusal (404, 403) is the answer; it is not retried. */
function noRetryOnRefusal(failureCount: number, error: unknown) {
  if (error instanceof ApiForbiddenError || error instanceof ApiNotFoundError) return false;
  return failureCount < 1;
}

// ---- reads ------------------------------------------------------------------------------------------------

/** C1. Read after the page renders and only when `enabled` (a signed-in customer). */
export function useSubscriptionOptions(skuId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: subscriptionKeys.options(skuId ?? ''),
    queryFn: () => getSubscriptionOptions(skuId!),
    enabled: enabled && !!skuId,
    staleTime: SUBSCRIPTION_OPTIONS_STALE_MS,
    retry: noRetryOnRefusal,
  });
}

export interface PaymentMethodsInput {
  skuId: string;
  quantity: number;
  fulfilment: SubscriptionFulfilment;
  /** The chosen address (Delivery) or outlet (Pickup); nothing is requested until one is chosen. */
  addressOrBranchId: string | null;
}

/** C2, for the chosen address or outlet. The quantity is debounced (300 ms) before it re-requests. */
export function useSubscriptionPaymentMethods(input: PaymentMethodsInput) {
  const quantity = useDebouncedValue(input.quantity, SUBSCRIPTION_QUANTITY_DEBOUNCE_MS);
  const { skuId, fulfilment, addressOrBranchId } = input;
  return useQuery({
    queryKey: subscriptionKeys.paymentMethods(skuId, quantity, fulfilment, addressOrBranchId),
    queryFn: () =>
      getSubscriptionPaymentMethods({
        skuId,
        quantity,
        ...(fulfilment === 'Delivery'
          ? { deliveryAddressId: addressOrBranchId! }
          : { pickupBranchId: addressOrBranchId! }),
      }),
    enabled: !!skuId && !!addressOrBranchId,
    retry: noRetryOnRefusal,
  });
}

/** Re-reads every payment-methods list (after `PaymentMethodUnavailable`, Orders' answer has changed). */
export function useRefreshPaymentMethods() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: [...subscriptionKeys.all, 'payment-methods'] });
}

/** C3, one tab and one page. */
export function useMySubscriptions(status: 'live' | 'cancelled', page: number, pageSize = 10) {
  return useQuery({
    queryKey: [...subscriptionKeys.list(status, page), pageSize],
    queryFn: () => listMySubscriptions({ status, pageNumber: page, pageSize }),
    placeholderData: keepPreviousData,
    retry: noRetryOnRefusal,
  });
}

/** C3 for the overview card: the soonest live subscription (the server's order puts it first). Decoration: a failure hides it. */
export function useNextSubscription() {
  return useQuery({
    queryKey: [...subscriptionKeys.list('live', 1), 'next'],
    queryFn: () => listMySubscriptions({ status: 'live', pageNumber: 1, pageSize: 1 }),
    retry: false,
  });
}

/** C4. Never trust a cached copy: a subscription moves on without the customer (a cycle runs, staff act). */
export function useMySubscription(id: string) {
  return useQuery({
    queryKey: subscriptionKeys.detail(id),
    queryFn: () => getMySubscription(id),
    enabled: !!id,
    staleTime: 0,
    retry: noRetryOnRefusal,
  });
}

/** C5, one page. `enabled` is false until the customer asks for more than the 12 the detail carries. */
export function useMySubscriptionCycles(id: string, page: number, enabled = true) {
  return useQuery({
    queryKey: subscriptionKeys.cycles(id, page),
    queryFn: () => getMySubscriptionCycles(id, { pageNumber: page, pageSize: 12 }),
    enabled: enabled && !!id,
    retry: noRetryOnRefusal,
  });
}

/** P4: the active outlets, for "collect from" and the suspension banner's phone numbers. Shares the `['public','branches']` key. */
export function useOutletContacts() {
  return useQuery({
    queryKey: ['public', 'branches'],
    queryFn: getPublicBranches,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

// ---- writes -----------------------------------------------------------------------------------------------

/** Replaces the detail's `subscription` part (keeping its cycles) and invalidates the rest (ADR-FE-194). */
function useApplyChange(id: string) {
  const queryClient = useQueryClient();
  return (result: SubscriptionChangeResult) => {
    queryClient.setQueryData<CustomerSubscriptionDetail>(subscriptionKeys.detail(id), (old) =>
      old ? { ...result.subscription, cycles: old.cycles } : old,
    );
    void queryClient.invalidateQueries({ queryKey: subscriptionKeys.listAll });
    void queryClient.invalidateQueries({ queryKey: subscriptionKeys.cyclesOf(id) });
    void queryClient.invalidateQueries({ queryKey: subscriptionKeys.optionsAll });
  };
}

/** A refused action leaves the screen possibly stale (409, a skip no longer possible): re-read the detail. */
function useRereadOnError(id: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: subscriptionKeys.detail(id) });
    void queryClient.invalidateQueries({ queryKey: subscriptionKeys.listAll });
  };
}

/** C6: 201 seeds the detail cache with `cycles: []` and invalidates the list (and the options, whose `existingSubscriptionId` changed). */
export function useCreateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSubscriptionInput) => createSubscription(input),
    retry: false,
    onSuccess: (view: SubscriptionView) => {
      queryClient.setQueryData<CustomerSubscriptionDetail>(subscriptionKeys.detail(view.id), {
        ...view,
        cycles: [],
      });
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.listAll });
      void queryClient.invalidateQueries({ queryKey: subscriptionKeys.optionsAll });
    },
  });
}

export function useChangeSubscriptionTerms(id: string) {
  const apply = useApplyChange(id);
  const reread = useRereadOnError(id);
  return useMutation({
    mutationFn: (input: ChangeSubscriptionTermsInput) => changeSubscriptionTerms(id, input),
    retry: false,
    onSuccess: apply,
    onError: reread,
  });
}

export function useSkipSubscriptionDelivery(id: string) {
  const apply = useApplyChange(id);
  const reread = useRereadOnError(id);
  return useMutation({
    mutationFn: (cycleOn: string) => skipSubscriptionDelivery(id, cycleOn),
    retry: false,
    onSuccess: apply,
    onError: reread,
  });
}

export function usePauseSubscription(id: string) {
  const apply = useApplyChange(id);
  const reread = useRereadOnError(id);
  return useMutation({
    mutationFn: () => pauseSubscription(id),
    retry: false,
    onSuccess: apply,
    onError: reread,
  });
}

export function useResumeSubscription(id: string) {
  const apply = useApplyChange(id);
  const reread = useRereadOnError(id);
  return useMutation({
    mutationFn: (firstDeliveryOn?: string) => resumeSubscription(id, firstDeliveryOn),
    retry: false,
    onSuccess: apply,
    onError: reread,
  });
}

export function useCancelSubscription(id: string) {
  const apply = useApplyChange(id);
  const reread = useRereadOnError(id);
  return useMutation({
    mutationFn: (input: CancelSubscriptionInput) => cancelSubscription(id, input),
    retry: false,
    onSuccess: apply,
    onError: reread,
  });
}

export function useWithdrawPendingSubscriptionChanges(id: string) {
  const apply = useApplyChange(id);
  const reread = useRereadOnError(id);
  return useMutation({
    mutationFn: () => withdrawPendingSubscriptionChanges(id),
    retry: false,
    onSuccess: apply,
    onError: reread,
  });
}
