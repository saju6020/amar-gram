import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogueControls } from '@/app/(shop)/_components/CatalogueControls';
import { ResultSummary } from '@/components/catalogue/ResultSummary';
import { CATEGORIES, FACETS } from './catalogue-fixtures';

const replace = vi.fn();
const push = vi.fn();
let search = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/shop/products',
  useSearchParams: () => new URLSearchParams(search),
}));

function controls(fixed?: Parameters<typeof CatalogueControls>[0]['fixed']) {
  return (
    <CatalogueControls
      facets={FACETS}
      categories={CATEGORIES}
      currencyCode="BDT"
      fixed={fixed}
      summary={<ResultSummary totalCount={42} q="" />}
    >
      <div>results</div>
    </CatalogueControls>
  );
}

function setup(query = '', fixed?: Parameters<typeof CatalogueControls>[0]['fixed']) {
  search = query;
  return render(controls(fixed));
}

const lastUrl = () => replace.mock.calls.at(-1)?.[0] as string;

beforeEach(() => {
  replace.mockClear();
  push.mockClear();
});

describe('CatalogueControls — HO-SHP-002 §11.2', () => {
  it('U-A1: tick an origin, then a brand, then change the sort — filters accumulate, page resets', async () => {
    const user = userEvent.setup();
    const view = setup('pageNumber=3');
    const aside = () => within(screen.getByRole('complementary', { name: 'Filters' }));

    // Only Category is open on arrival (owner, 2026-10-17): the shopper opens Origin first.
    await user.click(aside().getByRole('button', { name: 'Origin' }));
    await user.click(aside().getByRole('checkbox', { name: /Thailand/ }));
    expect(lastUrl()).toBe('/shop/products?origin=TH');

    // The next render of the page carries the previous change in the URL.
    search = 'origin=TH';
    view.rerender(controls());
    await user.click(aside().getByRole('button', { name: 'Producer' }));
    await user.click(aside().getByRole('checkbox', { name: /Sunfield/ }));
    expect(lastUrl()).toBe('/shop/products?brand=Sunfield&origin=TH');

    search = 'brand=Sunfield&origin=TH';
    view.rerender(controls());
    await user.selectOptions(screen.getByLabelText('Sort by'), 'price_asc');
    expect(lastUrl()).toBe('/shop/products?brand=Sunfield&origin=TH&sort=price_asc');
  }, 20_000);

  it('U-A1: the filter groups are real fieldsets with legends', () => {
    setup();
    // HO-P3 S2: "Origin" (was "Country of origin"); the fixture's only certification is Certified
    // organic, which has its own switch row instead of a Certification group.
    for (const legend of ['Category', 'Origin', 'Producer', 'Price', 'Availability', 'Rating']) {
      expect(screen.getByRole('group', { name: legend })).toBeInTheDocument();
    }
    expect(screen.queryByRole('group', { name: 'Certification' })).not.toBeInTheDocument();
  });

  it('2026-10-17: on arrival only Category is open; a group holding a choice starts open', async () => {
    const user = userEvent.setup();
    setup('availability=inStock');
    const aside = within(screen.getByRole('complementary', { name: 'Filters' }));
    for (const open of ['Category', 'Availability'])
      expect(aside.getByRole('button', { name: open })).toHaveAttribute('aria-expanded', 'true');
    for (const closed of ['Origin', 'Producer', 'Price', 'Rating'])
      expect(aside.getByRole('button', { name: closed })).toHaveAttribute('aria-expanded', 'false');

    await user.click(aside.getByRole('button', { name: 'Origin' }));
    expect(aside.getByRole('checkbox', { name: /Thailand/ })).toBeVisible();
    await user.click(aside.getByRole('button', { name: 'Category' }));
    expect(aside.getByRole('button', { name: 'Category' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('U-A5: price min 500, max 200 shows an inline error and does not navigate', async () => {
    const user = userEvent.setup();
    setup();
    const aside = within(screen.getByRole('complementary', { name: 'Filters' }));
    await user.click(aside.getByRole('button', { name: 'Price' }));
    await user.type(aside.getByLabelText(/Minimum/), '500');
    await user.type(aside.getByLabelText(/Maximum/), '200');
    await user.click(aside.getByRole('button', { name: 'Apply price' }));
    expect(aside.getByRole('alert')).toHaveTextContent(/minimum price can.t be more/i);
    expect(replace).not.toHaveBeenCalled();
  });

  it('applies a valid price range once', async () => {
    const user = userEvent.setup();
    setup();
    const aside = within(screen.getByRole('complementary', { name: 'Filters' }));
    await user.click(aside.getByRole('button', { name: 'Price' }));
    await user.type(aside.getByLabelText(/Minimum/), '200');
    await user.type(aside.getByLabelText(/Maximum/), '900');
    await user.click(aside.getByRole('button', { name: 'Apply price' }));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(lastUrl()).toBe('/shop/products?minPrice=200&maxPrice=900');
  });

  it('U-A2: mobile sheet — change two filters, Show results navigates once, closes, returns focus', async () => {
    const user = userEvent.setup();
    setup('brand=Sunfield&origin=TH');
    const button = screen.getByRole('button', { name: 'Filters (2)' });
    await user.click(button);

    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    // Availability starts closed (2026-10-16); the shopper opens it first. The organic switch is
    // always in view (HO-P3 S2).
    await user.click(within(dialog).getByRole('button', { name: 'Availability' }));
    await user.click(within(dialog).getByRole('checkbox', { name: /In stock only/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Certified organic only' }));
    expect(replace).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Show results' }));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(lastUrl()).toBe(
      '/shop/products?brand=Sunfield&origin=TH&certification=CertifiedOrganic&availability=inStock',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    // The result count is a polite live region.
    expect(screen.getByRole('status')).toHaveTextContent('42 products');
  });

  it('U-A2: typing a multi-digit price in the sheet keeps focus on the same input', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /^Filters/ }));
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    // Price starts closed, as on the page.
    await user.click(within(dialog).getByRole('button', { name: 'Price' }));
    const min = within(dialog).getByLabelText(/Minimum/);
    await user.click(min);
    await user.keyboard('1200');
    expect(min).toBeInTheDocument();
    expect(min).toHaveFocus();
    expect(min).toHaveValue('1200');
    expect(within(dialog).getByLabelText(/Minimum/)).toBe(min);
    expect(replace).not.toHaveBeenCalled();
  });

  it('U-C2: an origin page fixes the country and keeps every other filter group', () => {
    setup('', { origin: ['TH'] });
    expect(screen.queryByRole('group', { name: 'Origin' })).not.toBeInTheDocument();
    for (const legend of ['Producer', 'Price', 'Availability']) {
      expect(screen.getByRole('group', { name: legend })).toBeInTheDocument();
    }
    expect(screen.getByRole('checkbox', { name: 'Certified organic only' })).toBeInTheDocument();
    // The fixed country is neither counted nor offered as a removable chip.
    expect(screen.getByRole('button', { name: 'Filters (0)' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Remove filter Thailand/ }),
    ).not.toBeInTheDocument();
  });

  it('removing a chip keeps the others; Clear filters keeps the search text', async () => {
    const user = userEvent.setup();
    setup('q=oats&brand=Sunfield&origin=TH');
    await user.click(screen.getByRole('button', { name: 'Remove filter Thailand' }));
    expect(lastUrl()).toBe('/shop/products?q=oats&brand=Sunfield');
    // The filter card's own pill (the chips row has one for phones, where the card is a sheet).
    const aside = within(screen.getByRole('complementary', { name: 'Filters' }));
    await user.click(aside.getByRole('button', { name: 'Clear filters' }));
    expect(lastUrl()).toBe('/shop/products?q=oats');
  });
});
