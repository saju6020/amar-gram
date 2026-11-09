import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { billingIds, resetBillingMockData } from '../../../mocks/handlers/billing';
import { cashUpFor } from '../../../mocks/handlers/billing/store';
import { BillingNav } from '@/components/billing/BillingNav';
import { CashUpScreen } from '@/components/billing/CashUpScreen';
import { BranchTable } from '@/components/branches/BranchTable';
import { StaffAccountTable } from '@/components/admin/StaffAccountTable';
import { SettingsHub } from '@/components/back-office-admin/SettingsHub';
import type { AdminBranch } from '@/lib/api/admin-branches';
import { setUrl } from '../common/nav-mock';
import { todayInZone } from '@/lib/format/time';

vi.mock('next/navigation', () => import('../common/nav-mock'));

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('BillingNav — U34 (HO-P4 §11.6.1)', () => {
  it('orders Approvals, Cash-up, Invoices first, as link tabs with the current one marked', () => {
    setUrl('/staff/billing/cash-up');
    render(<BillingNav roleIds={['Accountant']} />);
    const nav = screen.getByRole('navigation', { name: 'Billing' });
    expect(within(nav).queryAllByRole('tab')).toHaveLength(0);
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Approvals',
      'Cash-up',
      'Invoices',
      'Overview',
      'Payments',
      'Receivables',
      'COD',
      'Bank',
      'Export',
    ]);
    expect(within(nav).getByRole('link', { name: 'Cash-up' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('hides the accounts-only links from a role that cannot use them (presentation only)', () => {
    setUrl('/staff/billing');
    render(<BillingNav roleIds={['Reception']} />);
    const names = screen.getAllByRole('link').map((a) => a.textContent);
    expect(names).toEqual(['Cash-up', 'Invoices', 'Overview', 'Payments', 'Receivables']);
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('CashUpScreen — U36 (HO-P4 §11.6.3)', () => {
  beforeEach(() => {
    resetBillingMockData();
  });

  // HO-P5 §11.5.5: with an empty `sources` the HO-P4 single input remains, and this case (HO-P4 U36) still passes unchanged.
  it('lists the server lines by source in one panel, with the count form and the close action', async () => {
    server.use(
      http.get('*/api/staff/billing/cash-ups/:date', ({ params }) =>
        HttpResponse.json({ ...cashUpFor(params.date as string, billingIds.mainBranchId), sources: [] }),
      ),
    );
    setUrl(`/staff/billing/cash-up?date=${todayInZone('Asia/Dhaka')}`);
    renderWithClient(<CashUpScreen />);
    const region = await screen.findByRole('region', { name: 'Cash-up lines by source' });
    const table = within(region).getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Source' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Collected by' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Amount' })).toBeInTheDocument();
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
    expect(screen.getByRole('heading', { name: /^End-of-day cash-up/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Counted cash/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close day' })).toBeInTheDocument();
  });
});

describe('BranchTable — U38 (HO-P4 §11.6.7), U43 (HO-P5 §11.5.6)', () => {
  const branches: AdminBranch[] = [
    {
      id: 'b1',
      code: 'MAIN',
      name: 'Dhanmondi outlet',
      timeZoneId: 'Asia/Dhaka',
      isActive: true,
      addressLine: '12 Gulshan Avenue, Dhaka',
      phoneNumber: null,
      email: null,
      weeklyHours: [],
      type: 'Outlet',
      todayHours: { date: '2026-11-03', isOpenToday: true, summary: '09:00-13:00, 14:00-18:00', intervals: [] },
      deliveryAreas: ['Dhaka City', 'Narayanganj'],
      activeStaffCount: 9,
    },
    {
      id: 'b2',
      code: 'CTG',
      name: 'Chattogram warehouse',
      timeZoneId: 'Asia/Dhaka',
      isActive: false,
      addressLine: null,
      phoneNumber: null,
      email: null,
      weeklyHours: [],
      type: 'Warehouse',
      todayHours: { date: '2026-11-03', isOpenToday: false, summary: 'Closed', intervals: [] },
      deliveryAreas: [],
      activeStaffCount: 1,
    },
  ];

  it('renders one card per branch with its five links, and the type, address, today\'s hours, delivery areas and staff count the server sends', () => {
    render(
      <BranchTable branches={branches} isLoading={false} isError={false} onRetry={vi.fn()} canCreate />,
    );
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);
    const first = cards[0]!;
    expect(within(first).getByRole('heading', { name: 'Dhanmondi outlet' })).toBeInTheDocument();
    expect(within(first).getByText('Active')).toBeInTheDocument();
    expect(within(cards[1]!).getByText('Inactive')).toBeInTheDocument();
    const hrefs = within(first)
      .getAllByRole('link')
      .map((a) => [a.textContent?.trim(), a.getAttribute('href')]);
    expect(hrefs).toEqual([
      ['Edit Dhanmondi outlet', '/staff/admin/branches/b1'],
      ['Hours Dhanmondi outlet', '/staff/admin/branches/b1/hours'],
      ['Holidays & closures Dhanmondi outlet', '/staff/admin/branches/b1/closures'],
      ['Calendar Dhanmondi outlet', '/staff/admin/branches/b1/calendar'],
      ['Roster Dhanmondi outlet', '/staff/admin/branches/b1/roster'],
    ]);
    // U43 (supersedes the HO-P4 "no address or staff count" assertion): each is there, as the server sent it.
    expect(within(first).getByText('Outlet')).toBeInTheDocument();
    expect(within(first).getByText('12 Gulshan Avenue, Dhaka')).toBeInTheDocument();
    expect(within(first).getByText('Today')).toBeInTheDocument();
    expect(within(first).getByText('09:00-13:00, 14:00-18:00')).toBeInTheDocument();
    expect(within(first).getByText('Dhaka City, Narayanganj')).toBeInTheDocument();
    expect(within(first).getByText('9 staff')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Add outlet/ })).toHaveAttribute('href', '/staff/admin/branches/new');
  });

  it('shows a Warehouse pill, the server\'s "Closed", and leaves out "Delivers to" and the address when there are none', () => {
    render(<BranchTable branches={branches} isLoading={false} isError={false} onRetry={vi.fn()} canCreate />);
    const second = screen.getAllByRole('article')[1]!;
    expect(within(second).getByText('Warehouse')).toBeInTheDocument();
    expect(within(second).getByText('Closed')).toBeInTheDocument();
    expect(within(second).queryByText('Delivers to')).not.toBeInTheDocument();
    expect(within(second).getByText('1 staff')).toBeInTheDocument();
  });

  it('hides "Add outlet" from a caller who cannot create branches and shows the empty state', () => {
    render(<BranchTable branches={[]} isLoading={false} isError={false} onRetry={vi.fn()} canCreate={false} />);
    expect(screen.queryByRole('link', { name: /Add outlet/ })).not.toBeInTheDocument();
    expect(screen.getByText('No branches yet')).toBeInTheDocument();
  });
});

describe('StaffAccountTable — U39 (HO-P4 §11.6.8), U44 (HO-P5 §11.5.7)', () => {
  it('lists the role ids the catalogue returned, not the design roles; the Outlet column puts the primary first; the status is the server\'s', () => {
    setUrl('/staff/admin/staff-accounts');
    render(
      <StaffAccountTable
        rows={[
          {
            id: 's1',
            fullName: 'Rina Das',
            mobileNumber: '01711111111',
            emailAddress: 'rina@example.com',
            roleIds: ['Reception'],
            hasPassword: true,
            status: 'Active',
            branches: [
              { id: 'b1', name: 'Dhanmondi outlet', isPrimary: true },
              { id: 'b2', name: 'Chattogram warehouse', isPrimary: false },
            ],
          },
          {
            id: 's2',
            fullName: 'New Cashier',
            mobileNumber: null,
            emailAddress: null,
            roleIds: ['Inventory'],
            hasPassword: false,
            status: 'NotSetUp',
            branches: [],
          },
          {
            id: 's3',
            fullName: 'Locked Out',
            mobileNumber: null,
            emailAddress: 'locked@example.com',
            roleIds: ['Accountant'],
            // A password is set, so the old hasPassword rule would have said Active: the server says Locked.
            hasPassword: true,
            status: 'Locked',
            branches: [{ id: 'b1', name: 'Dhanmondi outlet', isPrimary: true }],
          },
        ]}
        totalCount={3}
        pageSize={20}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        roleIds={['Administrator', 'Reception', 'Inventory', 'ShopManager', 'Accountant']}
        roleFilter=""
        onRoleFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Roles: Administrator · Reception · Inventory · ShopManager · Accountant.')).toBeInTheDocument();
    expect(screen.queryByText(/Cashier \(|Packer|Stock keeper|Rider/)).not.toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Not set up')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Sign-in IDs' })).toBeInTheDocument();
    // U44 (supersedes "no Outlet column"): the primary outlet first, marked, then the others; none reads as a dash.
    expect(screen.getByRole('columnheader', { name: 'Outlet' })).toBeInTheDocument();
    const rina = screen.getByRole('row', { name: /Rina Das/ });
    expect(rina).toHaveTextContent('Dhanmondi outlet (primary)Chattogram warehouse');
    expect(within(screen.getByRole('row', { name: /New Cashier/ })).getAllByText('—').length).toBeGreaterThan(0);
    // The name link stays unique (specs find the row by it); the Edit link is described by the name.
    expect(screen.getAllByRole('link', { name: /Rina Das/ })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Edit' })).toHaveLength(3);
  });
});

describe('SettingsHub — U40 (HO-P4 §11.6.10)', () => {
  it('links each card to where the setting lives and shows the maintenance state it is given', () => {
    render(<SettingsHub maintenance="on" />);
    const hrefOf = (name: string) => screen.getByRole('link', { name }).getAttribute('href');
    expect(hrefOf('Delivery zones')).toBe('/staff/admin/delivery-zones');
    expect(hrefOf('Payment settings')).toBe('/staff/admin/payment-settings');
    expect(hrefOf('Message templates')).toBe('/staff/admin/notification-templates');
    expect(hrefOf('Maintenance switch')).toBe('/staff/admin/system');
    expect(screen.getByText('On')).toBeInTheDocument();
  });

  it('says so when the maintenance state is unavailable instead of guessing', () => {
    render(<SettingsHub maintenance="unavailable" />);
    expect(screen.getByText('Status unavailable')).toBeInTheDocument();
  });
});
