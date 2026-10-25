import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { ShopTopStrip } from '@/components/shop/ShopTopStrip';
import { BannerStrip } from '@/components/shop/BannerStrip';
import { ShopHeader } from '@/components/shop/ShopHeader';
import { MobileTabBar } from '@/components/shop/MobileTabBar';
import { ShopFooter, FOOTER_CONTACT } from '@/components/shop/ShopFooter';
import { ShopAccountLinks } from '@/app/(shop)/_components/ShopAccountLinks';
import { renderWithClient, signInForTest, signOutForTest } from '../product/test-utils';
import type { CategoryNode, StorefrontBanner } from '@/lib/api/shop-catalogue';

/** HO-P3 S0 - U1 (top strip), U2 (header), U3 (phone tab bar), U8 (footer). */

let pathname = '/shop';
let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  pathname = '/shop';
  search = '';
  signOutForTest();
});

const banner = (overrides: Partial<StorefrontBanner> = {}): StorefrontBanner => ({
  slug: 'b1',
  title: 'Fresh mangoes are in season',
  body: 'Order today.',
  placement: 'Shop',
  linkUrl: null,
  ...overrides,
});

const categories = [
  { value: 'RiceAndGrains', productCount: 4, subcategories: [] },
  { value: 'Honey', productCount: 2, subcategories: [] },
] as unknown as CategoryNode[];

function serveCart(itemCount: number) {
  server.use(
    http.get('*/api/cart', () =>
      HttpResponse.json({
        cartId: itemCount ? 'cart-1' : null,
        lines: [],
        itemCount,
        subtotal: { amount: '0.00', currencyCode: 'BDT' },
        maxQuantityPerLine: 10,
        guestCartPending: false,
      }),
    ),
  );
}

describe('ShopTopStrip - U1', () => {
  it('shows the first banner title as plain text, and a link when the banner has a safe link', () => {
    const { rerender } = render(<ShopTopStrip banner={banner()} />);
    expect(screen.getByText('Fresh mangoes are in season')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    rerender(<ShopTopStrip banner={banner({ linkUrl: '/shop/products' })} />);
    expect(screen.getByRole('link', { name: 'Fresh mangoes are in season' })).toHaveAttribute(
      'href',
      '/shop/products',
    );
  });

  it('renders nothing without a banner, and never links an unsafe address', () => {
    const { container, rerender } = render(<ShopTopStrip banner={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ShopTopStrip banner={banner({ linkUrl: 'javascript:alert(1)' })} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('BannerStrip shows only the banners it is given (the layout passes the rest)', () => {
    const rest = [banner({ slug: 'b2', title: 'Second banner' })];
    render(<BannerStrip banners={rest} />);
    expect(screen.getByText('Second banner')).toBeInTheDocument();
    expect(screen.queryByText('Fresh mangoes are in season')).not.toBeInTheDocument();
  });
});

describe('ShopHeader - U2', () => {
  it('has the logo to /shop, a search labelled "Search the shop", Sign in and a named basket pill', async () => {
    serveCart(3);
    renderWithClient(<ShopHeader categories={categories} accountSlot={<ShopAccountLinks />} />);
    expect(screen.getByRole('link', { name: /Amar Gram/ })).toHaveAttribute('href', '/shop');
    const searchForm = screen.getByRole('search', { name: 'Products' });
    expect(within(searchForm).getByLabelText('Search the shop')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in?next=%2Fshop',
    );
    const basket = await screen.findByRole('link', { name: 'Basket, 3 items' });
    expect(basket).toHaveAttribute('href', '/cart');
  });

  it('shows the customer name once signed in', async () => {
    serveCart(0);
    signInForTest();
    renderWithClient(<ShopHeader categories={categories} accountSlot={<ShopAccountLinks />} />);
    expect(await screen.findByRole('link', { name: 'Test' })).toHaveAttribute(
      'href',
      '/portal/orders',
    );
    expect(screen.getByRole('link', { name: 'Basket' })).toBeInTheDocument();
  });

  it('marks the active category pill with aria-current and no other pill', () => {
    pathname = '/shop/products';
    search = 'category=Honey';
    serveCart(0);
    renderWithClient(<ShopHeader categories={categories} accountSlot={<ShopAccountLinks />} />);
    const nav = screen.getByRole('navigation', { name: 'Shop categories' });
    const links = within(nav).getAllByRole('link', { hidden: true });
    const current = links.filter((link) => link.getAttribute('aria-current') === 'page');
    // The pills are rendered for both the phone disclosure and the desktop row.
    expect(current.length).toBeGreaterThanOrEqual(1);
    for (const link of current) expect(link).toHaveTextContent('Honey');
  });
});

describe('MobileTabBar - U3', () => {
  it.each([
    ['/shop', 'Home'],
    ['/shop/products', 'Shop'],
    ['/shop/products/organic-rolled-oats', 'Shop'],
  ])('on %s the current tab is %s and no other is current', (path, label) => {
    pathname = path;
    renderWithClient(<MobileTabBar />);
    const nav = screen.getByRole('navigation', { name: 'Shop sections' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Home', 'Shop', 'Basket', 'Account']);
    const current = links.filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(label);
    expect(links.map((link) => link.getAttribute('href')).slice(0, 3)).toEqual([
      '/shop',
      '/shop/products',
      '/cart',
    ]);
  });

  it('is not rendered on /cart', () => {
    pathname = '/cart';
    const { container } = renderWithClient(<MobileTabBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Account goes to sign-in for a guest', () => {
    renderWithClient(<MobileTabBar />);
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/sign-in');
  });

  it('Account goes to /portal once a customer session is present', async () => {
    signInForTest();
    renderWithClient(<MobileTabBar />);
    await vi.waitFor(() =>
      expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/portal'),
    );
  });
});

describe('ShopFooter - U8', () => {
  it('links to the catalogue, countries, FAQs and terms, and shows the placeholder contact column', () => {
    render(
      <ShopFooter
        links={[
          { label: 'FAQs', href: '/faqs' },
          { label: 'Terms', href: '/policies/terms' },
        ]}
      />,
    );
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
      .filter((href) => !href?.startsWith('tel:') && !href?.startsWith('mailto:'));
    expect(hrefs).toEqual(['/shop/products', '/shop/countries', '/faqs', '/policies/terms']);
    // Owner, 2026-10-25 (OQ-3): placeholder contact details until the owner replaces them.
    expect(FOOTER_CONTACT.phoneDisplay).toBe('+880 1711-000100');
    expect(FOOTER_CONTACT.email).toBe('hello@amargram.example');
    expect(screen.getByRole('link', { name: '+880 1711-000100' })).toHaveAttribute(
      'href',
      'tel:+8801711000100',
    );
    expect(screen.getByRole('link', { name: 'hello@amargram.example' })).toHaveAttribute(
      'href',
      'mailto:hello@amargram.example',
    );
    expect(document.body.textContent).not.toMatch(/\[PHONE\]|\[EMAIL\]/);
  });
});
