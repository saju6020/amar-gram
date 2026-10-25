import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { AccountFrame, AccountPills, AccountSidebar } from '@/components/portal/AccountSidebar';
import { ACCOUNT_GROUPS, activeAccountHref } from '@/components/portal/account-nav';

let pathname = '/portal/orders';
let signedIn = true;
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/hooks/useSession', () => ({
  useCustomerSession: () => ({
    data: signedIn
      ? { customerId: 'c1', fullName: 'Ayesha Rahman', expiresOn: '2030-01-01T00:00:00Z' }
      : null,
  }),
}));

const order = (id: string, status: string) => ({
  id,
  orderNumber: `ORD-${id}`,
  placedOn: '2026-10-16T04:10:00Z',
  status,
  fulfilmentMethod: 'Delivery',
  paymentMethod: 'CashOnDelivery',
  grandTotal: { amount: '100.00', currencyCode: 'BDT' },
  itemCount: 1,
  branchTimeZoneId: 'Asia/Dhaka',
});

function serveAccount() {
  server.use(
    http.get('*/api/customers/me/orders', () =>
      HttpResponse.json({
        items: [order('1', 'Confirmed'), order('2', 'Packing'), order('3', 'Delivered')],
        totalCount: 3,
        pageNumber: 1,
        pageSize: 50,
      }),
    ),
    http.get('*/api/customers/me', () =>
      HttpResponse.json({
        fullName: 'Ayesha Rahman',
        mobileNumber: null,
        emailAddress: 'ayesha@example.com',
        hasMobileNumber: false,
        hasEmailAddress: true,
        canEditEmail: true,
        additionalPhoneNumbers: [],
        registeredOn: '2026-03-02T00:00:00Z',
      }),
    ),
  );
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  pathname = '/portal/orders';
  signedIn = true;
  serveAccount();
});

// Option A "Account sidebar", as the owner approved it on 2026-10-17.
describe('account sidebar', () => {
  it('marks the current page: Overview only on /portal, the longest match elsewhere', () => {
    expect(activeAccountHref('/portal')).toBe('/portal');
    expect(activeAccountHref('/portal/orders/abc')).toBe('/portal/orders');
    expect(activeAccountHref('/portal/reviews/1/edit')).toBe('/portal/reviews');
    expect(activeAccountHref('/portal/account/password')).toBe('/portal/account/profile');
    expect(activeAccountHref('/portal/account/addresses')).toBe('/portal/account/profile');
    expect(activeAccountHref('/portal/unknown/1')).toBeNull();
  });

  // HO-P3 S4 (D-6): the design's flat menu, with the working features it does not show kept.
  it('shows the customer with "Member since 2026", one flat menu in order, and Sign out last', async () => {
    renderWithClient(<AccountSidebar />);
    expect(screen.getByText('Ayesha Rahman')).toBeInTheDocument();
    expect(await screen.findByText('Member since 2026')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent?.replace(/\(.*\)$/, '').replace(/\d+$/, '')),
    ).toEqual(ACCOUNT_GROUPS.flatMap((g) => g.links.map((l) => l.label)));
    expect(
      ACCOUNT_GROUPS.flatMap((g) => g.links.map((l) => l.label)),
    ).toEqual([
      'Overview',
      'My orders',
      'Wishlist',
      'My reviews',
      'Billing',
      'Profile & addresses',
    ]);
    for (const heading of ['Shopping', 'Account'])
      expect(within(nav).queryByText(heading)).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /subscriptions/i })).not.toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('My orders is current and shows how many orders are still on their way', async () => {
    renderWithClient(<AccountSidebar />);
    const orders = screen.getByRole('link', { name: /^My orders/ });
    expect(orders).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(orders).toHaveTextContent('(2 on the way)'), { timeout: 4000 });
  });

  it('on a phone the same pages are a row of pills, starting with My orders', () => {
    renderWithClient(<AccountPills />);
    const links = within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link');
    expect(links).toHaveLength(ACCOUNT_GROUPS.flatMap((g) => g.links).length);
    expect(links[0]).toHaveTextContent('My orders');
    expect(screen.getByRole('link', { name: 'My orders' })).toHaveClass('bg-leaf');
  });

  it('frames /portal pages only, and only when signed in', () => {
    const { unmount } = renderWithClient(<AccountFrame>page</AccountFrame>);
    expect(screen.getAllByRole('navigation', { name: 'Main' }).length).toBeGreaterThan(0);
    unmount();

    for (const [path, inAccount] of [
      ['/cart', true],
      ['/checkout', true],
      ['/portal', false],
    ] as const) {
      pathname = path;
      signedIn = inAccount;
      const view = renderWithClient(<AccountFrame>page</AccountFrame>);
      expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
      expect(screen.getByRole('main')).toHaveTextContent('page');
      view.unmount();
    }
  });
});
