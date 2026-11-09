import { apiFetch } from './client';
import { buildQuery } from './inventory-lookup';
import type { PagedResult } from './types';

/**
 * `lib/api/inventory-alerts.ts` — HO-IMP-002 §8.2, US-IMP-10/12. `StaffAlertsController`. The
 * real aggregate is `InventoryAlert` (HO-IMP-001 called it `StockAlert`); the wire shape is below.
 */

export type AlertKind =
  'ExpiryThreshold' | 'Expired' | 'LowStock' | 'Shortfall' | 'StorageBreach' | 'LedgerMismatch';

export type AlertStatus = 'Open' | 'Acknowledged' | 'Resolved';

export interface InventoryAlert {
  id: string;
  kind: AlertKind;
  status: AlertStatus;
  skuId: string | null;
  skuCode: string | null;
  displayName: string | null;
  batchId: string | null;
  lotNumber: string | null;
  locationId: string | null;
  locationCode: string | null;
  thresholdDays: number | null;
  quantityAtRaise: string | null;
  raisedOn: string;
  acknowledgedBy: string | null;
  acknowledgedOn: string | null;
  resolvedOn: string | null;
  resolutionNote: string | null;
}

export async function getAlerts(params: {
  status?: string;
  kind?: string;
  locationId?: string;
  pageNumber?: number;
  pageSize?: number;
}): Promise<PagedResult<InventoryAlert>> {
  return apiFetch(`/api/staff/inventory/alerts${buildQuery(params)}`);
}

export interface AlertSummary {
  open: { total: number; byKind: Partial<Record<AlertKind, number>> };
  /** HO-P5 BG-17 -- consignments of the branch expected within `withinDays` days that are not cancelled and
   *  have no receipt yet (`Read/ViewModels/AlertsAndReportsViewModels.cs:20-24`). Absent -> the row is left out. */
  consignmentsArriving?: { withinDays: number; count: number } | null;
}

/** `arrivalWindowDays` is 1-90 (default 7); anything else is a 400 `InvalidQuery`
 *  (`StaffAlertsAndReorderController.cs:41-42`, `InventoryRules.cs:30`). */
export async function getAlertSummary(arrivalWindowDays?: number): Promise<AlertSummary> {
  return apiFetch(`/api/staff/inventory/alerts/summary${buildQuery({ arrivalWindowDays })}`);
}

export async function acknowledgeAlert(id: string, note: string | null): Promise<void> {
  return apiFetch(`/api/staff/inventory/alerts/${encodeURIComponent(id)}/acknowledge`, {
    method: 'POST',
    body: { note },
  });
}
