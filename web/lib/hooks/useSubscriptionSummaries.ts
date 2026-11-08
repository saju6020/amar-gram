'use client';

import { useQuery } from '@tanstack/react-query';
import { ApiForbiddenError, ApiNotFoundError } from '@/lib/api/client';
import {
  getCustomerSubscriptionSummary,
  getSubscriptionsDueTomorrow,
} from '@/lib/api/staff-subscriptions';
import { staffSubscriptionKeys } from '@/lib/subscriptions/keys';

/**
 * `lib/hooks/useSubscriptionSummaries.ts` -- HO-P6 S3 (§11.4.1, ADR-FE-197). The two small subscription reads the
 * back-office touch points make: T3 (the dashboard) and T9 (the customer profile's Subscriptions tab). Each host
 * screen reads its own endpoint and degrades silently: a `403` (the role cannot view subscriptions) resolves to
 * `null`, so the host hides the row or tab without an error banner, and a refusal is never retried. No polling
 * (UI-5): both refresh on mount and on window focus, and a staff reinstate or cancel invalidates the
 * `['staff','subscriptions']` prefix that holds them (ADR-FE-194).
 */

function noRetryOnRefusal(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiForbiddenError || error instanceof ApiNotFoundError) return false;
  return failureCount < 1;
}

/** T3. `data` is `null` when the signed-in role may not view subscriptions. */
export function useSubscriptionsDueTomorrow() {
  return useQuery({
    queryKey: staffSubscriptionKeys.dueTomorrow,
    queryFn: async () => {
      try {
        return await getSubscriptionsDueTomorrow();
      } catch (error) {
        if (error instanceof ApiForbiddenError) return null;
        throw error;
      }
    },
    retry: noRetryOnRefusal,
    refetchOnWindowFocus: true,
  });
}

/** T9. `data` is `null` on a `403`; an unknown customer is an empty summary (200), not an error. */
export function useCustomerSubscriptionSummary(customerId: string) {
  return useQuery({
    queryKey: staffSubscriptionKeys.customer(customerId),
    queryFn: async () => {
      try {
        return await getCustomerSubscriptionSummary(customerId);
      } catch (error) {
        if (error instanceof ApiForbiddenError) return null;
        throw error;
      }
    },
    retry: noRetryOnRefusal,
    refetchOnWindowFocus: true,
  });
}
