import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { ProductPurchase } from '@/app/(shop)/_components/ProductPurchase';
import { OftenBoughtTogether } from '@/components/recommendations/OftenBoughtTogether';
import { ProductDetailsTabs } from '@/components/product/ProductDetailsTabs';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ProductHeading } from '@/components/product/ProductHeading';
import { resetShopMockData, shopFixtureIds } from '@/mocks/handlers/shop';
import { makeItem } from '../catalogue/catalogue-fixtures';
import { mockDetail, renderWithClient, signOutForTest } from './test-utils';

/**
 * HO-P3 S2 §15 U19 … U22: the product page rebuilt to Product.dc.html - the buy column, the gallery
 * and its badge, the underline tabs and "Goes well with".
 */

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push }),
  usePathname: () => '/shop/products/organic-rolled-oats',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  resetShopMockData();
  push.mockClear();
  signOutForTest();
});

function purchase(skuId: string) {
  const detail = mockDetail(shopFixtureIds.multiVariantSlug);
  return renderWithClient(
    <ProductPurchase
      detail={detail}
      initialSkuId={skuId}
      lang=""
      heading={<h1>{detail.name}</h1>}
    />,
  );
}

describe('U19: the buy column', () => {
  it('choose size 2, quantity 3, Add: one radio group; the price is the SKU price, not x3', async () => {
    let body: unknown;
    server.use(
      http.post('*/api/cart/lines', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ lineId: 'x', cartId: 'y' });
      }),
    );
    const user = userEvent.setup();
    purchase(shopFixtureIds.skuOats4kg);

    const group = screen.getByRole('group', { name: 'Pack size' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    // Each card carries its label and the server's price.
    expect(within(group).getByRole('radio', { name: /2 kg.*৳2,450\.00/ })).toBeInTheDocument();

    await user.click(within(group).getByRole('radio', { name: /2 kg/ }));
    const region = within(screen.getByRole('region', { name: 'Price and availability' }));
    expect(region.getByText('৳2,450.00')).toBeInTheDocument();
    expect(region.getByText(/2 kg pack/)).toBeInTheDocument();

    const more = screen.getByRole('button', { name: 'One more Organic Rolled Oats' });
    await user.click(more);
    await user.click(more);
    // The note changes; the big price is still the one SKU price as sent.
    expect(region.getByText(/3 × 2 kg/)).toBeInTheDocument();
    expect(region.getByText('৳2,450.00')).toBeInTheDocument();
    expect(region.queryByText(/7,350/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add to basket' }));
    await waitFor(() => expect(body).toEqual({ skuId: shopFixtureIds.skuOats2kg, quantity: 3 }));
    const status = await screen.findByText('Added 3 × 2 kg to your basket.');
    expect(status.closest('[role="status"]')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View basket' })).toHaveAttribute('href', '/cart');
  });

  it('changing the quantity after adding hides the confirmation (it would no longer be true)', async () => {
    const user = userEvent.setup();
    purchase(shopFixtureIds.skuOats2kg);
    await user.click(screen.getByRole('button', { name: 'Add to basket' }));
    expect(await screen.findByText('Added 1 × 2 kg to your basket.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'One more Organic Rolled Oats' }));
    expect(screen.queryByText(/Added 1 × 2 kg/)).not.toBeInTheDocument();
  });

  it('shows the certified-organic badge only when the detail says so', () => {
    const detail = mockDetail(shopFixtureIds.multiVariantSlug);
    expect(detail.certifications).toContain('CertifiedOrganic');
    renderWithClient(
      <ProductPurchase
        detail={detail}
        initialSkuId={detail.skus[0]!.skuId}
        lang=""
        heading={<h1>x</h1>}
      />,
    );
    expect(screen.getByText('Certified organic')).toBeInTheDocument();
  });
});

describe('ProductHeading', () => {
  it('shows "{producer} · {country}" and a short plain excerpt of the description', () => {
    render(
      <ProductHeading
        name="Chinigura rice"
        nameLang="en"
        brand="Birganj Growers"
        rating={{ average: null, count: 0 }}
        country={{ code: 'BD', name: 'Bangladesh' }}
        description={'## Heading\n\nSmall, **fragrant** grains for polao.'}
        descriptionLang="en"
      />,
    );
    expect(screen.getByText(/Birganj Growers/)).toHaveTextContent('Birganj Growers · Bangladesh');
    expect(screen.getByRole('link', { name: 'Bangladesh' })).toHaveAttribute(
      'href',
      '/shop/countries/BD',
    );
    expect(screen.getByText(/Small, fragrant grains for polao\./)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Chinigura rice' })).toBeInTheDocument();
  });
});

describe('U20: the gallery', () => {
  const images = [
    { url: null, altText: 'Front of the bag', isPrimary: true },
    { url: null, altText: 'Back of the bag', isPrimary: false },
  ];

  it('with CertifiedOrganic: the badge; thumbnails are buttons named "Show photo N" with aria-pressed', async () => {
    const user = userEvent.setup();
    render(<ProductGallery images={images} productName="Oats" organic />);
    expect(screen.getByText('Certified organic')).toBeInTheDocument();
    const first = screen.getByRole('button', { name: 'Show photo 1' });
    const second = screen.getByRole('button', { name: 'Show photo 2' });
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAttribute('aria-pressed', 'false');
    await user.click(second);
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: 'Back of the bag' })).toBeInTheDocument();
  });

  it('without it: no badge', () => {
    render(<ProductGallery images={images} productName="Oats" />);
    expect(screen.queryByText('Certified organic')).not.toBeInTheDocument();
  });
});

describe('U21: the details tabs', () => {
  it('is a tablist of tabs with tabpanels; arrow keys move between them', async () => {
    const user = userEvent.setup();
    render(<ProductDetailsTabs detail={mockDetail(shopFixtureIds.multiVariantSlug)} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Description',
      'Origin & producer',
      'Details',
    ]);
    tabs[0]!.focus();
    await user.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Origin & producer' })).toBeVisible();
    // The selected tab is marked by an underline, not by colour alone.
    expect(tabs[1]).toHaveClass('border-accent');
  });

  it('a tab with no API data is not rendered', () => {
    const detail = mockDetail(shopFixtureIds.multiVariantSlug);
    const bare = {
      ...detail,
      food: null,
      certifications: [],
      countryOfOrigin: null,
      brand: '',
    } as typeof detail;
    render(<ProductDetailsTabs detail={bare} />);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Description']);
  });
});

describe('U22: Goes well with', () => {
  it('renders nothing for an empty list', () => {
    const { container } = renderWithClient(<OftenBoughtTogether items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows four tiles with name, price and an Add that follows the card rules', () => {
    renderWithClient(
      <OftenBoughtTogether
        items={[
          makeItem({ productId: 'a', name: 'Moong dal', slug: shopFixtureIds.thaiRiceSlug }),
          makeItem({ productId: 'b', name: 'Pure ghee' }),
          makeItem({ productId: 'c', name: 'Garam masala' }),
          makeItem({ productId: 'd', name: 'Wild honey', availability: 'OutOfStock' }),
          makeItem({ productId: 'e', name: 'Fifth item is not shown' }),
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Goes well with' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Add Moong dal to basket' })).toBeInTheDocument();
    // Out of stock: the stock alert lives on the product page.
    expect(screen.getByRole('link', { name: 'Tell me when Wild honey is back' })).toHaveAttribute(
      'href',
      '/shop/products/organic-rolled-oats#stock-alert',
    );
    expect(screen.queryByText('Fifth item is not shown')).not.toBeInTheDocument();
  });
});
