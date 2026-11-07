'use client';

import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiForbiddenError, ApiNotFoundError } from '@/lib/api/client';
import { downloadBillingFile } from '@/lib/api/billing-staff';
import {
  SUBSCRIPTION_EXPORT_ROLES,
  SUBSCRIPTION_MANAGE_ROLES,
  getStaffSubscription,
  getStaffSubscriptionCycles,
  listStaffSubscriptions,
  listUnpaidSubscriptions,
  reinstateSubscription,
  staffCancelSubscription,
  subscriptionsCsvPath,
  type ReinstateSubscriptionInput,
  type StaffCancelSubscriptionInput,
  type StaffSubscriptionFilters,
} from '@/lib/api/staff-subscriptions';
import { staffSubscriptionKeys } from '@/lib/subscriptions/keys';
import { useStaffSession } from './useSession';

/**
 * `lib/hooks/useStaffSubscriptions.ts` -- HO-P6 S2 (§11.3.1). The staff subscription screens' reads and writes.
 * No polling (UI-5): every action re-reads on the server and the answer states the real outcome, so a page left open
 * cannot mislead. A `403` or `404` is never retried. Reinstate and cancel answer the plain view (T7, T8), so the
 * staff detail is re-read rather than patched: the whole `['staff','subscriptions']` prefix is invalidated, which also
 * covers due-tomorrow and the customer summary (ADR-FE-194).
 */

function noRetryOnRefusal(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiForbiddenError || error instanceof ApiNotFoundError) return false;
  return failureCount < 1;
}

/** T1. `filters` come from the URL; the previous page stays on screen while the next one loads. */
export function useStaffSubscriptions(filters: StaffSubscriptionFilters) {
  return useQuery({
    queryKey: staffSubscriptionKeys.list(filters),
    queryFn: () => listStaffSubscriptions(filters),
    placeholderData: keepPreviousData,
    retry: noRetryOnRefusal,
  });
}

/** T2. */
export function useUnpaidSubscriptions(page: number, pageSize?: number) {
  return useQuery({
    queryKey: staffSubscriptionKeys.unpaid(page),
    queryFn: () => listUnpaidSubscriptions({ pageNumber: page, pageSize }),
    placeholderData: keepPreviousData,
    retry: noRetryOnRefusal,
  });
}

/** T5. */
export function useStaffSubscription(id: string, enabled = true) {
  return useQuery({
    queryKey: staffSubscriptionKeys.detail(id),
    queryFn: () => getStaffSubscription(id),
    enabled,
    retry: noRetryOnRefusal,
  });
}

/** T6: the pages after the 50 cycles the detail carries ("Show more"). */
export function useStaffSubscriptionCycles(id: string, page: number, enabled = true) {
  return useQuery({
    queryKey: staffSubscriptionKeys.cycles(id, page),
    queryFn: () => getStaffSubscriptionCycles(id, { pageNumber: page, pageSize: STAFF_CYCLES_PAGE_SIZE }),
    enabled,
    retry: noRetryOnRefusal,
  });
}

/** Cycles per page of T6; the detail carries the latest `STAFF_CYCLES_PAGE_SIZE` (SubscriptionStaffQueryHandlers.cs:164), so page 2 follows it. */
export const STAFF_CYCLES_PAGE_SIZE = 50;

/**
 * T6, pages 2 to `lastPage` joined newest first: what "Show more" has loaded so far. Each page is its own cached query
 * (`staffSubscriptionKeys.cycles`), so going back to a subscription does not re-request them.
 */
export function useStaffSubscriptionMoreCycles(id: string, lastPage: number) {
  const pages = Array.from({ length: Math.max(0, lastPage - 1) }, (_, index) => index + 2);
  return useQueries({
    queries: pages.map((page) => ({
      queryKey: staffSubscriptionKeys.cycles(id, page),
      queryFn: () => getStaffSubscriptionCycles(id, { pageNumber: page, pageSize: STAFF_CYCLES_PAGE_SIZE }),
      retry: noRetryOnRefusal,
    })),
    combine: (results) => ({
      cycles: results.flatMap((result) => result.data?.items ?? []),
      totalCount: results.at(-1)?.data?.totalCount ?? null,
      isFetching: results.some((result) => result.isFetching),
      isError: results.some((result) => result.isError),
      /** Asks again for the pages that failed (the loaded ones are kept). */
      retry: () => results.forEach((result) => result.isError && void result.refetch()),
    }),
  });
}

/** T7. */
export function useReinstateSubscription(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ReinstateSubscriptionInput) => reinstateSubscription(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: staffSubscriptionKeys.all }),
  });
}

/** T8. */
export function useStaffCancelSubscription(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffCancelSubscriptionInput) => staffCancelSubscription(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: staffSubscriptionKeys.all }),
  });
}

/** T4: the server builds the CSV; the browser only saves it (`downloadBillingFile`, ADR-FE-114). */
export function useExportSubscriptions() {
  return useMutation({
    mutationFn: (filters: StaffSubscriptionFilters) =>
      downloadBillingFile(subscriptionsCsvPath(filters), 'subscriptions.csv'),
  });
}

/** Presentation only: does the signed-in role hold `Subscriptions.Manage`? Unknown roles (session not loaded) are not allowed; the server's 403 has the last word. */
export function useCanManageSubscriptions(): boolean {
  const session = useStaffSession();
  return (session.data?.roleIds ?? []).some((role) => SUBSCRIPTION_MANAGE_ROLES.includes(role));
}

/** Presentation only: does the signed-in role hold `Subscriptions.Export`? */
export function useCanExportSubscriptions(): boolean {
  const session = useStaffSession();
  return (session.data?.roleIds ?? []).some((role) => SUBSCRIPTION_EXPORT_ROLES.includes(role));
}
