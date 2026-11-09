import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getTaxClasses,
  getTaxClass,
  createTaxClass,
  updateTaxClass,
  getTaxRates,
  setTaxRate,
  type CreateTaxClassRequest,
  type UpdateTaxClassRequest,
  type SetTaxRateRequest,
} from '@/lib/api/admin-catalogue';
import { ApiForbiddenError } from '@/lib/api/client';

function noRetryOn403(failureCount: number, error: unknown) {
  return !(error instanceof ApiForbiddenError) && failureCount < 1;
}

export function useTaxClasses() {
  return useQuery({
    queryKey: ['admin', 'tax-classes'],
    queryFn: getTaxClasses,
    retry: noRetryOn403,
  });
}

export function useTaxClass(taxClassId: string) {
  return useQuery({
    queryKey: ['admin', 'tax-classes', taxClassId],
    queryFn: () => getTaxClass(taxClassId),
    enabled: !!taxClassId,
    retry: noRetryOn403,
  });
}

export function useCreateTaxClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateTaxClassRequest) => createTaxClass(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tax-classes'] }),
  });
}

export function useUpdateTaxClass(taxClassId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: UpdateTaxClassRequest) => updateTaxClass(taxClassId, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tax-classes'] }),
  });
}

export function useTaxRates(taxClassId: string) {
  return useQuery({
    queryKey: ['admin', 'tax-classes', taxClassId, 'rates'],
    queryFn: () => getTaxRates(taxClassId),
    enabled: !!taxClassId,
    retry: noRetryOn403,
  });
}

export function useSetTaxRate(taxClassId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SetTaxRateRequest) => setTaxRate(taxClassId, request),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'tax-classes', taxClassId, 'rates'] }),
  });
}
