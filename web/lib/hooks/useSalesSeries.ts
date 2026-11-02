'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiForbiddenError } from '@/lib/api/client';
import { getSalesSeries, SALES_SERIES_DEFAULT_DAYS, type SalesSeries } from '@/lib/api/dashboard';
import { useBranchScope } from './useBranchScope';

/**
 * `lib/hooks/useSalesSeries.ts` — HO-P5 BG-1 (11.3.2), US-RPT-05. The dashboard's 14-day sales series.
 * Keyed by the active branch (a switch refetches), after `['dashboard', 'sales-series', days]`.
 *
 * A `403` (a role without `Reports.SalesView`, or no branch: `BranchNotAssigned`) resolves to `null`: the
 * panel is simply absent, with no error banner (11.3.3). Any other failure is an error the panel can hide
 * as well, because the rest of the dashboard does not depend on it. Nothing here adds the days up: the
 * heading figure is the server's `total`.
 */
export function useSalesSeries(days: number = SALES_SERIES_DEFAULT_DAYS) {
  const { branchId, ready } = useBranchScope();
  return useQuery<SalesSeries | null>({
    queryKey: ['dashboard', 'sales-series', branchId, days],
    queryFn: async () => {
      try {
        return await getSalesSeries(days);
      } catch (error) {
        if (error instanceof ApiForbiddenError) return null;
        throw error;
      }
    },
    enabled: ready,
    retry: (failureCount, error) => !(error instanceof ApiForbiddenError) && failureCount < 1,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}
