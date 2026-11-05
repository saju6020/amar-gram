import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetShopMockData, shopFixtureIds } from '@/mocks/handlers/shop';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { renderWithClient, signInForTest, signOutForTest } from '../product/test-utils';
import { ProductCard } from '@/components/catalogue/ProductCard';
import { makeItem } from './catalogue-fixtures';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push }),
  usePathname: () => '/shop/products',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  resetShopMockData();
  push.mockClear();
  signOutForTest();
});

describe('ProductCard — HO-SHP-002 §11.2', () => {
  it('U-A3: varying price, out of stock, rated, no image URL', () => {
    renderWithClient(
      <ProductCard
        item={makeItem({
          priceVaries: true,
          availability: 'OutOfStock',
          kind: 'Bundle',
        })}
      />,
    );
    const card = within(screen.getByRole('article'));
    // "From" is a small label beside the amount (owner review 2026-11-05); the line still reads "From ৳650.00".
    expect(
      card.getByText((_, element) => element?.tagName === 'P' && element.textContent === 'From ৳650.00'),
    ).toBeInTheDocument();
    expect(card.getByText('Out of stock')).toBeInTheDocument();
    expect(card.getByText('4.5 out of 5 (23 reviews)')).toBeInTheDocument();
    expect(card.getByText('Kit')).toBeInTheDocument();
    // No photo URL: the tinted pack drawing stands in, named by the API's alt text.
    expect(card.getByRole('img', { name: 'Organic Rolled Oats bag' })).toBeInTheDocument();
    expect(card.getByRole('heading', { level: 2 })).toHaveTextContent('Organic Rolled Oats');
    expect(card.getByRole('link', { name: 'Organic Rolled Oats' })).toHaveAttribute(
      'href',
      '/shop/products/organic-rolled-oats',
    );
  });

  it('renders names and brands as text, never markup', () => {
    renderWithClient(
      <ProductCard item={makeItem({ name: '<b>Bold</b> food', brand: '<i>x</i>' })} />,
    );
    expect(screen.getByText('<b>Bold</b> food')).toBeInTheDocument();
    expect(document.querySelector('article b, article i')).toBeNull();
  });

  it('carries the content language on the product link', () => {
    renderWithClient(<ProductCard item={makeItem()} lang="bn" />);
    expect(screen.getByRole('link', { name: 'Organic Rolled Oats' })).toHaveAttribute(
      'href',
      '/shop/products/organic-rolled-oats?lang=bn',
    );
  });
});

describe('ProductCard — wishlist heart and Add (owner decision 2026-10-16)', () => {
  const single = () =>
    makeItem({
      productId: 'p-2',
      slug: shopFixtureIds.thaiRiceSlug,
      name: 'Thai Jasmine Rice',
    });

  it('shows the 44px wishlist heart; a guest is sent to sign in and back to the product', async () => {
    renderWithClient(<ProductCard item={single()} />);
    const heart = await screen.findByRole('link', {
      name: 'Save Thai Jasmine Rice to wishlist: sign in first',
    });
    expect(heart).toHaveAttribute(
      'href',
      `/sign-in?next=${encodeURIComponent(`/shop/products/${shopFixtureIds.thaiRiceSlug}`)}`,
    );
    expect(heart).toHaveClass('size-11');
  });

  it('a signed-in customer toggles the heart (aria-pressed) for a single-size product', async () => {
    const user = userEvent.setup();
    signInForTest();
    renderWithClient(<ProductCard item={single()} />);
    const heart = await screen.findByRole('button', {
      name: 'Save Thai Jasmine Rice to wishlist',
    });
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    await user.click(heart);
    await waitFor(() => expect(heart).toHaveAttribute('aria-pressed', 'true'));
    await user.click(heart);
    await waitFor(() => expect(heart).toHaveAttribute('aria-pressed', 'false'));
  });

  it('Add puts a single-size product straight in the basket', async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductCard item={single()} />);
    await user.click(screen.getByRole('button', { name: 'Add Thai Jasmine Rice to basket' }));
    // No visible note (owner, 2026-10-18): only a screen-reader announcement, and no View basket link.
    expect(await screen.findByText(/Added Thai Jasmine Rice to your basket/)).toHaveClass(
      'sr-only',
    );
    expect(screen.queryByRole('link', { name: 'View basket' })).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('Add on a product sold in several sizes opens the product page to choose', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ProductCard
        item={makeItem({ slug: shopFixtureIds.multiVariantSlug, priceVaries: true })}
        lang="bn"
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Add Organic Rolled Oats: choose options' }),
    );
    expect(push).toHaveBeenCalledWith('/shop/products/organic-rolled-oats?lang=bn');
  });

  it('an out-of-stock card offers Alert me (the stock alert) instead of Add', () => {
    renderWithClient(<ProductCard item={makeItem({ availability: 'OutOfStock' })} />);
    expect(screen.queryByRole('button', { name: /^Add / })).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Tell me when Organic Rolled Oats is back' }),
    ).toHaveAttribute('href', '/shop/products/organic-rolled-oats#stock-alert');
  });
});

// One card per size (owner, 2026-10-18).
describe('ProductCard — one card per size', () => {
  function serveCart(lines: Array<{ skuId: string; productId: string; quantity: number }>) {
    server.use(
      http.get('*/api/cart', () =>
        HttpResponse.json({
          cartId: 'cart-1',
          lines: lines.map((l, i) => ({ lineId: `l${i}`, ...l })),
          itemCount: lines.reduce((s, l) => s + l.quantity, 0),
          subtotal: { amount: '0.00', currencyCode: 'BDT' },
          maxQuantityPerLine: 10,
          guestCartPending: false,
        }),
      ),
    );
  }

  it('shows the size under the name, links to that size, and reads "<name> · <size>"', () => {
    serveCart([]);
    renderWithClient(<ProductCard item={makeItem({ skuId: 'sku-1kg', sizeLabel: '1 kg' })} />);
    const card = within(screen.getByRole('article'));
    expect(card.getByText('1 kg')).toBeInTheDocument();
    const link = card.getByRole('link', { name: /Organic Rolled Oats\s*·\s*1 kg/ });
    expect(link.getAttribute('href')).toContain('sku=sku-1kg');
  });

  it('Add puts exactly that size in the cart, without opening the product page', async () => {
    serveCart([]);
    const posted: unknown[] = [];
    server.use(
      http.post('*/api/cart/lines', async ({ request }) => {
        posted.push(await request.json());
        return HttpResponse.json({ lineId: 'l1' });
      }),
    );
    renderWithClient(
      <ProductCard item={makeItem({ skuId: 'sku-1kg', sizeLabel: '1 kg', priceVaries: false })} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /^Add Organic Rolled Oats · 1 kg to basket/ }),
    );
    await waitFor(() => expect(posted).toEqual([{ skuId: 'sku-1kg', quantity: 1 }]));
    expect(push).not.toHaveBeenCalled();
  });

  it('U5: a size in the basket shows a stepper instead of Add; + updates the line, price stays fromPrice', async () => {
    serveCart([
      { skuId: 'sku-1kg', productId: 'p1', quantity: 2 },
      { skuId: 'sku-other', productId: 'p1', quantity: 5 },
    ]);
    const puts: Array<{ url: string; body: unknown }> = [];
    server.use(
      http.put('*/api/cart/lines/:lineId', async ({ request, params }) => {
        puts.push({ url: String(params.lineId), body: await request.json() });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithClient(<ProductCard item={makeItem({ skuId: 'sku-1kg', sizeLabel: '1 kg' })} />);
    const more = await screen.findByRole('button', { name: 'One more Organic Rolled Oats · 1 kg' });
    expect(
      screen.getByRole('button', { name: 'One less Organic Rolled Oats · 1 kg' }),
    ).toBeVisible();
    expect(screen.getByTestId('stepper-value')).toHaveTextContent('2');
    expect(screen.getByText('In basket')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add / })).not.toBeInTheDocument();
    expect(screen.getByText('৳650.00')).toBeInTheDocument();
    await userEvent.click(more);
    await waitFor(() => expect(puts).toEqual([{ url: 'l0', body: { quantity: 3 } }]));
  });

  it('U5: at 1, "one less" removes the line and announces it', async () => {
    serveCart([{ skuId: 'sku-1kg', productId: 'p1', quantity: 1 }]);
    const removed: string[] = [];
    server.use(
      http.delete('*/api/cart/lines/:lineId', ({ params }) => {
        removed.push(String(params.lineId));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithClient(<ProductCard item={makeItem({ skuId: 'sku-1kg', sizeLabel: '1 kg' })} />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'One less Organic Rolled Oats · 1 kg' }),
    );
    await waitFor(() => expect(removed).toEqual(['l0']));
    expect(
      await screen.findByText('Removed Organic Rolled Oats · 1 kg from your basket.'),
    ).toHaveClass('sr-only');
  });

  it('shows no stepper or tag when this size is not in the basket', async () => {
    serveCart([{ skuId: 'sku-other', productId: 'p1', quantity: 5 }]);
    renderWithClient(<ProductCard item={makeItem({ skuId: 'sku-1kg', sizeLabel: '1 kg' })} />);
    await screen.findByRole('button', { name: /^Add Organic Rolled Oats · 1 kg to basket/ });
    expect(screen.queryByText('In basket')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stepper-value')).not.toBeInTheDocument();
  });

  // HO-P5 S1 U6 supersedes HO-P3 U6 ("no Organic badge: catalogue items carry no certifications yet").
  it('U6: the "Organic" pill shows only when the item is CertifiedOrganic, with the text "Certified organic"', () => {
    serveCart([]);
    const { unmount } = renderWithClient(
      <ProductCard item={makeItem({ skuId: 'sku-1kg', sizeLabel: '1 kg' })} />,
    );
    // Without certifications, and with others but not organic: no pill and no hidden text.
    expect(screen.queryByText(/organic$/i, { selector: 'span' })).not.toBeInTheDocument();
    unmount();
    const other = renderWithClient(
      <ProductCard item={makeItem({ certifications: ['PesticideFree', 'Halal'] })} />,
    );
    expect(screen.queryByText('Organic')).not.toBeInTheDocument();
    expect(screen.queryByText('Certified organic')).not.toBeInTheDocument();
    other.unmount();

    renderWithClient(
      <ProductCard item={makeItem({ certifications: ['CertifiedOrganic', 'Halal'] })} />,
    );
    const card = within(screen.getByRole('article'));
    expect(card.getByText('Organic')).toHaveClass('bg-leaf', 'text-leaf-soft');
    // The card's accessible content says it in full, after the name; the link name is unchanged.
    expect(card.getByText('Certified organic')).toHaveClass('sr-only');
    expect(card.getByRole('link', { name: 'Organic Rolled Oats' })).toBeInTheDocument();
  });

  it('U5: the eyebrow is the district when present, otherwise the producer and country', () => {
    serveCart([]);
    const { unmount } = renderWithClient(
      <ProductCard item={makeItem({ districtOfOrigin: 'Dinajpur' })} />,
    );
    const eyebrow = screen.getByText('Dinajpur');
    expect(eyebrow.closest('p')).toHaveClass('uppercase');
    // The district replaces the producer line (OQ-5); the text itself is as sent.
    expect(screen.queryByText('Amar Gram Farms · Bangladesh')).not.toBeInTheDocument();
    unmount();
    renderWithClient(<ProductCard item={makeItem({ districtOfOrigin: null })} />);
    expect(screen.getByText('Amar Gram Farms · Bangladesh')).toBeInTheDocument();
  });
});
