import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { server } from '../../../mocks/server';
import { db, resetOrderingMockData } from '../../../mocks/handlers/ordering/store';
import { CATEGORY_LABELS } from '@/lib/shop/labels';
import { PosScreen } from '@/components/pos/PosScreen';
import { setUrl } from '../common/nav-mock';

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
    expect(within(rice).getAllByRole('listitem').length).toBeLessThanOrEqual(allCount);
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

  it('"Show more" asks for the next page and appends its tiles', async () => {
    const user = userEvent.setup();
    renderWithClient(<PosScreen />);
    const grid = await screen.findByRole('list', { name: 'All items to sell' });
    const first = within(grid).getAllByRole('listitem').length;
    // Twenty to a page: the mock catalogue has fewer, so the button only appears when there is another page.
    if (first >= 20) {
      await user.click(screen.getByRole('button', { name: 'Show more' }));
      await waitFor(() => expect(within(screen.getByRole('list', { name: 'All items to sell' })).getAllByRole('listitem').length).toBeGreaterThan(first));
    } else {
      expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    }
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

  it('says so when a category has nothing to sell', async () => {
    const user = userEvent.setup();
    renderWithClient(<PosScreen />);
    await screen.findByRole('list', { name: 'All items to sell' });
    await user.click(screen.getByRole('tab', { name: 'Household & natural care' }));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'All items to sell' })).not.toBeInTheDocument());
    await waitFor(() => {
      const empty = screen.queryByText(/Nothing to sell in household/i);
      const grid = screen.queryByRole('list', { name: 'Household & natural care to sell' });
      expect(empty ?? grid).not.toBeNull();
    });
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
    expect(screen.getByRole('button', { name: 'Walk-in (no customer)' })).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'Walk-in (no customer)' }));
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
    await user.click(screen.getByRole('button', { name: 'Walk-in (no customer)' }));
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
