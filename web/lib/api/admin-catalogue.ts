import { apiFetch } from './client';

/** `lib/api/admin-catalogue.ts` — HO-ADM-002 §8.2. Tax classes and effective-dated tax
 *  rates (HO-ADM-001 §8.6/§12.4, ADR-049). */

export interface TaxClass {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export async function getTaxClasses(): Promise<TaxClass[]> {
  return apiFetch<TaxClass[]>('/api/admin/tax-classes');
}

export async function getTaxClass(taxClassId: string): Promise<TaxClass> {
  return apiFetch<TaxClass>(`/api/admin/tax-classes/${encodeURIComponent(taxClassId)}`);
}

export interface CreateTaxClassRequest {
  code: string;
  name: string;
}

export async function createTaxClass(
  request: CreateTaxClassRequest,
): Promise<{ taxClassId: string }> {
  return apiFetch<{ taxClassId: string }>('/api/admin/tax-classes', {
    method: 'POST',
    body: request,
  });
}

export interface UpdateTaxClassRequest {
  name: string;
  isActive: boolean;
}

export async function updateTaxClass(
  taxClassId: string,
  request: UpdateTaxClassRequest,
): Promise<void> {
  await apiFetch<void>(`/api/admin/tax-classes/${encodeURIComponent(taxClassId)}`, {
    method: 'PUT',
    body: request,
  });
}

export interface TaxRate {
  id: string;
  taxClassId: string;
  ratePercent: string;
  effectiveFrom: string; // instant
}

export async function getTaxRates(taxClassId: string): Promise<TaxRate[]> {
  return apiFetch<TaxRate[]>(`/api/admin/tax-classes/${encodeURIComponent(taxClassId)}/rates`);
}

export interface SetTaxRateRequest {
  ratePercent: string;
  effectiveFrom: string;
}

export async function setTaxRate(
  taxClassId: string,
  request: SetTaxRateRequest,
): Promise<{ taxRateId: string }> {
  return apiFetch<{ taxRateId: string }>(
    `/api/admin/tax-classes/${encodeURIComponent(taxClassId)}/rates`,
    { method: 'POST', body: request },
  );
}
