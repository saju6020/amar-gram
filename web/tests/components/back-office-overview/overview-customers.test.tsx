import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
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

// HO-P5 §15 U37 / U38: supersedes HO-P4 U16 (the exact mobile/email lookup on this screen) and U17 ("no Notes tab"). The POS
// customer panel still uses `findCustomers`; this screen browses.
describe('Customers screen — U37 browse, U38 profile summary', () => {
  const item = {
    id: 'c1',
    fullName: 'Nusrat Jahan',
    mobileNumber: '01711000001',
    emailAddress: 'nusrat@example.com',
    recordStatus: 'Complete',
    status: 'Active',
    customerSince: '2026-03-14T09:30:00Z',
    area: 'Dhanmondi',
    tags: ['Regular', 'Wholesale'],
  };
  const detail = {
    ...item,
    registrationChannel: 'Reception',
    mergedIntoCustomerId: null,
    orderCount: 7,
    lifetimeSpend: { amount: '12500.00', currencyCode: 'BDT' },
    noteCount: 2,
  };

  function mockBrowse(items: unknown[] = [item], totalCount = items.length) {
    const seen: string[] = [];
    server.use(
      http.get('*/api/staff/session', () => HttpResponse.json(ADMIN_SESSION)),
      http.get('*/api/staff/customers/c1', () => HttpResponse.json(detail)),
      http.get('*/api/staff/customers/c1/notes', () => HttpResponse.json([])),
      http.get('*/api/staff/customers/browse', ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json({ items, pageNumber: 1, pageSize: 20, totalCount });
      }),
    );
    return seen;
  }

  it('lists customers with no search first, and offers walk-in registration', async () => {
    const seen = mockBrowse();
    renderWithClient(<StaffCustomersPage />);
    expect(await screen.findByRole('button', { name: /Nusrat Jahan/ })).toBeInTheDocument();
    expect(seen.at(-1)).toBe('?sort=recent&pageNumber=1&pageSize=20');
    expect(screen.getByRole('link', { name: /Register walk-in customer/ })).toHaveAttribute(
      'href',
      '/staff/customers/new',
    );
    // The row: mobile, area and tags are text.
    const row = screen.getByRole('button', { name: /Nusrat Jahan/ });
    expect(within(row).getByText(/01711000001 · Dhanmondi/)).toBeInTheDocument();
    expect(within(row).getByText('Regular')).toBeInTheDocument();
  });

  it('says so when no customer matches', async () => {
    mockBrowse([], 0);
    nav.search = 'search=Zed';
    renderWithClient(<StaffCustomersPage />);
    expect(await screen.findByText('No customer matches')).toBeInTheDocument();
  });

  it('writes the term to the URL on submit, as search, and drops the selection', async () => {
    mockBrowse();
    nav.search = 'customer=c1';
    renderWithClient(<StaffCustomersPage />);
    await userEvent.type(await screen.findByLabelText('Name, mobile or email'), 'Rahman{Enter}');
    expect(nav.replace).toHaveBeenLastCalledWith(expect.stringContaining('search=Rahman'), expect.anything());
    expect(nav.replace).toHaveBeenLastCalledWith(expect.not.stringContaining('customer='), expect.anything());
  });

  it('sends search, tag, sort and page to browse; the tag and sort controls write the URL', async () => {
    const seen = mockBrowse();
    nav.search = 'search=Rahman&tag=Regular&sort=name&page=2';
    renderWithClient(<StaffCustomersPage />);
    await screen.findByRole('button', { name: /Nusrat Jahan/ });
    expect(seen.at(-1)).toBe('?search=Rahman&tag=Regular&sort=name&pageNumber=2&pageSize=20');

    expect(screen.getByLabelText('Name, mobile or email')).toHaveValue('Rahman');
    expect(screen.getByLabelText('Sort by')).toHaveValue('name');
    // The tag filter offers the tags seen and the one in the URL.
    const tagSelect = screen.getByLabelText('Tag');
    expect(within(tagSelect).getAllByRole('option').map((o) => o.textContent)).toEqual(['All customers', 'Regular', 'Wholesale']);

    await userEvent.selectOptions(tagSelect, 'Wholesale');
    expect(nav.replace).toHaveBeenLastCalledWith(expect.stringContaining('tag=Wholesale'), expect.anything());
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'recent');
    expect(nav.replace).toHaveBeenLastCalledWith(expect.not.stringContaining('sort='), expect.anything());
  });

  it('pages the list: Next writes page, and shows where you are', async () => {
    mockBrowse([item], 45);
    renderWithClient(<StaffCustomersPage />);
    expect(await screen.findByText(/^Page 1 of 3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    // 44 px targets (HO-P3 UI-6); jsdom has no layout, so the class is the check.
    for (const name of ['Previous', 'Next']) expect(screen.getByRole('button', { name })).toHaveClass('min-h-11');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(nav.replace).toHaveBeenLastCalledWith(expect.stringContaining('page=2'), expect.anything());
  });

  it('selecting a customer sets ?customer=', async () => {
    mockBrowse();
    renderWithClient(<StaffCustomersPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Nusrat Jahan/ }));
    expect(nav.replace).toHaveBeenLastCalledWith(expect.stringContaining('customer=c1'), expect.anything());
  });

  it('the profile shows the server summary, tags and the Orders, Billing and Notes tabs (no Subscriptions)', async () => {
    mockBrowse();
    nav.search = 'customer=c1';
    renderWithClient(<StaffCustomersPage />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Nusrat Jahan' })).toBeInTheDocument();

    // Customer since, Orders and Lifetime spend are KPI tiles; the money is the server's string through Amount.
    expect(await screen.findByRole('heading', { level: 3, name: 'Customer since' })).toBeInTheDocument();
    expect(screen.getByText('14 Mar 2026')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Orders' }).nextElementSibling).toHaveTextContent('7');
    expect(screen.getByRole('heading', { level: 3, name: 'Lifetime spend' }).nextElementSibling).toHaveTextContent(
      '৳12,500.00',
    );
    // Area beside mobile and email.
    expect(screen.getByText('Area')).toBeInTheDocument();
    expect(screen.getAllByText('Dhanmondi').length).toBeGreaterThan(0);
    const tags = screen.getByRole('list', { name: 'Tags' });
    expect(within(tags).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Regular', 'Wholesale']);

    const tabs = screen.getByRole('tablist', { name: 'Customer details' });
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Orders', 'Billing', 'Notes (2)']);
    expect(screen.queryByRole('tab', { name: /Subscriptions/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Subscriber/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New order' })).toHaveAttribute('href', '/staff/pos?customerId=c1');
    expect(screen.getByRole('link', { name: 'Review duplicates' })).toHaveAttribute(
      'href',
      '/staff/customers/duplicates',
    );
    expect(await screen.findByText(/erase/i, { selector: 'h2, h3' })).toBeInTheDocument();
  });

  it('selecting another customer starts a fresh profile: no note draft, no reset result, back on the Orders tab', async () => {
    mockBrowse();
    server.use(
      http.get('*/api/staff/customers/c2', () =>
        HttpResponse.json({ ...detail, id: 'c2', fullName: 'Karim Uddin', mobileNumber: '01711000002', noteCount: 0 }),
      ),
      http.get('*/api/staff/customers/c2/notes', () => HttpResponse.json([])),
      http.post('*/api/staff/customers/c1/password-reset', () =>
        HttpResponse.json({ channel: 'Mobile', maskedDestination: '***001', expiresOn: '2026-10-22T08:15:00Z' }),
      ),
    );
    nav.search = 'customer=c1';
    const view = renderWithClient(<StaffCustomersPage />);
    // The next customer is already cached, so no loading state would otherwise unmount the profile.
    view.client.setQueryData(['staff-customers', 'customer', 'c2'], {
      ...detail,
      id: 'c2',
      fullName: 'Karim Uddin',
      mobileNumber: '01711000002',
      noteCount: 0,
    });
    await userEvent.click(await screen.findByRole('tab', { name: 'Notes (2)' }));
    await userEvent.type(await screen.findByLabelText('Add a note'), 'Only for Nusrat');
    await userEvent.click(screen.getByRole('button', { name: 'Send password reset' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByText(/Reset link sent by mobile to \*\*\*001/)).toBeInTheDocument();

    nav.search = 'customer=c2';
    view.rerender(
      <QueryClientProvider client={view.client}>
        <StaffCustomersPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('heading', { level: 2, name: 'Karim Uddin' })).toBeInTheDocument();
    expect(screen.queryByText(/Reset link sent/)).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Orders', selected: true })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Notes (0)' }));
    expect(await screen.findByLabelText('Add a note')).toHaveValue('');
  });

  it('a page past the end says so and offers the first page', async () => {
    mockBrowse([], 45);
    nav.search = 'page=9';
    renderWithClient(<StaffCustomersPage />);
    expect(await screen.findByText('Nothing on this page')).toBeInTheDocument();
    expect(screen.queryByText('No customers yet')).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Back to the first page' }));
    expect(nav.replace).toHaveBeenLastCalledWith(expect.not.stringContaining('page='), expect.anything());
  });

  it('no erase panel for a role other than Administrator', async () => {
    mockBrowse();
    server.use(
      http.get('*/api/staff/session', () =>
        HttpResponse.json({ ...ADMIN_SESSION, roleIds: ['Reception'] }),
      ),
    );
    nav.search = 'customer=c1';
    renderWithClient(<StaffCustomersPage />);
    await screen.findByRole('heading', { level: 2, name: 'Nusrat Jahan' });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Orders' })).toBeInTheDocument());
    expect(screen.queryByText(/erase/i, { selector: 'h2, h3' })).not.toBeInTheDocument();
  });

  it('a role without the staff-record actions sees the tags but not Edit tags, Add a note or Send password reset', async () => {
    mockBrowse();
    server.use(
      http.get('*/api/staff/session', () =>
        HttpResponse.json({ ...ADMIN_SESSION, roleIds: ['Accountant'] }),
      ),
    );
    nav.search = 'customer=c1';
    renderWithClient(<StaffCustomersPage />);
    await screen.findByRole('heading', { level: 2, name: 'Nusrat Jahan' });
    await screen.findByRole('list', { name: 'Tags' });
    expect(screen.queryByRole('button', { name: 'Edit tags' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send password reset' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Notes/ }));
    await screen.findByText('No notes yet');
    expect(screen.queryByLabelText('Add a note')).not.toBeInTheDocument();
  });
});
