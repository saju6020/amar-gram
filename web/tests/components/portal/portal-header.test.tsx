import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { PortalHeader } from '@/components/common/portal-header';

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

function serveAccount() {
  server.use(
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

describe('customer header — the name menu', () => {
  it('opens on the name, lists My orders, Profile & addresses, Billing, Shop and Sign out, and closes on Escape', async () => {
    const user = userEvent.setup();
    renderWithClient(<PortalHeader />);
    const button = screen.getByRole('button', { name: 'Account menu for Ayesha Rahman' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Profile & addresses' })).not.toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'My orders' })).toHaveAttribute(
      'href',
      '/portal/orders',
    );
    for (const name of ['Profile & addresses', 'Billing'])
      expect(screen.getByRole('link', { name })).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Shop' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeVisible();
    expect(await screen.findByText('ayesha@example.com')).toBeVisible();

    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveFocus();
  });

  it('keeps the product search', () => {
    renderWithClient(<PortalHeader />);
    expect(screen.getByRole('search', { name: 'Products' })).toBeInTheDocument();
  });

  it('U7: on /checkout it is the "Secure checkout" header: no search, basket, inbox or account menu', () => {
    pathname = '/checkout';
    renderWithClient(
      <PortalHeader
        sessionActions={
          <a href="/cart" aria-label="Basket, 1 item">
            basket
          </a>
        }
      />,
    );
    expect(screen.getByText('Secure checkout')).toBeVisible();
    expect(screen.getByRole('link', { name: /Amar Gram/ })).toBeInTheDocument();
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Basket/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Account menu/ })).not.toBeInTheDocument();
  });

  it('U7: on /portal/orders it has the search, the Shop link, the session actions and the account menu', () => {
    renderWithClient(
      <PortalHeader
        sessionActions={
          <a href="/cart" aria-label="Basket, 1 item">
            basket
          </a>
        }
      />,
    );
    expect(screen.getByRole('search', { name: 'Products' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Basket, 1 item' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Shop' })[0]).toHaveAttribute('href', '/shop');
    expect(screen.getByRole('button', { name: /Account menu/ })).toBeInTheDocument();
    expect(screen.queryByText('Secure checkout')).not.toBeInTheDocument();
  });
});
