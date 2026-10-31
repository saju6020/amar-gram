import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { resetReportsMockData } from '@/mocks/handlers/reports';
import StaffHomePage from '@/app/(staff)/staff/page';
import { DashboardAttention } from '@/components/back-office-overview/DashboardAttention';
import { DashboardLatestOrders } from '@/components/back-office-overview/DashboardLatestOrders';
import { renderWithClient } from '../reports/helpers';

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
