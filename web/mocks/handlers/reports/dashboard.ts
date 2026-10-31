import { http, HttpResponse, type HttpHandler } from 'msw';
import type { Dashboard, DashboardFigure, DashboardTile } from '@/lib/api/dashboard';
import { db as orderingDb, money as orderingMoney } from '../ordering/store';
import { branchFor, forbidden, rolesOf, violation } from './fixtures';

/** Reports.SalesView: Shared/Common/Constants/ActionRoles.Reports.cs:12. */
const SALES_VIEW_ROLES = ['ShopManager', 'Accountant', 'Administrator'];
/** `GetSalesSeriesQuery`: 1 to 31 days, 14 by default (Read/Queries/Reporting/SalesSeriesQueries.cs:13-14; Api/Controllers/StaffDashboardController.cs:44). */
const SALES_SERIES_MAX_DAYS = 31;
const SALES_SERIES_DEFAULT_DAYS = 14;

/** Test controls: how often the dashboard has been polled (a second poll has changed numbers). */
export const dashboardControl = { polls: 0, refreshSeconds: 60 };

export function resetDashboardMock(): void {
  dashboardControl.polls = 0;
  dashboardControl.refreshSeconds = 60;
}

const count = (
  key: string,
  label: string,
  value: number | null,
  unit?: string,
): DashboardFigure => ({
  key,
  label,
  value,
  type: 'Integer',
  unit: unit ?? null,
});
const amount = (key: string, label: string, value: string | null): DashboardFigure => ({
  key,
  label,
  value: value === null ? null : { amount: value, currencyCode: 'BDT' },
  type: 'Money',
  unit: null,
});

function tile(
  key: string,
  title: string,
  figures: DashboardFigure[],
  reportKey: string | null,
  extra: Partial<DashboardTile> = {},
): DashboardTile {
  return {
    key,
    title,
    figures,
    drillDown: reportKey
      ? { reportKey, from: '2026-10-14', to: '2026-10-14', parameters: {} }
      : null,
    note: null,
    ...extra,
  };
}

/**
 * HO-P5 BG-5, `orders.cod-with-riders` (Read/QueryHandlers/Reporting/Dashboard/DashboardTileSources.cs:217-246): the dispatched, not yet
 * delivered cash-on-delivery orders assigned to an in-house rider. `riders` counts the distinct riders carrying at least one, `orders`
 * the orders, `amount` what they still owe (grand total less anything paid, never below zero). Live from the ordering store, so a
 * dispatch to a rider moves the figure. The server shows it to ShopManager, Accountant and Administrator
 * (Shared/Common/Constants/DashboardTiles.cs:20); the sums are the server's, done here because this handler IS the server.
 */
function codWithRidersTile(): DashboardTile {
  const out = orderingDb.orders.filter(
    (o) => o.status === 'Dispatched' && o.paymentMethod === 'CashOnDelivery' && !!o.shipment?.riderId,
  );
  const riders = new Set(out.map((o) => o.shipment?.riderId));
  const owedCents = out.reduce((sum, o) => sum + Math.max(0, o.grandTotalCents - o.amountPaidCents), 0);
  return tile(
    'orders.cod-with-riders',
    'Cash on delivery out with riders',
    [
      count('riders', 'Riders carrying cash', riders.size),
      count('orders', 'Orders out with riders', out.length),
      amount('amount', 'Cash on delivery out', orderingMoney(owedCents).amount),
    ],
    null,
  );
}

function tilesFor(roles: string[], poll: number): DashboardTile[] {
  const tiles: DashboardTile[] = [];
  const has = (...r: string[]) => r.some((x) => roles.includes(x));
  if (has('ShopManager', 'Administrator')) {
    tiles.push(
      tile(
        'orders.today',
        'Orders today',
        [
          count('placed', 'Placed today', 11 + poll),
          count('toPack', 'To pack', 6),
          count('dispatched', 'Dispatched today', null),
        ],
        null,
      ),
    );
  }
  if (has('ShopManager', 'Accountant', 'Administrator')) {
    tiles.push(codWithRidersTile());
  }
  if (has('Inventory', 'Administrator')) {
    tiles.push(
      tile(
        'stock.expiry',
        'Expiring stock',
        [count('batches', 'Batches within 30 days', 4)],
        'stock-near-expiry',
      ),
    );
  }
  if (has('Accountant', 'Administrator')) {
    tiles.push(
      tile(
        'payments.today',
        'Payments today',
        [
          amount('CashOnDelivery', 'Cash on delivery', '4200.00'),
          amount('CashInStore', 'Cash in store', '9800.00'),
          amount('CardInStore', 'Card in store', '3100.00'),
          amount('BankTransfer', 'Bank transfer', '0.00'),
        ],
        'payment-reconciliation',
      ),
    );
  }
  if (has('Accountant')) {
    tiles.push(
      tile(
        'billing.cash-up',
        'Cash-up today',
        [
          { key: 'status', label: 'Today', value: 'Not closed', type: 'Text', unit: null },
          amount('variance', 'Variance', '350.00'),
        ],
        null,
      ),
    );
  }
  if (has('Administrator')) {
    tiles.push(
      tile(
        'billing.receivables',
        'Receivables',
        [amount('outstanding', 'Outstanding', '58000.00'), amount('over90', 'Over 90 days', null)],
        'revenue-by-business-line',
      ),
    );
  }
  return tiles;
}

/** `yyyy-MM-dd` shifted by whole days (UTC arithmetic on a calendar date, no time zone involved). */
function shiftDate(date: string, days: number): string {
  const moment = new Date(`${date}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
}

/**
 * A believable series: a weekly rhythm, a slow day, and one day with nothing invoiced (zero net, every day still
 * present). The figures are the mock's own data; the series `total` is the sum the server sends.
 */
function seriesDay(index: number): { netCents: number; orders: number } {
  if (index % 11 === 4) return { netCents: 0, orders: 0 };
  const weekday = index % 7;
  const orders = 6 + ((index * 5) % 9) + (weekday === 5 ? 4 : 0);
  return { netCents: orders * 135_000 + ((index * 7919) % 40) * 1_250, orders };
}

export const dashboardHandlers: HttpHandler[] = [
  // HO-P5 BG-1: Api/Controllers/StaffDashboardController.cs:38-61. `Reports.SalesView` first (403 for another role), then `days` 1-31
  // (else 400), then the branch (403 BranchNotAssigned); the last `days` branch-local days, oldest first, every day present.
  http.get('*/api/staff/dashboard/sales-series', ({ request }) => {
    const roles = rolesOf(request);
    if (!roles.some((role) => SALES_VIEW_ROLES.includes(role))) return forbidden();
    const raw = new URL(request.url).searchParams.get('days');
    const days = raw === null || raw === '' ? SALES_SERIES_DEFAULT_DAYS : Number(raw);
    if (!Number.isInteger(days) || days < 1 || days > SALES_SERIES_MAX_DAYS) {
      return HttpResponse.json({ error: `days must be 1 to ${SALES_SERIES_MAX_DAYS}.` }, { status: 400 });
    }
    const branch = branchFor(request);
    if (roles.includes('NoBranch')) return violation(403, 'BranchNotAssigned', 'You are not assigned to that branch.', null);
    const to = branch.timeZoneId === 'Asia/Dhaka' ? '2026-10-14' : '2026-10-13';
    const from = shiftDate(to, -(days - 1));
    const series = Array.from({ length: days }, (_, index) => ({ date: shiftDate(from, index), ...seriesDay(index) }));
    const totalCents = series.reduce((sum, day) => sum + day.netCents, 0);
    return HttpResponse.json(
      {
        branchId: branch.id,
        branchName: branch.name,
        from,
        to,
        timeZoneId: branch.timeZoneId,
        currencyCode: 'BDT',
        total: orderingMoney(totalCents),
        generatedOn: '2026-10-14T03:42:00+00:00',
        days: series.map((day) => ({ date: day.date, net: orderingMoney(day.netCents), orders: day.orders })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }),

  http.get('*/api/staff/dashboard', ({ request }) => {
    const branch = branchFor(request);
    dashboardControl.polls += 1;
    const roles = rolesOf(request);
    if (roles.includes('NoBranch'))
      return violation(403, 'BranchNotAssigned', 'You are not assigned to that branch.', null);
    const body: Dashboard = {
      branchId: branch.id,
      branchName: branch.name,
      localDate: branch.timeZoneId === 'Asia/Dhaka' ? '2026-10-14' : '2026-10-13',
      timeZoneId: branch.timeZoneId,
      generatedOn: `2026-10-14T0${Math.min(9, 3 + dashboardControl.polls)}:42:00+00:00`,
      refreshSeconds: dashboardControl.refreshSeconds,
      tiles: tilesFor(roles, dashboardControl.polls - 1),
    };
    return HttpResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  }),
];
