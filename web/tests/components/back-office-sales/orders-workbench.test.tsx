import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { orderingIds as ids } from '../../../mocks/handlers/ordering/fixtures';
import { findOrder, resetOrderingMockData } from '../../../mocks/handlers/ordering/store';
import { StaffOrderQueue } from '@/components/orders/StaffOrderQueue';
import { StaffOrderSidePanel } from '@/components/orders/StaffOrderSidePanel';
import { currentUrl, setUrl } from '../common/nav-mock';

vi.mock('next/navigation', () => import('../common/nav-mock'));

/**
 * HO-P4 S2 — U18..U21 (§15): the orders workbench. The status pills are the URL `status` filter (no
 * counts), the selected order lives in `?order=` and survives a refetch together with the pick-list
 * ticks, and the side panel offers only what the server's `allowedActions` allow.
 */
function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

beforeEach(() => {
  resetOrderingMockData();
  setUrl('/staff/orders');
});

describe('Status pills - U18', () => {
  it('Packing writes status=Packing to the URL, All clears it, and no pill carries a count', async () => {
    const user = userEvent.setup();
    renderWithClient(<StaffOrderQueue />);
    const tabs = await screen.findByRole('tablist', { name: 'Order status' });
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Waiting for payment',
      'Confirmed',
      'Being packed',
      'Dispatched',
      'All',
    ]);
    expect(tabs.textContent).not.toMatch(/\d/);
    expect(within(tabs).getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');

    await user.click(within(tabs).getByRole('tab', { name: 'Being packed' }));
    await waitFor(() => expect(currentUrl()).toContain('status=Packing'));
    expect(within(tabs).getByRole('tab', { name: 'Being packed' })).toHaveAttribute('aria-selected', 'true');

    await user.click(within(tabs).getByRole('tab', { name: 'All' }));
    await waitFor(() => expect(currentUrl()).not.toContain('status='));
  });

  it('the other filters sit in "More filters" and keep their URL values', async () => {
    setUrl('/staff/orders?paymentMethod=BankTransfer');
    renderWithClient(<StaffOrderQueue />);
    const more = (await screen.findByText('More filters')).closest('details');
    expect(more).toHaveAttribute('open');
    expect(within(more as HTMLElement).getByLabelText('Payment method')).toHaveValue('BankTransfer');
  });

  it('without a selection the list is offered, and a row selects with a pressed button (no navigation)', async () => {
    const user = userEvent.setup();
    renderWithClient(<StaffOrderQueue />);
    const order = findOrder(ids.orders.confirmedCod)!;
    const pick = await screen.findByRole('button', { name: order.orderNumber });
    expect(pick).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/Choose an order in the list/)).toBeInTheDocument();
    await user.click(pick);
    await waitFor(() => expect(currentUrl()).toContain(`order=${ids.orders.confirmedCod}`));
    expect(await screen.findByRole('heading', { name: `Order ${order.orderNumber}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: order.orderNumber })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Selected order survives a refetch - U19', () => {
  it('keeps the side panel on the chosen order and keeps the pick-list ticks', async () => {
    const user = userEvent.setup();
    setUrl(`/staff/orders?order=${ids.orders.confirmedCod}`);
    const { client } = renderWithClient(<StaffOrderQueue />);
    const order = findOrder(ids.orders.confirmedCod)!;
    const list = await screen.findByRole('list', { name: 'Pick list' });
    const boxes = within(list).getAllByRole('checkbox');
    await user.click(boxes[0]!);
    expect(boxes[0]).toBeChecked();

    await client.invalidateQueries({ queryKey: ['staff', 'orders'] });
    await client.invalidateQueries({ queryKey: ['staff', 'order'] });
    await waitFor(() => expect(client.isFetching()).toBe(0));

    expect(currentUrl()).toContain(`order=${ids.orders.confirmedCod}`);
    expect(screen.getByRole('heading', { name: `Order ${order.orderNumber}` })).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Pick list' })).getAllByRole('checkbox')[0]).toBeChecked();
  });
});

describe('Side panel actions come from allowedActions - U20', () => {
  it('["StartPacking","Cancel"] shows "Start packing" and "Cancel order" only', async () => {
    renderWithClient(<StaffOrderSidePanel orderId={ids.orders.confirmedCod} />);
    expect(await screen.findByRole('button', { name: 'Start packing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
    for (const name of [/^Dispatch/, /Record delivery/, /Confirm/, /Refund/]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('[] shows no action button and no Cancel', async () => {
    renderWithClient(<StaffOrderSidePanel orderId={ids.orders.expired} />);
    await screen.findByRole('heading', { name: /^Order ORD-/ });
    expect(findOrder(ids.orders.expired)).toBeDefined();
    const panel = screen.getByRole('region', { name: /^Order ORD-/ });
    // Only the two links remain; no workflow button of any kind.
    expect(within(panel).queryAllByRole('button')).toEqual([]);
    expect(within(panel).getByRole('link', { name: 'Open full order' })).toHaveAttribute('href', `/staff/orders/${ids.orders.expired}`);
  });

  it('a Packing delivery offers Dispatch, which opens the existing dialog', async () => {
    const user = userEvent.setup();
    const order = findOrder(ids.orders.confirmedCod)!;
    order.status = 'Packing';
    renderWithClient(<StaffOrderSidePanel orderId={ids.orders.confirmedCod} />);
    await user.click(await screen.findByRole('button', { name: 'Dispatch' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});

describe('Pick list - U21', () => {
  it('lists each line’s batch, expiry and location in server order and gates "Start packing" on every tick', async () => {
    const user = userEvent.setup();
    renderWithClient(<StaffOrderSidePanel orderId={ids.orders.confirmedCod} />);
    const list = await screen.findByRole('list', { name: 'Pick list' });
    const order = findOrder(ids.orders.confirmedCod)!;
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(order.lines.length);
    order.lines.forEach((line, index) => {
      const text = rows[index]!.textContent ?? '';
      let cursor = -1;
      for (const allocation of line.allocations) {
        const at = text.indexOf(`Batch ${allocation.batchNumber}`);
        expect(at).toBeGreaterThan(cursor);
        cursor = at;
        expect(text).toContain(allocation.locationName);
      }
    });

    const start = screen.getByRole('button', { name: 'Start packing' });
    expect(start).toBeDisabled();
    for (const box of within(list).getAllByRole('checkbox')) await user.click(box);
    expect(start).toBeEnabled();
    await user.click(start);
    await waitFor(() => expect(findOrder(ids.orders.confirmedCod)!.status).toBe('Packing'));
    expect(await screen.findByRole('button', { name: 'Dispatch' })).toBeInTheDocument();
  });
});
