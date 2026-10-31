import { apiFetch } from './client';
import type { Money } from '../format/money';
import type { ReportMoneyCell } from './reports';

/**
 * `lib/api/dashboard.ts` — HO-RPT-002 §8.2, US-RPT-05. Shape verified against
 * `StaffDashboardController` and `DashboardViewModel`. `GET /api/staff/dashboard` uses
 * `X-Branch-Id` (sent by `client.ts`). The tile list is exactly what the caller may see
 * (ADR-FE-137): a tile that is not sent is not rendered, and there is no placeholder for it.
 */
export type DashboardFigureType = 'Integer' | 'Decimal' | 'Money' | 'Percent' | 'Text';

/** A figure's value: a number (`Integer`), a money object, text, or `null` = not recorded. */
export type DashboardFigureValue = string | number | ReportMoneyCell | null;

export interface DashboardFigure {
  key: string;
  label: string;
  value: DashboardFigureValue;
  type: DashboardFigureType | (string & {});
  unit?: string | null;
}

export interface DashboardDrillDown {
  reportKey: string;
  from: string;
  to: string;
  parameters: Record<string, string>;
}

export interface DashboardTile {
  key: string;
  title: string;
  figures: DashboardFigure[];
  drillDown: DashboardDrillDown | null;
  note?: string | null;
}

export interface Dashboard {
  branchId: string;
  branchName: string;
  localDate: string;
  timeZoneId: string;
  generatedOn: string;
  refreshSeconds: number;
  tiles: DashboardTile[];
}

export function getDashboard(): Promise<Dashboard> {
  return apiFetch<Dashboard>('/api/staff/dashboard');
}

/**
 * HO-P5 BG-1 (11.3.1): one branch-local day of the sales series. `net` is the day's net revenue (zero
 * when nothing was invoiced) and `orders` the orders placed that day.
 * // Read/ViewModels/SalesSeriesViewModels.cs:4
 */
export interface SalesSeriesDay {
  /** `yyyy-MM-dd`, the branch's own day. */
  date: string;
  net: Money;
  orders: number;
}

/**
 * HO-P5 BG-1: `GET /api/staff/dashboard/sales-series?days=` (1 to 31, default 14), oldest day first, every
 * day present. `total` is the SERVER's sum of the days' net revenue: the page shows it and never adds the
 * days up (ADR-317).
 * // Read/ViewModels/SalesSeriesViewModels.cs:7-9; Api/Controllers/StaffDashboardController.cs:38-61
 */
export interface SalesSeries {
  branchId: string;
  branchName: string;
  from: string;
  to: string;
  timeZoneId: string;
  currencyCode: string;
  total: Money;
  generatedOn: string;
  days: SalesSeriesDay[];
}

export const SALES_SERIES_DEFAULT_DAYS = 14;

export function getSalesSeries(days: number = SALES_SERIES_DEFAULT_DAYS): Promise<SalesSeries> {
  return apiFetch<SalesSeries>(`/api/staff/dashboard/sales-series?days=${days}`);
}
