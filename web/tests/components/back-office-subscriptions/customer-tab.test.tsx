import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { CustomerProfileView } from '@/components/back-office-overview/CustomerProfileView';
import { subscriptionFixtureIds as ids } from '../../../mocks/handlers/subscriptions/fixtures';
import { db, resetSubscriptionsMockData } from '../../../mocks/handlers/subscriptions/store';
import { setMockTouchpointRoles } from '../../../mocks/handlers/subscriptions/touchpoints';
import { renderWithClient } from '../reports/helpers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/staff/customers/x',
  useSearchParams: () => new URLSearchParams(),
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

function customer(id: string) {
  return {
    id,
    fullName: 'Farhana Yasmin',
    mobileNumber: '01711000002',
    emailAddress: 'farhana@example.com',
    recordStatus: 'Complete',
    status: 'Active',
    customerSince: '2026-03-14T09:30:00Z',
    area: 'Dhanmondi',
    tags: [],
    registrationChannel: 'Reception',
    mergedIntoCustomerId: null,
    orderCount: 3,
    lifetimeSpend: { amount: '4200.00', currencyCode: 'BDT' },
    noteCount: 0,
  };
}

function open(id: string) {
  server.use(
    http.get('*/api/staff/session', () => HttpResponse.json(ADMIN_SESSION)),
    http.get(`*/api/staff/customers/${id}`, () => HttpResponse.json(customer(id))),
    http.get(`*/api/staff/customers/${id}/notes`, () => HttpResponse.json([])),
  );
  return renderWithClient(<CustomerProfileView customerId={id} />);
}

beforeEach(() => {
  resetSubscriptionsMockData();
  setMockTouchpointRoles(null);
});

/**
 * U36 (HO-P6 S3, §11.4.3, A16) -- the customer profile's Subscriptions tab: "Subscriptions ({n})" after Orders, the live
 * subscriptions as links to the staff detail, the counts line; a 403 or a failed read means no tab and no banner (ADR-FE-197).
 */
describe('Customer profile -- Subscriptions tab (U36)', () => {
  it('lists the live subscriptions with links to the staff detail, and the counts as text', async () => {
    const user = userEvent.setup();
    const customerId = ids.customerId;
    const mine = db.subscriptions.filter((s) => s.customerId === customerId);
    const live = mine.filter((s) => s.status !== 'Cancelled');
    open(customerId);

    const tabs = await screen.findByRole('tablist', { name: 'Customer details' });
    const tab = await within(tabs).findByRole('tab', { name: `Subscriptions (${live.length})` });
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Orders',
      `Subscriptions (${live.length})`,
      'Billing',
      'Notes (0)',
    ]);
    await user.click(tab);

    const panel = screen.getByRole('tabpanel', { name: 'Subscriptions' });
    const links = within(panel).getAllByRole('link');
    expect(links).toHaveLength(live.length);
    for (const sub of live) {
      expect(links.some((a) => a.getAttribute('href') === `/staff/subscriptions/${sub.id}`)).toBe(true);
    }
    // 44 px targets (jsdom has no layout, so the class is the check).
    for (const link of links) expect(link).toHaveClass('min-h-11');
    const suspended = live.filter((s) => s.status === 'Suspended').length;
    const cancelled = mine.length - live.length;
    expect(panel).toHaveTextContent(`${suspended} suspended · ${cancelled} cancelled`);
    // Status is a word, not colour alone.
    expect(within(panel).getAllByText('Suspended').length).toBeGreaterThan(0);
  });

  it('a customer with none shows "No current subscriptions." and zero counts', async () => {
    const user = userEvent.setup();
    const none = 'c0000000-0000-0000-0000-0000000000f9';
    open(none);
    const tab = await screen.findByRole('tab', { name: 'Subscriptions (0)' });
    await user.click(tab);
    const panel = screen.getByRole('tabpanel', { name: 'Subscriptions' });
    expect(panel).toHaveTextContent('No current subscriptions.');
    expect(panel).toHaveTextContent('0 suspended · 0 cancelled');
  });

  it('a 403 on the subscription read leaves out the tab, with no banner', async () => {
    setMockTouchpointRoles(['Cashier']);
    let settled = 0;
    server.events.on('response:mocked', ({ request }) => {
      if (request.url.endsWith('/subscriptions') && request.url.includes('/customers/')) settled += 1;
    });
    open(ids.customerId);
    const tabs = await screen.findByRole('tablist', { name: 'Customer details' });
    await waitFor(() => expect(settled).toBeGreaterThan(0)); // the refused read has been answered
    await waitFor(() => expect(within(tabs).getAllByRole('tab').length).toBeGreaterThan(0));
    expect(within(tabs).queryByRole('tab', { name: /Subscriptions/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    server.events.removeAllListeners();
  });

  it('a failed read (500) leaves out the tab too', async () => {
    let asked = 0;
    server.use(
      http.get('*/api/staff/customers/:customerId/subscriptions', () => {
        asked += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const { client } = open(ids.customerId);
    const tabs = await screen.findByRole('tablist', { name: 'Customer details' });
    await waitFor(() => expect(asked).toBeGreaterThan(0));
    // The hook retries once; wait until the query has settled in error, then assert.
    await waitFor(() => expect(client.isFetching({ queryKey: ['staff', 'subscriptions'] })).toBe(0), { timeout: 5000 });
    await waitFor(() => expect(client.getQueryCache().find({ queryKey: ['staff', 'subscriptions', 'customer', ids.customerId] })?.state.status).toBe('error'), { timeout: 5000 });
    expect(within(tabs).queryByRole('tab', { name: /Subscriptions/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
