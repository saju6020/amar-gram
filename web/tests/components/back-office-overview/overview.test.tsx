import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { resetReportsMockData, setMockReportRoles } from '@/mocks/handlers/reports';
import { catalogueFor } from '@/mocks/handlers/reports/fixtures';
import StaffSignInPage from '@/app/(auth)/staff/sign-in/page';
import StaffForgotPasswordPage from '@/app/(auth)/staff/forgot-password/page';
import StaffHomePage from '@/app/(staff)/staff/page';
import ReportsLayout from '@/app/(staff)/staff/reports/layout';
import StaffCustomersPage from '@/app/(staff)/staff/customers/page';
import { DashboardAttention } from '@/components/back-office-overview/DashboardAttention';
import { DashboardLatestOrders } from '@/components/back-office-overview/DashboardLatestOrders';
import { ReportViewer } from '@/components/reports/ReportViewer';
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

describe('StaffAuthFrame — U11', () => {
  it('sign-in: h1 "Staff sign in", the helper line and the form; no data-theme anywhere', () => {
    const { container } = renderWithClient(<StaffSignInPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Staff sign in' })).toBeInTheDocument();
    expect(
      screen.getByText('Use your staff mobile number or email. Staff and customer accounts are separate.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Back office')).toBeInTheDocument();
    expect(screen.getByLabelText(/mobile number or email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(container.querySelector('[data-theme]')).toBeNull();
    expect(screen.getByTestId('staff-auth-frame')).toHaveClass('bg-leaf-ink');
  });

  it('forgot-password: the frame with the set-or-reset h1 and no helper line', () => {
    const { container } = renderWithClient(<StaffForgotPasswordPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Set or reset password' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Staff and customer accounts are separate/)).not.toBeInTheDocument();
    expect(container.querySelector('[data-theme]')).toBeNull();
  });
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

describe('Reports layout and viewer — U15', () => {
  function useCatalogue(roles: string[]) {
    const entries = catalogueFor(roles);
    setMockReportRoles(roles);
    server.use(http.get('*/api/staff/reports', () => HttpResponse.json(entries)));
    return entries;
  }

  it('the report list is a nav named "Report list" and marks the current report', async () => {
    const entries = useCatalogue(['Administrator']);
    const current = entries[0]!;
    nav.pathname = `/staff/reports/${current.key}`;
    renderWithClient(
      <ReportsLayout>
        <p>viewer</p>
      </ReportsLayout>,
    );
    const list = await screen.findByRole('navigation', { name: 'Report list' });
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(entries.length);
    const marked = links.filter((link) => link.getAttribute('aria-current') === 'page');
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent(current.title);
    expect(screen.getByText('viewer')).toBeInTheDocument();
  });

  it('on /staff/reports the layout draws the h1 and no report is current', async () => {
    useCatalogue(['Administrator']);
    nav.pathname = '/staff/reports';
    renderWithClient(
      <ReportsLayout>
        <p>choose</p>
      </ReportsLayout>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Reports' })).toBeInTheDocument();
    const list = await screen.findByRole('navigation', { name: 'Report list' });
    expect(
      within(list)
        .getAllByRole('link')
        .some((link) => link.hasAttribute('aria-current')),
    ).toBe(false);
  });

  it('the chart has a table alternative and a polite readout', async () => {
    useCatalogue(['Administrator']);
    nav.pathname = '/staff/reports/new-vs-returning';
    renderWithClient(<ReportViewer reportKey="new-vs-returning" />);
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Show chart' }));
    const hidden = await screen.findByTestId('chart-data-table');
    const region = hidden.parentElement!;
    expect(region.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});

describe('Customers screen — U16, U17', () => {
  const customer = {
    id: 'c1',
    fullName: 'Nusrat Jahan',
    mobileNumber: '01711000001',
    emailAddress: 'nusrat@example.com',
    recordStatus: 'Complete',
    status: 'Active',
    mobileMatchedOn: 'Primary',
  };

  function mockLookup() {
    const seen: string[] = [];
    server.use(
      http.get('*/api/staff/session', () => HttpResponse.json(ADMIN_SESSION)),
      http.get('*/api/staff/customers/c1', () =>
        HttpResponse.json({
          ...customer,
          registrationChannel: 'Reception',
          mergedIntoCustomerId: null,
        }),
      ),
      http.get('*/api/staff/customers', ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json([customer]);
      }),
    );
    return seen;
  }

  it('the empty state before a search names what to search by', () => {
    mockLookup();
    renderWithClient(<StaffCustomersPage />);
    expect(screen.getByText('Search by mobile number or email.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Register walk-in customer/ })).toHaveAttribute(
      'href',
      '/staff/customers/new',
    );
  });

  it('writes the term to the URL on submit; an address is sent as email, a number as mobile', async () => {
    mockLookup();
    renderWithClient(<StaffCustomersPage />);
    await userEvent.type(screen.getByLabelText('Mobile number or email'), 'a@b.com{Enter}');
    expect(nav.replace).toHaveBeenLastCalledWith(expect.stringContaining('q=a%40b.com'), expect.anything());
  });

  it('email term -> email param; mobile term -> mobile param; selecting sets ?customer=', async () => {
    const seen = mockLookup();
    nav.search = 'q=a%40b.com';
    const view = renderWithClient(<StaffCustomersPage />);
    await screen.findByRole('button', { name: /Nusrat Jahan/ });
    expect(seen.at(-1)).toBe('?email=a%40b.com');
    view.unmount();

    nav.search = 'q=01711000001';
    renderWithClient(<StaffCustomersPage />);
    const result = await screen.findByRole('button', { name: /Nusrat Jahan/ });
    await waitFor(() => expect(seen.at(-1)).toBe('?mobile=01711000001'));
    await userEvent.click(result);
    expect(nav.replace).toHaveBeenLastCalledWith(
      expect.stringContaining('customer=c1'),
      expect.anything(),
    );
  });

  it('the selected profile has Orders and Billing tabs only, "New order" to the counter, and erase for an Administrator', async () => {
    mockLookup();
    nav.search = 'q=01711000001&customer=c1';
    renderWithClient(<StaffCustomersPage />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Nusrat Jahan' })).toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: 'Customer details' });
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Orders', 'Billing']);
    expect(screen.queryByRole('tab', { name: /Subscriptions|Notes/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New order' })).toHaveAttribute(
      'href',
      '/staff/pos?customerId=c1',
    );
    expect(screen.getByRole('link', { name: 'Review duplicates' })).toHaveAttribute(
      'href',
      '/staff/customers/duplicates',
    );
    expect(await screen.findByText(/erase/i, { selector: 'h2, h3' })).toBeInTheDocument();
  });

  it('no erase panel for a role other than Administrator', async () => {
    mockLookup();
    server.use(
      http.get('*/api/staff/session', () =>
        HttpResponse.json({ ...ADMIN_SESSION, roleIds: ['Reception'] }),
      ),
    );
    nav.search = 'q=01711000001&customer=c1';
    renderWithClient(<StaffCustomersPage />);
    await screen.findByRole('heading', { level: 2, name: 'Nusrat Jahan' });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Orders' })).toBeInTheDocument());
    expect(screen.queryByText(/erase/i, { selector: 'h2, h3' })).not.toBeInTheDocument();
  });
});
