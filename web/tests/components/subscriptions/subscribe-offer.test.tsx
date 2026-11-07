import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { ProductPurchase } from '@/app/(shop)/_components/ProductPurchase';
import { BuyBox } from '@/components/product/BuyBox';
import { SubscribeOffer } from '@/components/subscriptions/SubscribeOffer';
import { resetShopMockData, shopFixtureIds } from '@/mocks/handlers/shop';
import { mockDetail, signInForTest, signOutForTest } from '../product/test-utils';
import { settle, ids, mockControls, recordRequests, renderWithClient, resetSubscriptions, signIn, signOut } from './helpers';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/shop/products/organic-rolled-oats',
  useSearchParams: () => new URLSearchParams(''),
}));

beforeEach(() => {
  resetShopMockData();
  resetSubscriptions();
  signIn();
});
afterEach(() => {
  signOut();
  signOutForTest();
});

/** HO-P6 S1 U8: the product page's Subscribe offer (ADR-FE-195, OQ-1, OQ-2). */
describe('SubscribeOffer (U8)', () => {
  it('signed in, subscribable, discount 10.00: "Subscribe & save 10%" links to the form for that SKU', async () => {
    renderWithClient(<SubscribeOffer skuId={shopFixtureIds.skuOats2kg} />);
    const link = await screen.findByRole('link', { name: 'Subscribe & save 10%' });
    expect(link).toHaveAttribute('href', `/portal/subscriptions/new/${shopFixtureIds.skuOats2kg}`);
  });

  it('a zero discount reads just "Subscribe"', async () => {
    mockControls.setDiscount('0.00');
    renderWithClient(<SubscribeOffer skuId={shopFixtureIds.skuOats2kg} />);
    expect(await screen.findByRole('link', { name: 'Subscribe' })).toBeVisible();
    expect(screen.queryByText(/save/)).toBeNull();
  });

  it('a product that cannot be subscribed to shows nothing, even after the options have loaded', async () => {
    const requests = recordRequests('/subscriptions/options');
    renderWithClient(<SubscribeOffer skuId={mockDetail(shopFixtureIds.kitSlug).skus[0]!.skuId} />);
    await waitFor(() => expect(requests.urls.length).toBe(1));
    await settle(150);
    expect(screen.queryByTestId('subscribe-offer')).toBeNull();
    requests.stop();
  });

  it('an existing subscription reads "You already subscribe to this" with a Manage link to it', async () => {
    renderWithClient(<SubscribeOffer skuId={ids.skus.oats400} />);
    expect(await screen.findByText('You already subscribe to this')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute(
      'href',
      `/portal/subscriptions/${ids.mine.activeUnlocked}`,
    );
  });

  it('a failed read shows nothing and no error', async () => {
    server.use(http.get('*/api/customers/me/subscriptions/options', () => HttpResponse.json({}, { status: 500 })));
    renderWithClient(<SubscribeOffer skuId={shopFixtureIds.skuOats2kg} />);
    await settle(400);
    expect(screen.queryByTestId('subscribe-offer')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('the offer on the product page (U8)', () => {
  function page(slug = shopFixtureIds.multiVariantSlug, skuId = shopFixtureIds.skuOats2kg) {
    const detail = mockDetail(slug);
    return renderWithClient(
      <ProductPurchase detail={detail} initialSkuId={skuId} lang="" heading={<h1>{detail.name}</h1>} />,
    );
  }

  it('signed in, the offer is part of the buy box; signed out, there is nothing and no options request', async () => {
    signInForTest();
    const first = page();
    expect(await screen.findByRole('link', { name: 'Subscribe & save 10%' })).toBeVisible();
    first.unmount();

    signOut();
    signOutForTest();
    // signInForTest also installed a session answer; a visitor has none.
    server.resetHandlers();
    const requests = recordRequests('/subscriptions/options');
    page();
    await screen.findByRole('button', { name: /Add to (cart|basket)/ });
    await settle(400);
    expect(screen.queryByTestId('subscribe-offer')).toBeNull();
    expect(requests.urls).toEqual([]);
    requests.stop();
  });

  it('a variant change reads the options for the new SKU', async () => {
    signInForTest();
    const requests = recordRequests('/subscriptions/options');
    page(shopFixtureIds.multiVariantSlug, shopFixtureIds.skuOats400);
    expect(await screen.findByText('You already subscribe to this')).toBeVisible();
    const { default: userEvent } = await import('@testing-library/user-event');
    await userEvent.setup().click(screen.getByRole('radio', { name: /2 kg/ }));
    expect(await screen.findByRole('link', { name: 'Subscribe & save 10%' })).toBeVisible();
    expect(requests.urls.some((u) => u.includes(`skuId=${shopFixtureIds.skuOats2kg}`))).toBe(true);
    requests.stop();
  });
});

describe('BuyBox without the slot (U8)', () => {
  it('renders no subscribe region, exactly as before', () => {
    const detail = mockDetail(shopFixtureIds.multiVariantSlug);
    const { container } = renderWithClient(
      <BuyBox sku={detail.skus[0]!} pricesIncludeTax={detail.pricesIncludeTax} actions={<button>Add</button>} />,
    );
    expect(container.querySelector('[data-slot="buy-box-subscribe"]')).toBeNull();
    expect(within(container).getByRole('button', { name: 'Add' })).toBeVisible();
  });

  it('renders the slot under the actions when given one', () => {
    const detail = mockDetail(shopFixtureIds.multiVariantSlug);
    const { container } = renderWithClient(
      <BuyBox
        sku={detail.skus[0]!}
        pricesIncludeTax={detail.pricesIncludeTax}
        actions={<button>Add</button>}
        subscribe={<p>offer</p>}
      />,
    );
    const actions = container.querySelector('[data-slot="buy-box-actions"]')!;
    expect(actions.nextElementSibling).toHaveAttribute('data-slot', 'buy-box-subscribe');
  });
});
