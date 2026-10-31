import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { server } from '../../../mocks/server';
import { http, HttpResponse } from 'msw';
import { db, resetOrderingMockData } from '../../../mocks/handlers/ordering/store';
import { db as shopDb } from '../../../mocks/handlers/shop/store';
import { CATEGORY_LABELS } from '@/lib/shop/labels';
import { PosScreen } from '@/components/pos/PosScreen';
import { currentUrl, setUrl } from '../common/nav-mock';
import { orderingIds as ids } from '../../../mocks/handlers/ordering/fixtures';

vi.mock('next/navigation', () => import('../common/nav-mock'));

/**
 * HO-P5 S2 — U24 and U26 (§15): the counter's category browse (BG-6) and the walk-in sale (BG-8). The change preview is
 * U25 and lives in `pos-ticket.test.tsx`, where it supersedes HO-P4 U23's first clause.
 */
function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const JASMINE_RICE = '8900000000201';

beforeEach(() => {
  resetOrderingMockData();
  setUrl('/staff/pos');
  server.events.removeAllListeners();
});

function recordSales(): Array<Record<string, unknown>> {
  const sent: Array<Record<string, unknown>> = [];
  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'POST' && new URL(request.url).pathname.endsWith('/pos/sales')) sent.push((await request.clone().json()) as Record<string, unknown>);
  });
  return sent;
}

describe('Browse by category - U24', () => {
  it('has a tablist of "All" and every category, labelled from lib/shop/labels', async () => {
    renderWithClient(<PosScreen />);
    const tabs = await screen.findByRole('tablist', { name: 'Item categories' });
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['All', ...Object.values(CATEGORY_LABELS)]);
    expect(within(tabs).getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  });

  it('selecting a category asks the server for browse?category=X and shows only those tiles', async () => {
    const user = userEvent.setup();
    const urls: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (new URL(request.url).pathname.endsWith('/pos/browse')) urls.push(new URL(request.url).search);
    });
    renderWithClient(<PosScreen />);
    const all = await screen.findByRole('list', { name: 'All items to sell' });
    const allCount = within(all).getAllByRole('listitem').length;
    expect(allCount).toBeGreaterThan(0);
    expect(urls[0]).toContain('pageNumber=1');
    expect(urls[0]).not.toContain('category=');

    await user.click(screen.getByRole('tab', { name: 'Rice & grains' }));
    const rice = await screen.findByRole('list', { name: 'Rice & grains to sell' });
    expect(urls.some((url) => url.includes('category=RiceAndGrains'))).toBe(true);
    // Every tile is a product of that category in the shop catalogue, and every such sellable product is there.
    const riceNames = shopDb.products
      .filter((p) => p.category === 'RiceAndGrains' && p.status === 'Active' && p.listed)
      .flatMap((p) => p.skus.filter((k) => k.status === 'Active' && k.price !== null).map(() => p.name));
    expect(riceNames.length).toBeGreaterThan(0);
    expect(riceNames.length).toBeLessThan(allCount);
    const tiles = within(rice).getAllByRole('button');
    expect(tiles).toHaveLength(riceNames.length);
    for (const tile of tiles) {
      expect(riceNames.some((name) => (tile.getAttribute('aria-label') ?? '').startsWith(`Add ${name}`))).toBe(true);
    }
    expect(screen.getByRole('tab', { name: 'Rice & grains' })).toHaveAttribute('aria-selected', 'true');
  });

  it('a tile adds a basket line, and a second tap raises its quantity', async () => {
    const user = userEvent.setup();
    renderWithClient(<PosScreen />);
    const grid = await screen.findByRole('list', { name: 'All items to sell' });
    const tile = (await within(grid).findAllByRole('button'))[0]!;
    const label = (tile.getAttribute('aria-label') ?? '').replace(/^Add /, '').replace(/, ৳.*$/, '');
    await user.click(tile);
    const basket = await screen.findByRole('list', { name: 'Basket' });
    expect(within(basket).getAllByRole('listitem')).toHaveLength(1);
    await user.click(tile);
    expect(document.getElementById('pos-scan-live')).toHaveTextContent(`Added ${label}, quantity 2`);
  });

  it('"Show more" asks the server for the next page, appends its tiles and goes away on the last page', async () => {
    const user = userEvent.setup();
    const asked: string[] = [];
    const sku = (n: number) => ({
      skuId: `90000000-0000-0000-0000-${String(n).padStart(12, '0')}`,
      productId: `p${n}`,
      productName: `Item ${String(n).padStart(2, '0')}`,
      variantLabel: '1 kg',
      barcode: null,
      unitPrice: { amount: '10.00', currencyCode: 'BDT' },
      sellable: 5,
      isBundle: false,
      fefoBatches: [],
    });
    server.use(
      http.get('*/api/staff/pos/browse', ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get('pageNumber'));
        asked.push(url.search);
        const all = Array.from({ length: 25 }, (_, i) => sku(i + 1));
        return HttpResponse.json({ items: all.slice((page - 1) * 20, page * 20), pageNumber: page, pageSize: 20, totalCount: 25 });
      }),
    );
    renderWithClient(<PosScreen />);
    const grid = await screen.findByRole('list', { name: 'All items to sell' });
    expect(within(grid).getAllByRole('listitem')).toHaveLength(20);
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'All items to sell' })).getAllByRole('listitem')).toHaveLength(25));
    expect(asked).toHaveLength(2);
    expect(asked[1]).toContain('pageNumber=2');
    expect(screen.getByRole('button', { name: /^Add Item 25/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });

  it('a typed name search replaces the grid with its results', async () => {
    const user = userEvent.setup();
    renderWithClient(<PosScreen />);
    await screen.findByRole('list', { name: 'All items to sell' });
    await user.click(screen.getByRole('button', { name: 'Search by name' }));
    // Opening the search without a query leaves the grid in place.
    expect(screen.getByRole('list', { name: 'All items to sell' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Product name or code'), 'Jasmine');
    const results = await screen.findByRole('list', { name: 'Search results' });
    await waitFor(() => expect(within(results).getAllByRole('button').length).toBeGreaterThan(0));
    expect(screen.queryByRole('list', { name: 'All items to sell' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Item categories' })).not.toBeInTheDocument();
  });

  it('says so when a category has nothing to sell, and shows no grid for it', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/api/staff/pos/browse', ({ request }) => {
        const empty = new URL(request.url).searchParams.get('category') === 'HouseholdAndCare';
        const one = {
          skuId: '90000000-0000-0000-0000-000000000001', productId: 'p1', productName: 'Rice', variantLabel: '1 kg', barcode: null,
          unitPrice: { amount: '10.00', currencyCode: 'BDT' }, sellable: 5, isBundle: false, fefoBatches: [],
        };
        return HttpResponse.json({ items: empty ? [] : [one], pageNumber: 1, pageSize: 20, totalCount: empty ? 0 : 1 });
      }),
    );
    renderWithClient(<PosScreen />);
    await screen.findByRole('list', { name: 'All items to sell' });
    await user.click(screen.getByRole('tab', { name: 'Household & natural care' }));
    expect(await screen.findByText('Nothing to sell in household & natural care right now.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /to sell$/ })).not.toBeInTheDocument();
  });
});

describe('Walk-in sale - U26', () => {
  async function basketWithRice(user: ReturnType<typeof userEvent.setup>) {
    const field = screen.getByLabelText('Scan a barcode');
    await user.click(field);
    await user.type(field, `${JASMINE_RICE}{Enter}`);
    await screen.findByRole('list', { name: 'Basket' });
  }

  it('the chip reads "Walk-in (no customer)" by default and completing sends neither name nor mobile', async () => {
    const user = userEvent.setup();
    const sales = recordSales();
    renderWithClient(<PosScreen />);
    expect(screen.getByRole('button', { name: 'Walk-in (no customer) · Add customer' })).toBeInTheDocument();
    await basketWithRice(user);
    await user.type(screen.getByLabelText(/handed over/), '1000.00');
    await user.click(screen.getByRole('button', { name: 'Add payment' }));
    const complete = screen.getByRole('button', { name: 'Complete sale' });
    await waitFor(() => expect(complete).toBeEnabled());
    expect(screen.queryByText(/Enter both the name/)).not.toBeInTheDocument();
    await user.click(complete);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Complete sale' }));
    expect(await screen.findByRole('heading', { name: /Sale complete/ })).toBeInTheDocument();
    expect(sales).toHaveLength(1);
    expect(Object.keys(sales[0]!)).not.toContain('customerName');
    expect(Object.keys(sales[0]!)).not.toContain('customerMobile');
    expect(db.orders[0]!.customerId).toBeNull();
    expect(screen.getByText(/Change due:/)).toHaveTextContent(/220\.00/);
  });

  it('only a name, or only a mobile, blocks completion with "Enter both the name and the mobile number, or neither."', async () => {
    const user = userEvent.setup();
    renderWithClient(<PosScreen />);
    await basketWithRice(user);
    await user.type(screen.getByLabelText(/handed over/), '1000.00');
    await user.click(screen.getByRole('button', { name: 'Add payment' }));
    await user.click(screen.getByRole('button', { name: 'Walk-in (no customer) · Add customer' }));
    await user.type(screen.getByLabelText(/Mobile number/), '01711112222');
    const complete = screen.getByRole('button', { name: 'Complete sale' });
    await waitFor(() => expect(screen.getByText(/Enter both the name and the mobile number, or neither\./)).toBeInTheDocument());
    expect(complete).toBeDisabled();
    // Giving the other half makes the sale completable; clearing both makes it a walk-in again.
    await user.type(screen.getByLabelText(/Customer name/), 'Rana');
    await waitFor(() => expect(complete).toBeEnabled());
    await user.clear(screen.getByLabelText(/Customer name/));
    await user.clear(screen.getByLabelText(/Mobile number/));
    await waitFor(() => expect(complete).toBeEnabled());
    expect(screen.queryByText(/Enter both the name and the mobile number, or neither\./)).not.toBeInTheDocument();
  });

  it('a sale with both sends both, as before', async () => {
    const user = userEvent.setup();
    const sales = recordSales();
    renderWithClient(<PosScreen />);
    await basketWithRice(user);
    await user.click(screen.getByRole('button', { name: 'Walk-in (no customer) · Add customer' }));
    await user.type(screen.getByLabelText(/Customer name/), 'Rana');
    await user.type(screen.getByLabelText(/Mobile number/), '01711112222');
    expect(screen.getByRole('button', { name: /Rana · 01711112222/ })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/handed over/), '1000.00');
    await user.click(screen.getByRole('button', { name: 'Add payment' }));
    const complete = screen.getByRole('button', { name: 'Complete sale' });
    await waitFor(() => expect(complete).toBeEnabled());
    await user.click(complete);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Complete sale' }));
    await screen.findByRole('heading', { name: /Sale complete/ });
    expect(sales[0]).toMatchObject({ customerName: 'Rana', customerMobile: '01711112222' });
  });
});

// SECURITY (S2 gate): "New order" from a customer's profile presets the buyer once. Clearing it or pressing New sale
// must never put the next walk-in on that customer's account.
describe('Preset buyer from /staff/pos?customerId= - SECURITY', () => {
  const PRESET = `/staff/pos?customerId=${ids.customerId}`;
  beforeEach(() => {
    // The accounts mock answers a customer lookup only for a signed-in staff session; stand one in.
    server.use(
      http.get('*/api/staff/customers/:customerId', () =>
        HttpResponse.json({ id: ids.customerId, fullName: ids.customerName, mobileNumber: '01711000999', emailAddress: null, recordStatus: 'Complete', registrationChannel: 'Web', status: 'Active', mergedIntoCustomerId: null }),
      ),
    );
  });

  // Jasmine rice has a single unit in the seed, so a second sale scans oats instead.
  async function addRice(user: ReturnType<typeof userEvent.setup>, code = JASMINE_RICE) {
    const field = screen.getByLabelText('Scan a barcode');
    await user.click(field);
    await user.type(field, `${code}{Enter}`);
    await screen.findByRole('list', { name: 'Basket' });
  }
  async function pay(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/handed over/), '1000.00');
    await user.click(screen.getByRole('button', { name: 'Add payment' }));
    const complete = screen.getByRole('button', { name: 'Complete sale' });
    await waitFor(() => expect(complete).toBeEnabled());
    await user.click(complete);
    return within(await screen.findByRole('dialog'));
  }

  it('takes the preset out of the address as soon as the chip shows the customer, and a remount is a walk-in', async () => {
    setUrl(PRESET);
    const first = renderWithClient(<PosScreen />);
    await screen.findByRole('button', { name: new RegExp(`^${ids.customerName}`) });
    await waitFor(() => expect(currentUrl()).toBe('/staff/pos'));
    // Back from the receipt, a reload or any remount reads the clean address: nobody is preset.
    first.unmount();
    renderWithClient(<PosScreen />);
    expect(await screen.findByRole('button', { name: 'Walk-in (no customer) · Add customer' })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(screen.getByRole('button', { name: 'Walk-in (no customer) · Add customer' })).toBeInTheDocument();
  });

  it('a new link for a customer presets again once the address has been cleaned', async () => {
    setUrl(PRESET);
    renderWithClient(<PosScreen />);
    await screen.findByRole('button', { name: new RegExp(`^${ids.customerName}`) });
    await waitFor(() => expect(currentUrl()).toBe('/staff/pos'));
    await userEvent.setup().click(screen.getByRole('button', { name: new RegExp(`^${ids.customerName}`) }));
    await userEvent.setup().clear(screen.getByLabelText(/Customer name/));
    await userEvent.setup().clear(screen.getByLabelText(/Mobile number/));
    await screen.findByRole('button', { name: 'Walk-in (no customer) · Add customer' });
    setUrl(PRESET);
    expect(await screen.findByRole('button', { name: new RegExp(`^${ids.customerName}`) })).toBeInTheDocument();
  });

  it('fills the buyer from the URL, names them in the review, and clearing both fields keeps it a walk-in', async () => {
    const user = userEvent.setup();
    const sales = recordSales();
    setUrl(PRESET);
    renderWithClient(<PosScreen />);
    const chip = await screen.findByRole('button', { name: new RegExp(`^${ids.customerName}`) });
    await user.click(chip);
    await user.clear(screen.getByLabelText(/Customer name/));
    await user.clear(screen.getByLabelText(/Mobile number/));
    // The preset does not come back when the fields are empty.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Walk-in (no customer) · Add customer' })).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.getByLabelText(/Customer name/)).toHaveValue('');
    await addRice(user);
    const review = await pay(user);
    expect(review.getByText(/No customer \(walk-in sale\)/)).toBeInTheDocument();
    await user.click(review.getByRole('button', { name: 'Complete sale' }));
    await screen.findByRole('heading', { name: /Sale complete/ });
    expect(Object.keys(sales[0]!)).not.toContain('customerName');
    expect(Object.keys(sales[0]!)).not.toContain('customerMobile');
  });

  it('the review names the preset buyer; after New sale the chip is a walk-in, the address loses the preset and the next sale carries neither', async () => {
    const user = userEvent.setup();
    const sales = recordSales();
    setUrl(PRESET);
    renderWithClient(<PosScreen />);
    await screen.findByRole('button', { name: new RegExp(`^${ids.customerName}`) });
    await addRice(user);
    const review = await pay(user);
    // The name is isolated from the amounts around it.
    expect(review.getByText(ids.customerName).tagName).toBe('BDI');
    expect(review.getByText(/Buyer:/)).toBeInTheDocument();
    await user.click(review.getByRole('button', { name: 'Complete sale' }));
    await screen.findByRole('heading', { name: /Sale complete/ });
    expect(sales[0]).toMatchObject({ customerName: ids.customerName });

    await user.click(screen.getByRole('button', { name: 'New sale' }));
    expect(await screen.findByRole('button', { name: 'Walk-in (no customer) · Add customer' })).toBeInTheDocument();
    expect(currentUrl()).toBe('/staff/pos');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.getByRole('button', { name: 'Walk-in (no customer) · Add customer' })).toBeInTheDocument();

    await addRice(user, '8900000000101');
    const second = await pay(user);
    await user.click(second.getByRole('button', { name: 'Complete sale' }));
    await screen.findByRole('heading', { name: /Sale complete/ });
    expect(sales).toHaveLength(2);
    expect(Object.keys(sales[1]!)).not.toContain('customerName');
    expect(Object.keys(sales[1]!)).not.toContain('customerMobile');
  });
});
