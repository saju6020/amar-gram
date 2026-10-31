import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactElement } from 'react';
import { server } from '../../../mocks/server';
import { orderingIds as ids } from '../../../mocks/handlers/ordering/fixtures';
import { db, findOrder, p5OrderIds, resetOrderingMockData, riderIds } from '../../../mocks/handlers/ordering/store';
import { DispatchDialog } from '@/components/orders/DispatchDialog';
import { PickListPage } from '@/components/fulfilment/PickListPage';
import { RidersPage } from '@/components/fulfilment/RidersPage';
import { setUrl } from '../common/nav-mock';

vi.mock('next/navigation', () => import('../common/nav-mock'));

/**
 * HO-P5 S2 — U22 and U23 (§15): dispatching to an in-house rider and the riders page. The request carries exactly one of
 * `courierId` / `riderId`; a rider delivery has no tracking field; with no active rider the option is disabled and says
 * so; the registry lists, adds, edits and (after asking) deactivates riders, and a `403` is the permission-denied state.
 */
function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

const session = (roleIds: string[]) => ({
  staffAccountId: 'staff-1',
  fullName: 'Amina Hossain',
  roleIds,
  issuedOn: '2026-10-14T00:00:00Z',
  lastActivityOn: '2026-10-14T00:00:00Z',
  idleExpiresOn: '2026-10-14T01:00:00Z',
  absoluteExpiresOn: '2026-10-14T09:00:00Z',
  idleTimeoutMinutes: 30,
  serverTime: '2026-10-14T00:00:00Z',
});
const asRoles = (roleIds: string[]) => server.use(http.get('*/api/staff/session', () => HttpResponse.json(session(roleIds))));

/** Records the JSON body of the next request to a path (the dialog's own request, as the server would see it). */
function recordBodies(method: 'POST' | 'PUT', pattern: RegExp): unknown[] {
  const bodies: unknown[] = [];
  server.events.on('request:start', async ({ request }) => {
    if (request.method === method && pattern.test(new URL(request.url).pathname)) bodies.push(await request.clone().json());
  });
  return bodies;
}

beforeEach(() => {
  resetOrderingMockData();
  setUrl('/staff/fulfilment/riders');
  server.events.removeAllListeners();
});

describe('DispatchDialog - U22', () => {
  const open = (orderId = p5OrderIds.packedWaiting) =>
    renderWithClient(<DispatchDialog orderId={orderId} open onOpenChange={() => undefined} onReallocate={() => undefined} />);

  it('offers "Send with" Courier or Rider, and the rider list holds the active riders only', async () => {
    const user = userEvent.setup();
    open();
    const dialog = await screen.findByRole('dialog');
    const group = within(dialog).getByRole('radiogroup', { name: 'Send with' });
    expect(within(group).getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual(['Courier', 'Rider']);
    expect(within(group).getByRole('radio', { name: 'Courier' })).toBeChecked();
    expect(within(dialog).getByLabelText(/Tracking number/)).toBeInTheDocument();

    await waitFor(() => expect(within(group).getByRole('radio', { name: 'Rider' })).toBeEnabled());
    await user.click(within(group).getByRole('radio', { name: 'Rider' }));
    const select = within(dialog).getByLabelText(/Which rider/);
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose a rider', 'Jahid Alam', 'Rafiq Hasan']);
    // No tracking number for a rider.
    expect(within(dialog).queryByLabelText(/Tracking number/)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Which courier/)).not.toBeInTheDocument();
  });

  it('sends exactly the rider’s id (no courier, no tracking) and the shipment then shows the rider', async () => {
    const user = userEvent.setup();
    const bodies = recordBodies('POST', /\/dispatch$/);
    const onOpenChange = vi.fn();
    renderWithClient(<DispatchDialog orderId={p5OrderIds.packedWaiting} open onOpenChange={onOpenChange} onReallocate={() => undefined} />);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByRole('radio', { name: 'Rider' })).toBeEnabled());
    await user.click(within(dialog).getByRole('radio', { name: 'Rider' }));
    await user.selectOptions(within(dialog).getByLabelText(/Which rider/), 'Rafiq Hasan');
    await user.click(within(dialog).getByRole('button', { name: 'Dispatch' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(bodies).toEqual([{ riderId: riderIds.rafiq }]);
    const order = findOrder(p5OrderIds.packedWaiting)!;
    expect(order.status).toBe('Dispatched');
    expect(order.shipment).toMatchObject({ courierId: null, riderId: riderIds.rafiq, riderName: 'Rafiq Hasan' });
  });

  it('sends exactly the courier’s id and the tracking number for a courier', async () => {
    const user = userEvent.setup();
    const bodies = recordBodies('POST', /\/dispatch$/);
    open();
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByRole('option', { name: 'Pathao Courier' })).toBeInTheDocument());
    await user.selectOptions(within(dialog).getByLabelText(/Which courier/), 'Pathao Courier');
    await user.type(within(dialog).getByLabelText(/Tracking number/), 'PC-77');
    await user.click(within(dialog).getByRole('button', { name: 'Dispatch' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ courierId: ids.courierPathaoId, trackingNumber: 'PC-77' });
  });

  it('asks for a rider before sending anything', async () => {
    const user = userEvent.setup();
    const bodies = recordBodies('POST', /\/dispatch$/);
    open();
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByRole('radio', { name: 'Rider' })).toBeEnabled());
    await user.click(within(dialog).getByRole('radio', { name: 'Rider' }));
    await user.click(within(dialog).getByRole('button', { name: 'Dispatch' }));
    expect(await within(dialog).findByText('Choose a rider.')).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it('a rider the server no longer knows (404) reads as plain text under the field', async () => {
    const user = userEvent.setup();
    open();
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByRole('radio', { name: 'Rider' })).toBeEnabled());
    await user.click(within(dialog).getByRole('radio', { name: 'Rider' }));
    await user.selectOptions(within(dialog).getByLabelText(/Which rider/), 'Rafiq Hasan');
    db.riders.find((r) => r.id === riderIds.rafiq)!.isActive = false;
    await user.click(within(dialog).getByRole('button', { name: 'Dispatch' }));
    expect(await within(dialog).findByText('That rider is not available. Choose another.')).toBeInTheDocument();
    expect(findOrder(p5OrderIds.packedWaiting)!.status).toBe('Packed');
  });

  it('with no active riders the Rider option is disabled and says "No riders set up"; the link to manage them is for Riders.Manage holders', async () => {
    db.riders.forEach((r) => (r.isActive = false));
    asRoles(['Administrator']);
    open();
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('No riders set up');
    expect(within(dialog).getByRole('radio', { name: 'Rider' })).toBeDisabled();
    expect(await within(dialog).findByRole('link', { name: 'Manage riders' })).toHaveAttribute('href', '/staff/fulfilment/riders');
  });

  it('shows no "Manage riders" link to a role without Riders.Manage', async () => {
    db.riders.forEach((r) => (r.isActive = false));
    asRoles(['Reception']);
    open();
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('No riders set up');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(within(dialog).queryByRole('link', { name: 'Manage riders' })).not.toBeInTheDocument();
  });
});

describe('RidersPage - U23', () => {
  it('lists every rider with name, mobile and status, in a captioned table', async () => {
    renderWithClient(<RidersPage />);
    const table = await screen.findByRole('table', { name: 'Riders' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Name', 'Mobile', 'Status', 'Actions']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0]?.textContent ?? r.textContent)).toHaveLength(3);
    expect(table).toHaveTextContent('Jahid Alam');
    expect(table).toHaveTextContent('+8801711000101');
    expect(within(table).getAllByText('Active')).toHaveLength(2);
    expect(within(table).getByText('Not active')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Riders' })).toBeInTheDocument();
  });

  it('adds a rider through the dialog and lists it', async () => {
    const user = userEvent.setup();
    const bodies = recordBodies('POST', /\/riders$/);
    renderWithClient(<RidersPage />);
    await screen.findByRole('table', { name: 'Riders' });
    await user.click(screen.getByRole('button', { name: 'Add rider' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a rider' });
    await user.type(within(dialog).getByLabelText(/Name/), '  Nur Alam ');
    await user.type(within(dialog).getByLabelText(/Mobile number/), '01712 345678');
    await user.click(within(dialog).getByRole('button', { name: 'Add rider' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([{ name: 'Nur Alam', mobileNumber: '01712 345678', isActive: true }]);
    expect(await screen.findByRole('cell', { name: 'Nur Alam' })).toBeInTheDocument();
    expect(screen.getByText('+8801712345678')).toBeInTheDocument();
  });

  it('shows RiderNameAlreadyExists under the Name field and keeps the dialog open', async () => {
    const user = userEvent.setup();
    renderWithClient(<RidersPage />);
    await screen.findByRole('table', { name: 'Riders' });
    await user.click(screen.getByRole('button', { name: 'Add rider' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Name/), 'Rafiq Hasan');
    await user.click(within(dialog).getByRole('button', { name: 'Add rider' }));
    expect(await within(dialog).findByText('A rider with this name already exists at this branch.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Name/)).toHaveAccessibleDescription(/already exists/);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows an unusable mobile number under its own field', async () => {
    const user = userEvent.setup();
    renderWithClient(<RidersPage />);
    await screen.findByRole('table', { name: 'Riders' });
    await user.click(screen.getByRole('button', { name: 'Add rider' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Name/), 'Nur Alam');
    await user.type(within(dialog).getByLabelText(/Mobile number/), '12345');
    await user.click(within(dialog).getByRole('button', { name: 'Add rider' }));
    expect(await within(dialog).findByText('This does not look like a valid mobile number.')).toBeInTheDocument();
  });

  it('edits a rider with the current values in the form', async () => {
    const user = userEvent.setup();
    const bodies = recordBodies('PUT', /\/riders\/[^/]+$/);
    renderWithClient(<RidersPage />);
    await screen.findByRole('table', { name: 'Riders' });
    await user.click(screen.getByRole('button', { name: 'Edit Jahid Alam' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Jahid Alam' });
    expect(within(dialog).getByLabelText(/Name/)).toHaveValue('Jahid Alam');
    await user.clear(within(dialog).getByLabelText(/Name/));
    await user.type(within(dialog).getByLabelText(/Name/), 'Jahid A. Mia');
    await user.click(within(dialog).getByRole('button', { name: 'Save rider' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([{ name: 'Jahid A. Mia', mobileNumber: '+8801711000102', isActive: true }]);
    expect(await screen.findByRole('cell', { name: 'Jahid A. Mia' })).toBeInTheDocument();
  });

  it('asks before deactivating, names what changes, and sends nothing until confirmed', async () => {
    const user = userEvent.setup();
    const bodies = recordBodies('PUT', /\/riders\/[^/]+$/);
    renderWithClient(<RidersPage />);
    await screen.findByRole('table', { name: 'Riders' });
    await user.click(screen.getByRole('button', { name: 'Edit Rafiq Hasan' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText(/Active/));
    await user.click(within(dialog).getByRole('button', { name: 'Save rider' }));
    expect(await within(dialog).findByText(/will no longer be offered when you dispatch an order/)).toBeInTheDocument();
    expect(bodies).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(within(dialog).getByLabelText(/Name/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Save rider' }));
    await user.click(await within(dialog).findByRole('button', { name: 'Deactivate rider' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ name: 'Rafiq Hasan', isActive: false });
    expect(db.riders.find((r) => r.id === riderIds.rafiq)!.isActive).toBe(false);
  });

  it('a 403 on the list is the permission-denied state', async () => {
    server.use(http.get('*/api/staff/riders', () => HttpResponse.json({ errors: [{ errorCode: 'ActionNotPermitted', errorMessage: 'no' }] }, { status: 403 })));
    renderWithClient(<RidersPage />);
    expect(await screen.findByText('You don’t have permission to do this.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('a role without Riders.Manage reads the list but gets no Add or Edit', async () => {
    asRoles(['Reception']);
    renderWithClient(<RidersPage />);
    await screen.findByRole('table', { name: 'Riders' });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Add rider' })).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument();
  });

  it('a refused save (403) shows the permission message in the dialog', async () => {
    const user = userEvent.setup();
    server.use(http.post('*/api/staff/riders', () => HttpResponse.json({ errors: [{ errorCode: 'ActionNotPermitted', errorMessage: 'no' }] }, { status: 403 })));
    renderWithClient(<RidersPage />);
    await screen.findByRole('table', { name: 'Riders' });
    await user.click(screen.getByRole('button', { name: 'Add rider' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Name/), 'Nur Alam');
    await user.click(within(dialog).getByRole('button', { name: 'Add rider' }));
    expect(await within(dialog).findByText(/don.t have permission/)).toBeInTheDocument();
  });
});

describe('Pick list page - the link to the riders page', () => {
  it('shows "Manage riders" to a Riders.Manage holder only', async () => {
    setUrl('/staff/fulfilment/pick-list');
    asRoles(['ShopManager']);
    const first = renderWithClient(<PickListPage />);
    expect(await screen.findByRole('link', { name: 'Manage riders' })).toHaveAttribute('href', '/staff/fulfilment/riders');
    first.unmount();
    asRoles(['Reception']);
    renderWithClient(<PickListPage />);
    await screen.findByRole('button', { name: /Start packing/ });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('link', { name: 'Manage riders' })).not.toBeInTheDocument();
  });
});
