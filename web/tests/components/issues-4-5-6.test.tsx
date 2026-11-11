/* eslint-disable @next/next/no-html-link-for-pages -- plain <a> on purpose: the bar must catch any internal link. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { withCustomerNext } from '@/lib/routing/portal-links';
import { RegistrationSuccess } from '@/components/auth/RegistrationSuccess';

let pathname = '/shop';
let search = '';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('Issues.md #6 — NavigationProgress', () => {
  beforeEach(() => {
    pathname = '/shop';
    search = '';
    window.history.replaceState(null, '', '/shop');
  });

  async function renderBar() {
    const { NavigationProgress } = await import('@/components/common/NavigationProgress');
    const view = render(
      <>
        <NavigationProgress />
        <a href="/shop/products">Products</a>
        <a href="/shop">This page</a>
        <a href="https://example.com/">Elsewhere</a>
        <a href="/cart" target="_blank">
          New tab
        </a>
      </>,
    );
    return { ...view, NavigationProgress };
  }

  it('shows the bar when an internal link is clicked, even if the link cancels the click', async () => {
    await renderBar();
    const link = screen.getByText('Products');
    // next/link calls preventDefault to navigate client-side; the bar must still start.
    link.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(link);
    expect(screen.getByTestId('navigation-progress')).toBeInTheDocument();
  });

  it('ignores same-page, external, new-tab and modified clicks', async () => {
    await renderBar();
    for (const name of ['This page', 'Elsewhere', 'New tab']) {
      const link = screen.getByText(name);
      link.addEventListener('click', (e) => e.preventDefault());
      fireEvent.click(link);
    }
    const products = screen.getByText('Products');
    products.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(products, { ctrlKey: true });
    expect(screen.queryByTestId('navigation-progress')).not.toBeInTheDocument();
  });

  it('hides the bar once the new route renders', async () => {
    const { rerender, NavigationProgress } = await renderBar();
    const link = screen.getByText('Products');
    link.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(link);
    expect(screen.getByTestId('navigation-progress')).toBeInTheDocument();
    pathname = '/shop/products';
    rerender(<NavigationProgress />);
    expect(screen.queryByTestId('navigation-progress')).not.toBeInTheDocument();
  });

  it('startNavigationProgress() starts it for a button-driven router.push', async () => {
    const { startNavigationProgress } = await import('@/components/common/NavigationProgress');
    await renderBar();
    act(() => startNavigationProgress());
    expect(screen.getByTestId('navigation-progress')).toBeInTheDocument();
  });
});

describe('NavigationProgress — a click before the component has mounted', () => {
  beforeEach(() => {
    pathname = '/shop';
    search = '';
    window.history.replaceState(null, '', '/shop');
    vi.resetModules(); // fresh module state (and fresh listeners) for each case
    document.body.innerHTML =
      '<a href="/shop/products">Products</a><a href="https://example.com/">Elsewhere</a>';
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  async function load() {
    return import('@/components/common/NavigationProgress');
  }

  it('shows the bar on mount after an internal link was clicked before render', async () => {
    const { NavigationProgress } = await load();
    fireEvent.click(screen.getByText('Products'));
    render(<NavigationProgress />);
    expect(screen.getByTestId('navigation-progress')).toBeInTheDocument();
  });

  it('shows no bar after an external link or a modified click before render', async () => {
    const { NavigationProgress } = await load();
    fireEvent.click(screen.getByText('Elsewhere'));
    fireEvent.click(screen.getByText('Products'), { ctrlKey: true });
    render(<NavigationProgress />);
    expect(screen.queryByTestId('navigation-progress')).not.toBeInTheDocument();
  });

  it('ignores a pre-mount start older than 2 seconds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { NavigationProgress } = await load();
    fireEvent.click(screen.getByText('Products'));
    vi.setSystemTime(Date.now() + 2_500);
    render(<NavigationProgress />);
    expect(screen.queryByTestId('navigation-progress')).not.toBeInTheDocument();
  });

  it('uses the pre-mount start only once', async () => {
    const { NavigationProgress } = await load();
    fireEvent.click(screen.getByText('Products'));
    const first = render(<NavigationProgress />);
    expect(screen.getByTestId('navigation-progress')).toBeInTheDocument();
    first.unmount();
    render(<NavigationProgress />);
    expect(screen.queryByTestId('navigation-progress')).not.toBeInTheDocument();
  });
});

describe('Issues.md #5 — sign-up from the checkout sign-in', () => {
  beforeEach(() => {
    pathname = '/sign-in';
    search = 'next=%2Fcheckout';
  });

  it('withCustomerNext keeps an allowed return path and drops anything else', () => {
    expect(withCustomerNext('/register', '/checkout')).toBe('/register?next=%2Fcheckout');
    expect(withCustomerNext('/register', null)).toBe('/register');
    expect(withCustomerNext('/register', '//evil.example')).toBe('/register');
    expect(withCustomerNext('/register', '/staff/billing')).toBe('/register');
  });

  it('the sign-in page offers "Create an account", carrying ?next=', async () => {
    const { default: SignInPage } = await import('@/app/(auth)/sign-in/page');
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SignInPage />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/register?next=%2Fcheckout',
    );
  });

  it('after registering, "Sign in" returns to the same place', () => {
    render(<RegistrationSuccess signInHref="/sign-in?next=%2Fcheckout" />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in?next=%2Fcheckout',
    );
  });
});
