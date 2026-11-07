import { HttpResponse } from 'msw';
import { getStaffRoleIdsForRequest } from '../areas/accounts';
import { administrationFixtureIds } from '../admin/fixtures';
import type { ReportCatalogueEntry, ReportColumn, ReportParameter } from '@/lib/api/reports';

/**
 * `mocks/handlers/reports/fixtures.ts` — HO-RPT-002 §12. Generated from HO-RPT-001 §12.4 and the
 * real controllers' shapes (`StaffReportsController`, `ReportResultFormatter`). The catalogue is
 * filtered to the caller's roles (a restricted column is ABSENT, never blank); Reception gets a
 * `403` for the whole catalogue. Two branches in different zones prove every instant follows the
 * payload's `timeZoneId`.
 */
export const reportFixtureIds = {
  mainBranchId: administrationFixtureIds.mainBranchId,
  londonBranchId: administrationFixtureIds.londonBranchId,
  /** Date triggers (the mock stands in for the server, so it keys on the requested range). */
  emptyFrom: '2026-01-01',
  timeoutFrom: '2020-01-01',
  tooLargePdfFrom: '2021-01-01',
  rateLimitedFrom: '2019-01-01',
  serverErrorFrom: '2018-01-01',
} as const;

export const BRANCHES: Record<string, { name: string; timeZoneId: string; offset: string }> = {
  [administrationFixtureIds.mainBranchId]: {
    name: 'Main outlet',
    timeZoneId: 'Asia/Dhaka',
    offset: '+06:00',
  },
  [administrationFixtureIds.londonBranchId]: {
    name: 'London outlet',
    timeZoneId: 'Europe/London',
    offset: '+01:00',
  },
};

export function branchFor(request: Request): { id: string } & (typeof BRANCHES)[string] {
  const url = new URL(request.url);
  const requested = url.searchParams.get('branchId');
  const header = request.headers.get('X-Branch-Id');
  const id =
    [requested, header].find((value) => value && BRANCHES[value]) ??
    administrationFixtureIds.mainBranchId;
  return { id, ...BRANCHES[id]! };
}

export function forbidden() {
  return HttpResponse.json(
    {
      errors: [
        {
          errorCode: 'ActionNotPermitted',
          errorMessage: 'You are not permitted to perform this action.',
        },
      ],
    },
    { status: 403 },
  );
}

export function violation(
  status: number,
  errorCode: string,
  errorMessage: string,
  propertyName: string | null,
) {
  return HttpResponse.json(
    { error: errorCode, errors: [{ errorCode, errorMessage, propertyName }] },
    { status },
  );
}

const col = (
  key: string,
  label: string,
  type: string,
  extra: Partial<ReportColumn> = {},
): ReportColumn => ({ key, label, type, unit: null, sortable: true, description: null, ...extra });

const FULFILMENT_COLUMNS: ReportColumn[] = [
  col('orderNumber', 'Order', 'Text'),
  col('placedOn', 'Placed', 'Instant'),
  col('channel', 'Channel', 'Text', { sortable: false }),
  col('status', 'Status', 'Text'),
  col('ageHours', 'Age (hours)', 'Integer', { unit: 'h' }),
  col('slaBreach', 'Dispatch SLA breached', 'Boolean'),
  col('dispatchedOn', 'Dispatched', 'Instant'),
  col('deliveredOn', 'Delivered', 'Instant'),
];

const REVENUE_ALL: ReportColumn[] = [
  col('bucket', 'Period', 'Date'),
  col('line', 'Business line', 'Text'),
  col('invoices', 'Invoices', 'Integer'),
  col('gross', 'Gross', 'Money'),
  col('discounts', 'Discounts', 'Money'),
  col('tax', 'Tax', 'Money'),
  col('net', 'Net revenue', 'Money'),
  col('cost', 'Cost of goods', 'Money'),
  col('margin', 'Margin', 'Money'),
  col('marginPercent', 'Margin %', 'Percent'),
  col('refunds', 'Refunds', 'Money'),
  col('creditNotes', 'Credit notes', 'Money'),
];

const RESTRICTED_KEYS = new Set(['cost', 'margin', 'marginPercent']);

const NEAR_EXPIRY_PARAMS: ReportParameter[] = [
  {
    name: 'withinDays',
    label: 'Expiring within (days)',
    type: 'Integer',
    min: 1,
    max: 365,
    default: '30',
  },
  {
    name: 'category',
    label: 'Category',
    type: 'Enum',
    allowedValues: ['All', 'Food', 'Consumable'],
    default: 'All',
  },
  {
    name: 'includeQuarantined',
    label: 'Include quarantined stock',
    type: 'Boolean',
    default: 'false',
  },
  { name: 'supplierId', label: 'Supplier id', type: 'Guid', default: '' },
];

const RANGE = { from: '2026-10-14', to: '2026-10-14' };

function entry(
  partial: Partial<ReportCatalogueEntry> &
    Pick<ReportCatalogueEntry, 'key' | 'title' | 'category' | 'columns'>,
): ReportCatalogueEntry {
  return {
    description: '',
    kind: 'Period',
    timeBucketed: false,
    defaultPeriod: 'Today',
    defaultRange: RANGE,
    maxRangeDays: 31,
    formats: ['Csv', 'Pdf'],
    parameters: [],
    canUseAllBranches: false,
    canSchedule: false,
    ...partial,
  };
}

const ALL_ENTRIES: ReportCatalogueEntry[] = [
  entry({
    key: 'order-fulfilment',
    title: 'Order fulfilment',
    description:
      'Every order placed in the range with its age, whether it breached the dispatch service level, and when it was dispatched and delivered.',
    category: 'Sales',
    columns: FULFILMENT_COLUMNS,
  }),
  entry({
    key: 'stock-near-expiry',
    title: 'Near expiry',
    description: 'Batches expiring soon, with the value at risk.',
    category: 'Stock',
    kind: 'AsAt',
    maxRangeDays: 366,
    parameters: NEAR_EXPIRY_PARAMS,
    columns: [
      col('sku', 'SKU', 'Text'),
      col('lot', 'Lot', 'Text'),
      col('expiresOn', 'Expires', 'Date'),
      col('quantity', 'Quantity', 'Decimal'),
      col('valueAtRisk', 'Value at risk', 'Money'),
    ],
  }),
  entry({
    key: 'revenue-shop-by-category',
    title: 'Shop revenue by category',
    description: 'Shop net revenue by category and origin.',
    category: 'Sales',
    timeBucketed: true,
    defaultPeriod: 'MonthToDate',
    defaultRange: { from: '2026-10-01', to: '2026-10-14' },
    maxRangeDays: 731,
    canUseAllBranches: false,
    columns: REVENUE_ALL,
  }),
  entry({
    key: 'revenue-by-business-line',
    title: 'Revenue by sales channel',
    description: 'Net revenue for the shop, with margin where costs are known.',
    category: 'Financial',
    timeBucketed: true,
    defaultPeriod: 'MonthToDate',
    defaultRange: { from: '2026-10-01', to: '2026-10-14' },
    maxRangeDays: 731,
    columns: REVENUE_ALL,
  }),
  entry({
    key: 'payment-reconciliation',
    title: 'Payment reconciliation',
    description:
      'Expected against received for cash on delivery, cash, card in store and bank transfer.',
    category: 'Financial',
    defaultPeriod: 'PreviousDay',
    defaultRange: { from: '2026-10-13', to: '2026-10-13' },
    maxRangeDays: 93,
    columns: [
      col('businessDate', 'Business date', 'Date'),
      col('method', 'Method', 'Text'),
      col('expected', 'Expected', 'Money'),
      col('received', 'Received', 'Money'),
      col('variance', 'Variance', 'Money'),
      col('varianceDirection', 'Variance direction', 'Text', {
        description:
          'Over: received more than expected. Short: received less. Matched: the same. Empty: nothing to compare.',
      }),
      col('matched', 'Matched', 'Integer'),
      col('mismatchesOpen', 'Open mismatches', 'Integer'),
    ],
  }),
  entry({
    key: 'new-vs-returning',
    title: 'New and returning customers',
    description: 'How many customers bought for the first time and how many came back.',
    category: 'Growth',
    timeBucketed: true,
    defaultPeriod: 'Last30Days',
    defaultRange: { from: '2026-09-15', to: '2026-10-14' },
    maxRangeDays: 731,
    columns: [
      col('bucket', 'Period', 'Date'),
      col('newCustomers', 'New', 'Integer'),
      col('returning', 'Returning', 'Integer'),
      col('returnRate', 'Return rate', 'Percent'),
    ],
  }),
];

/** Which categories each staff role may open (ActionRoles.Reports.cs: Growth is Administrator only, Sales also opens to the Accountant). */
const ROLE_CATEGORIES: Record<string, string[]> = {
  Administrator: ['Stock', 'Sales', 'Financial', 'Growth'],
  Reception: [],
  Inventory: ['Stock'],
  ShopManager: ['Sales'],
  Accountant: ['Sales', 'Financial'],
};

let roleOverride: string[] | null = null;

/** Test seam: answer as these roles regardless of the (unmodelled) session. `null` clears it. */
export function setMockReportRoles(roles: string[] | null): void {
  roleOverride = roles;
}

export function rolesOf(request: Request): string[] {
  return roleOverride ?? getStaffRoleIdsForRequest(request) ?? ['Administrator'];
}

export function categoriesFor(roles: string[]): string[] {
  return [...new Set(roles.flatMap((role) => ROLE_CATEGORIES[role] ?? []))];
}

export function catalogueFor(roles: string[]): ReportCatalogueEntry[] {
  const categories = categoriesFor(roles);
  const accounts = roles.includes('Administrator') || roles.includes('Accountant');
  const admin = roles.includes('Administrator');
  return ALL_ENTRIES.filter((e) => categories.includes(e.category)).map((e) => ({
    ...e,
    columns: e.columns.filter((c) => accounts || !RESTRICTED_KEYS.has(c.key)),
    canUseAllBranches: accounts,
    canSchedule: admin,
  }));
}

export function findEntry(key: string): ReportCatalogueEntry | undefined {
  return ALL_ENTRIES.find((e) => e.key === key);
}

export function dayDiffInclusive(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
}
