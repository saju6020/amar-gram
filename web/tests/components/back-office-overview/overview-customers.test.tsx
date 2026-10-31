import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { resetReportsMockData } from '@/mocks/handlers/reports';
import StaffCustomersPage from '@/app/(staff)/staff/customers/page';
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
