import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { resetReportsMockData } from '@/mocks/handlers/reports';
import StaffHomePage from '@/app/(staff)/staff/page';
import { DashboardAttention } from '@/components/back-office-overview/DashboardAttention';
import { DashboardLatestOrders } from '@/components/back-office-overview/DashboardLatestOrders';
import { DashboardPipeline } from '@/components/back-office-overview/DashboardPipeline';
import { renderWithClient } from '../reports/helpers';

// These render whole screens (a form, a customers list with its profile) with MSW and real user-event typing: ~2 s
// alone, but 5 s+ when the machine is loaded (HO-P4 ACCEPTANCE: the customer search case took 24.7 s under load).
// A generous per-test limit keeps load from failing them; it does not slow a passing run.
// Measured 2026-11-07 on an unloaded machine, this file alone: slowest test 1.1 s (the rest well under 1 s), so 30 s is about 15x headroom, not a normal duration.
vi.setConfig({ testTimeout: 30_000 });

const nav = vi.hoisted(() => ({
  search: '',
  pathname: '/staff/customers',
  push: vi.fn(),
  replace: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const forbidden = () =>
  HttpResponse.json(
    {
      isValid: false,
      errors: [{ errorCode: 'ActionNotPermitted', errorMessage: 'no', propertyName: '', resourceName: '' }],
    },
    { status: 403 },
  );

const ADMIN_SESSION = {
  staffAccountId: 'staff-1',
  fullName: 'Rahim Uddin',
  roleIds: ['Administrator'],
  issuedOn: '2026-10-14T00:00:00Z',
  lastActivityOn: '2026-10-14T00:00:00Z',
  idleExpiresOn: '2026-10-14T01:00:00Z',
  absoluteExpiresOn: '2026-10-14T09:00:00Z',
  idleTimeoutMinutes: 30,
  serverTime: '2026-10-14T00:00:00Z',
};

beforeEach(() => {
  nav.search = '';
  nav.pathname = '/staff/customers';
  nav.push.mockReset();
  nav.replace.mockReset();
  resetReportsMockData();
});

describe('Dashboard page — U12', () => {
  it('renders the payload tiles only, the pinned h1, the greeting eyebrow and no "Sample data"', async () => {
    const tile = (key: string, title: string) => ({
      key,
      title,
      figures: [{ key: 'n', label: 'Count', value: 4, type: 'Integer' }],
      drillDown: null,
    });
    server.use(
      http.get('*/api/staff/session', () => HttpResponse.json(ADMIN_SESSION)),
      http.get('*/api/staff/dashboard', () =>
        HttpResponse.json({
          branchId: 'b1',
          branchName: 'Main outlet',
          localDate: '2026-10-14',
          timeZoneId: 'Asia/Dhaka',
          generatedOn: '2026-10-14T03:42:00+00:00',
          refreshSeconds: 60,
          tiles: [tile('orders.today', 'Orders today'), tile('stock.expiring', 'Expiring stock')],
        }),
      ),
    );
    renderWithClient(<StaffHomePage />);
    const h1 = await screen.findByRole('heading', { level: 1, name: /^Today — .* · \S/ });
    expect(h1).toBeInTheDocument();
    expect(document.querySelectorAll('section[aria-labelledby^="tile-"]')).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 2, name: 'Orders today' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Expiring stock' })).toBeInTheDocument();
    expect(await screen.findByText('Good morning, Rahim')).toBeInTheDocument();
    expect(screen.queryByText(/sample data/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New counter sale' })).toHaveAttribute('href', '/staff/pos');
    expect(screen.getByRole('link', { name: 'Receive goods' })).toHaveAttribute(
      'href',
      '/staff/inventory/receipts/new',
    );
  });
});

describe('DashboardAttention — U13', () => {
  it('shows the inventory rows when approvals are refused, with no error banner', async () => {
    server.use(
      http.get('*/api/staff/inventory/alerts/summary', () =>
        HttpResponse.json({ open: { total: 5, byKind: { ExpiryThreshold: 3, LowStock: 2 } } }),
      ),
      http.get('*/api/staff/billing/approvals', forbidden),
    );
    renderWithClient(<DashboardAttention />);
    const expiring = await screen.findByRole('link', { name: /Batches nearing expiry/ });
    expect(expiring).toHaveAttribute('href', '/staff/inventory/alerts');
    expect(expiring).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: /Items below their reorder level/ })).toHaveTextContent('2');
    expect(screen.queryByRole('link', { name: /waiting for approval/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/couldn.t check/)).not.toBeInTheDocument();
  });

  it('shows the approvals row, linked to the queue, when the server lists pending payments', async () => {
    server.use(
      http.get('*/api/staff/inventory/alerts/summary', () =>
        HttpResponse.json({ open: { total: 0, byKind: {} } }),
      ),
      http.get('*/api/staff/billing/approvals', () =>
        HttpResponse.json([{ paymentId: 'p1' }, { paymentId: 'p2' }]),
      ),
    );
    renderWithClient(<DashboardAttention />);
    const row = await screen.findByRole('link', { name: /Payments waiting for approval/ });
    expect(row).toHaveAttribute('href', '/staff/billing/approvals');
    expect(row).toHaveTextContent('2');
  });

  it('is absent when both areas are refused', async () => {
    server.use(
      http.get('*/api/staff/inventory/alerts/summary', forbidden),
      http.get('*/api/staff/billing/approvals', forbidden),
    );
    renderWithClient(<DashboardAttention />);
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Needs attention' })).not.toBeInTheDocument(),
    );
  });
});

describe('DashboardLatestOrders — U14', () => {
  const row = (n: number) => ({
    id: `o${n}`,
    orderNumber: `ORD-2026-00000${n}`,
    placedOn: '2026-10-14T03:00:00+00:00',
    customerName: `Customer ${n}`,
    status: 'Confirmed',
    fulfilmentMethod: 'Delivery',
    paymentMethod: 'BankTransfer',
    channel: n % 2 ? 'Online' : 'Counter',
    grandTotal: { amount: `${n}00.00`, currencyCode: 'BDT' },
    ageMinutes: 5,
    flags: [],
    branchTimeZoneId: 'Asia/Dhaka',
  });

  it('shows the five rows the queue sends, totals through AmountCell, and an All orders link', async () => {
    let requested = '';
    server.use(
      http.get('*/api/staff/orders', ({ request }) => {
        requested = new URL(request.url).search;
        return HttpResponse.json({
          items: [1, 2, 3, 4, 5].map(row),
          pageNumber: 1,
          pageSize: 5,
          totalCount: 9,
        });
      }),
    );
    renderWithClient(<DashboardLatestOrders />);
    const table = await screen.findByRole('table', { name: /Latest orders/ });
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 5);
    expect(requested).toContain('pageSize=5');
    expect(within(table).getByText('Customer 3')).toBeInTheDocument();
    // AmountCell: visible text plus the screen-reader money text.
    expect(within(table).getByText('BDT 300.00')).toHaveClass('sr-only');
    expect(screen.getByRole('link', { name: 'All orders' })).toHaveAttribute('href', '/staff/orders');
    expect(within(table).getByRole('link', { name: 'ORD-2026-000001' })).toHaveAttribute(
      'href',
      '/staff/orders/o1',
    );
  });

  it('is dropped on a 403', async () => {
    server.use(http.get('*/api/staff/orders', forbidden));
    renderWithClient(<DashboardLatestOrders />);
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Latest orders' })).not.toBeInTheDocument(),
    );
  });
});

describe('DashboardPipeline - U17 (HO-P5)', () => {
  const counts = (over: Record<string, number> = {}) => {
    const all: Record<string, number> = {
      PendingPayment: 2,
      Confirmed: 7,
      Packing: 3,
      Packed: 1,
      Dispatched: 0,
      Delivered: 20,
      Cancelled: 1,
      Returned: 0,
      Refunded: 0,
      ...over,
    };
    return {
      // The server's own total, deliberately not the sum of the counts: whatever it sends is what is shown.
      total: 99,
      counts: Object.entries(all).map(([status, count]) => ({ status, count })),
    };
  };

  it('draws Confirmed, Packing, Packed and Dispatched with the server counts as text, each linking to the orders in that status', async () => {
    server.use(http.get('*/api/staff/orders/status-counts', () => HttpResponse.json(counts())));
    renderWithClient(<DashboardPipeline />);
    const list = await screen.findByRole('list', { name: 'Orders in progress by status' });
    const rows = within(list).getAllByRole('link');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Confirmed7 orders',
      'Being packed3 orders',
      'Packed1 order',
      'Dispatched0 orders',
    ]);
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      '/staff/orders?status=Confirmed',
      '/staff/orders?status=Packing',
      '/staff/orders?status=Packed',
      '/staff/orders?status=Dispatched',
    ]);
    // No client-side sum: the line under the bars is the server's `total`.
    expect(screen.getByRole('link', { name: 'Every order' })).toHaveAttribute('href', '/staff/orders');
    expect(screen.getByText(/: 99$/)).toBeInTheDocument();
  });

  it('scales the longest bar to full width and an empty status to none', async () => {
    server.use(http.get('*/api/staff/orders/status-counts', () => HttpResponse.json(counts())));
    renderWithClient(<DashboardPipeline />);
    const list = await screen.findByRole('list', { name: 'Orders in progress by status' });
    const widthOf = (name: RegExp) =>
      (within(list).getByRole('link', { name }).querySelector('span[style]') as HTMLElement).style.width;
    expect(widthOf(/^Confirmed/)).toBe('100%');
    expect(widthOf(/^Dispatched/)).toBe('0%');
  });

  it('is dropped on a 403 and after a failed read, with no banner', async () => {
    server.use(http.get('*/api/staff/orders/status-counts', forbidden));
    const { unmount } = renderWithClient(<DashboardPipeline />);
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Orders in progress' })).not.toBeInTheDocument(),
    );
    unmount();
    server.use(http.get('*/api/staff/orders/status-counts', () => new HttpResponse(null, { status: 500 })));
    renderWithClient(<DashboardPipeline />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument(), { timeout: 4000 });
    expect(screen.queryByRole('heading', { name: 'Orders in progress' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Dashboard page - HO-P5 panels', () => {
  it('shows the sales chart, the pipeline and the rider-cash tile the server sends, for an administrator', async () => {
    server.use(http.get('*/api/staff/session', () => HttpResponse.json(ADMIN_SESSION)));
    renderWithClient(<StaffHomePage />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Sales, last 14 days' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Orders in progress' })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Cash on delivery out with riders' }),
    ).toBeInTheDocument();
  });
});
