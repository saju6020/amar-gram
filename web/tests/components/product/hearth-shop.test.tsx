import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductPurchase } from '@/app/(shop)/_components/ProductPurchase';
import { OftenBoughtTogether } from '@/components/recommendations/OftenBoughtTogether';
import { resetShopMockData, shopFixtureIds } from '@/mocks/handlers/shop';
import { makeItem } from '../catalogue/catalogue-fixtures';
import { mockDetail, renderWithClient, signOutForTest } from './test-utils';

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

describe('Product page buy row — Hearth', () => {
  it('has a pill quantity stepper, Add to basket and the wishlist button; the quantity is sent', async () => {
    const user = userEvent.setup();
    purchase(shopFixtureIds.skuOats2kg);
    const quantity = screen.getByRole('spinbutton', { name: 'Quantity' });
    expect(screen.getAllByLabelText('Quantity')).toHaveLength(1);
    // UI-6: each stepper button is named with the product.
    await user.click(screen.getByRole('button', { name: 'One more Organic Rolled Oats' }));
    await user.click(screen.getByRole('button', { name: 'One more Organic Rolled Oats' }));
    expect(quantity).toHaveValue(3);
    expect(screen.getByRole('button', { name: 'One less Organic Rolled Oats' })).toBeEnabled();
    // Direct entry works and is clamped to 1..max.
    await user.clear(quantity);
    await user.type(quantity, '5');
    expect(quantity).toHaveValue(5);
    await user.clear(quantity);
    await user.type(quantity, '99');
    expect(quantity).toHaveValue(20);
    await user.clear(quantity);
    await user.type(quantity, '3');
    await user.click(screen.getByRole('button', { name: /add to basket/i }));
    expect(await screen.findByText('Added 3 × 2 kg to your basket.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View basket' })).toHaveAttribute('href', '/cart');
    // The wishlist control is present (a guest gets the sign-in link).
    expect(await screen.findByRole('link', { name: 'Save' })).toBeInTheDocument();
  });

  it('an out-of-stock size disables the stepper and Add to basket, with the reason written out', () => {
    purchase(shopFixtureIds.skuOats4kg);
    expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'One more Organic Rolled Oats' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'One less Organic Rolled Oats' })).toBeDisabled();
    const add = screen.getByRole('button', { name: /add to basket/i });
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription('This variant is out of stock.');
  });

  it('the size options are cards in one radio group with price and stock', () => {
    purchase(shopFixtureIds.skuOats2kg);
    const group = screen.getByRole('group', { name: 'Pack size' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(within(group).getByRole('radio', { name: /2 kg/ })).toBeChecked();
  });
});

describe('Goes well with (was Often bought together)', () => {
  it('renders nothing for an empty list', () => {
    const { container } = renderWithClient(<OftenBoughtTogether items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the items as tiles with a 44px Add button each, following the card rules', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <OftenBoughtTogether
        items={[
          makeItem({ productId: 'a', slug: shopFixtureIds.multiVariantSlug, priceVaries: true }),
          makeItem({
            productId: 'b',
            slug: shopFixtureIds.thaiRiceSlug,
            name: 'Thai Jasmine Rice',
          }),
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Goes well with' })).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Add Organic Rolled Oats: choose options' }),
    );
    expect(push).toHaveBeenCalledWith('/shop/products/organic-rolled-oats');
    const add = screen.getByRole('button', { name: 'Add Thai Jasmine Rice to basket' });
    expect(add).toHaveClass('min-h-11');
    await user.click(add);
    expect(await screen.findByText(/Added Thai Jasmine Rice to your basket/)).toBeInTheDocument();
  });
});
