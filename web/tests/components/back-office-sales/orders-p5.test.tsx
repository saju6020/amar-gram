import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'msw';
import type { ReactElement } from 'react';
import { server } from '../../../mocks/server';
import { orderingIds as ids, violation } from '../../../mocks/handlers/ordering/fixtures';
import { findOrder, p5OrderIds, resetOrderingMockData } from '../../../mocks/handlers/ordering/store';
import { StaffOrderDetail } from '@/components/orders/StaffOrderDetail';
import { StaffOrderSidePanel } from '@/components/orders/StaffOrderSidePanel';
import { setUrl } from '../common/nav-mock';

vi.mock('next/navigation', () => import('../common/nav-mock'));

/**
 * HO-P5 S2 — U20, U21 and the staff read-back of G4 (§15): the pick-list ticks are the server's, "Mark packed" comes
 * from `allowedActions` only, "Packed {time}" from `packedOn`, the rider note is plain text, and a rider shipment shows
 * the rider.
 */
function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

beforeEach(() => {
  resetOrderingMockData();
  setUrl('/staff/orders');
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('Pick-list tick - U20', () => {
  it('sends PUT …/picked { picked: true }, shows the tick at once, and the server keeps it', async () => {
    const user = userEvent.setup();
    const sent: Array<{ url: string; body: unknown }> = [];
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PUT' && request.url.includes('/picked')) sent.push({ url: new URL(request.url).pathname, body: await request.clone().json() });
    });
    const order = findOrder(ids.orders.confirmedCod)!;
    renderWithClient(<StaffOrderSidePanel orderId={order.id} />);
    const list = await screen.findByRole('list', { name: 'Pick list' });
    const box = within(list).getAllByRole('checkbox')[0]!;
    expect(box).not.toBeChecked();
    await user.click(box);
    expect(box).toBeChecked();
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ url: `/api/staff/orders/${order.id}/lines/${order.lines[0]!.lineId}/picked`, body: { picked: true } });
    await waitFor(() => expect(order.lines[0]!.picked).toBe(true));
    server.events.removeAllListeners();
  });

  it('a 400 InvalidOrderTransition puts the tick back and says the order has left the shelf', async () => {
    const user = userEvent.setup();
    server.use(
      http.put('*/api/staff/orders/:orderId/lines/:lineId/picked', () =>
        violation('Status', 'InvalidOrderTransition', 'Pick ticks can only be changed while the order is being prepared.'),
      ),
    );
    renderWithClient(<StaffOrderSidePanel orderId={ids.orders.confirmedCod} />);
    const box = within(await screen.findByRole('list', { name: 'Pick list' })).getAllByRole('checkbox')[0]!;
    await user.click(box);
    expect(await screen.findByText('This order has already left the shelf.')).toBeInTheDocument();
    await waitFor(() => expect(box).not.toBeChecked());
    expect(screen.getByRole('alert')).toHaveTextContent('This order has already left the shelf.');
  });

  it('shows ticks the server already holds, so a packed order’s lines are ticked on first view', async () => {
    renderWithClient(<StaffOrderSidePanel orderId={p5OrderIds.packedWaiting} />);
    const boxes = within(await screen.findByRole('list', { name: 'Pick list' })).getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    for (const box of boxes) expect(box).toBeChecked();
  });
});

describe('Mark packed - U21', () => {
  it('a Packing delivery offers "Mark packed" beside Dispatch; it calls POST …/packed and shows "Packed {time}"', async () => {
    const user = userEvent.setup();
    const order = findOrder(ids.orders.confirmedCod)!;
    order.status = 'Packing';
    renderWithClient(<StaffOrderSidePanel orderId={order.id} />);
    expect(await screen.findByRole('button', { name: 'Dispatch' })).toBeInTheDocument();
    expect(screen.queryByText(/^Packed [A-Z][a-z]{2} /)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark packed' }));
    await waitFor(() => expect(order.status).toBe('Packed'));
    expect(await screen.findByText(/^Packed [A-Z][a-z]{2} \d/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark packed' })).not.toBeInTheDocument();
    // Packed: still dispatchable and cancellable, from the server's allowedActions.
    expect(screen.getByRole('button', { name: 'Dispatch' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
  });

  it('is absent when the server does not allow it', async () => {
    renderWithClient(<StaffOrderSidePanel orderId={ids.orders.confirmedCod} />);
    await screen.findByRole('button', { name: 'Start packing' });
    expect(screen.queryByRole('button', { name: 'Mark packed' })).not.toBeInTheDocument();
  });

  it('the full order page lists "Mark packed" among the actions of a Packing order only', async () => {
    const user = userEvent.setup();
    const order = findOrder(ids.orders.confirmedCod)!;
    order.status = 'Packing';
    renderWithClient(<StaffOrderDetail orderId={order.id} />);
    const actions = await screen.findByRole('group', { name: 'Order actions' });
    await user.click(within(actions).getByRole('button', { name: 'Mark packed' }));
    await waitFor(() => expect(order.status).toBe('Packed'));
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Order actions' })).queryByRole('button', { name: 'Mark packed' })).not.toBeInTheDocument());
  });
});

describe('Rider note and rider shipment - G4 staff read-back, BG-5', () => {
  it('shows the note a customer left as plain text on the side panel and the order page, never as markup or a link', async () => {
    const hostile = '<b>ring</b> <a href="javascript:alert(1)">here</a> & call';
    findOrder(ids.orders.confirmedCod)!.fulfilment.riderNote = hostile;
    const { container, unmount } = renderWithClient(<StaffOrderSidePanel orderId={ids.orders.confirmedCod} />);
    expect(await screen.findByText(`Note for the rider: ${hostile}`)).toBeInTheDocument();
    expect(container.querySelector('b, a[href^="javascript"]')).toBeNull();
    unmount();

    const page = renderWithClient(<StaffOrderDetail orderId={ids.orders.confirmedCod} />);
    const term = await screen.findByText('Note for the rider');
    expect(term.nextElementSibling).toHaveTextContent(hostile);
    expect(page.container.querySelector('b, a[href^="javascript"]')).toBeNull();
    // Not in the address bar and not in browser storage.
    expect(window.location.href).not.toContain('ring');
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('ring');
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain('ring');
  });

  it('shows no note row when there is none', async () => {
    renderWithClient(<StaffOrderSidePanel orderId={ids.orders.confirmedCod} />);
    await screen.findByRole('list', { name: 'Pick list' });
    expect(screen.queryByText(/Note for the rider/)).not.toBeInTheDocument();
  });

  it('a rider shipment reads "Rider: {name}", with no courier row and no tracking action', async () => {
    renderWithClient(<StaffOrderDetail orderId={p5OrderIds.dispatchedWithRider} />);
    const panel = (await screen.findByRole('heading', { name: 'Shipment' })).closest('section') as HTMLElement;
    expect(within(panel).getByText('Rider').nextElementSibling).toHaveTextContent('Rafiq Hasan');
    expect(within(panel).queryByText('Courier')).not.toBeInTheDocument();
    expect(within(panel).queryByText('Tracking number')).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument();
  });

  it('a courier shipment still reads as before', async () => {
    renderWithClient(<StaffOrderDetail orderId={ids.orders.dispatchedCod} />);
    const panel = (await screen.findByRole('heading', { name: 'Shipment' })).closest('section') as HTMLElement;
    expect(within(panel).getByText('Courier').nextElementSibling).toHaveTextContent('Pathao Courier');
    expect(within(panel).getByRole('button', { name: /tracking number/i })).toBeInTheDocument();
  });
});

