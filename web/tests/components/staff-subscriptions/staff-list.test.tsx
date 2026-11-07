import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/mocks/server';
import { StaffSubscriptionsList } from '@/components/staff-subscriptions/StaffSubscriptionsList';
import { ApiError, ApiForbiddenError } from '@/lib/api/client';
import { PERMISSION_DENIED_MESSAGE } from '@/lib/api/errors';
import * as billing from '@/lib/api/billing-staff';
import { subscriptionFixtureIds } from '../../../mocks/handlers/subscriptions/fixtures';
import { currentUrl, setUrl } from '../common/nav-mock';
import { actAs, freshStore, recordRequests, renderScreen } from './helpers';

vi.mock('next/navigation', () => import('../common/nav-mock'));
vi.mock('@/lib/api/billing-staff', async (original) => ({
  ...(await original<typeof import('@/lib/api/billing-staff')>()),
  downloadBillingFile: vi.fn(async () => undefined),
}));

const download = vi.mocked(billing.downloadBillingFile);
const ids = subscriptionFixtureIds;

beforeEach(() => {
  freshStore();
  download.mockClear();
  setUrl('/staff/subscriptions');
  actAs('ShopManager');
});
afterEach(() => server.events.removeAllListeners());

/** U27 -- filters, sort and page are the address; a reload issues the same request; the columns are the design's. */
describe('U27 staff list', () => {
  it('lists the server rows with the columns of 11.3.3 and links the customer and the row', async () => {
    renderScreen(<StaffSubscriptionsList />);
    const table = await screen.findByRole('table', { name: 'Subscriptions' });
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual([
      'Customer', 'Mobile', 'Product', 'Each delivery', 'Status', 'Next delivery', 'Payment', 'Unpaid in a row', 'Last order',
    ]);
    const row = within(table).getByRole('link', { name: /Garam Masala Blend · 750 g/ }).closest('tr')!;
    expect(within(row).getByRole('link', { name: 'Tanvir Ahmed' })).toHaveAttribute('href', `/staff/customers/${ids.otherCustomers.tanvir}`);
    expect(within(row).getByRole('link', { name: /Garam Masala/ })).toHaveAttribute('href', `/staff/subscriptions/${ids.others.dueTomorrow}`);
    expect(within(row).getByText('Active')).toBeInTheDocument();
    expect(within(row).getByText('1 × every 4 weeks')).toBeInTheDocument();
  });

  it('shows a status as a word and a suspension with its reason', async () => {
    setUrl('/staff/subscriptions?status=Suspended');
    renderScreen(<StaffSubscriptionsList />);
    const table = await screen.findByRole('table', { name: 'Subscriptions' });
    expect(within(table).getAllByText('Suspended').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Unpaid orders').length).toBeGreaterThan(0);
    expect(within(table).getByText('Product unavailable')).toBeInTheDocument();
  });

  it('writes status, reason, method, sort and search to the address', async () => {
    const user = userEvent.setup();
    renderScreen(<StaffSubscriptionsList />);
    await screen.findByRole('table', { name: 'Subscriptions' });

    await user.selectOptions(screen.getByLabelText('Status'), 'Suspended');
    await user.selectOptions(screen.getByLabelText('Suspension reason'), 'UnpaidCycles');
    await user.selectOptions(screen.getByLabelText('Payment method'), 'BankTransfer');
    await user.selectOptions(screen.getByLabelText('Sort by'), '-nextDeliveryOn');
    await user.type(screen.getByRole('searchbox', { name: 'Customer, mobile or product' }), 'honey');
    await user.tab();
    await waitFor(() => {
      const params = new URLSearchParams(currentUrl().split('?')[1]);
      expect(Object.fromEntries(params)).toEqual({
        status: 'Suspended', suspensionReason: 'UnpaidCycles', paymentMethod: 'BankTransfer', sort: '-nextDeliveryOn', q: 'honey',
      });
    });
    // The server did the filtering: only the suspended, unpaid, bank-transfer honey subscription is left.
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2));
    expect(screen.getByRole('link', { name: /Raw Forest Honey/ })).toBeInTheDocument();
  });

  it('enables the reason select only for Suspended or no status, and drops the reason when the status changes away', async () => {
    const user = userEvent.setup();
    setUrl('/staff/subscriptions?status=Suspended&suspensionReason=UnpaidCycles');
    renderScreen(<StaffSubscriptionsList />);
    const reason = screen.getByLabelText('Suspension reason');
    expect(reason).toBeEnabled();
    await user.selectOptions(screen.getByLabelText('Status'), 'Active');
    await waitFor(() => expect(screen.getByLabelText('Suspension reason')).toBeDisabled());
    expect(currentUrl()).not.toContain('suspensionReason');
    await user.selectOptions(screen.getByLabelText('Status'), '');
    await waitFor(() => expect(screen.getByLabelText('Suspension reason')).toBeEnabled());
  });

  it('issues the same request after a reload (the filters are read back from the address), with no polling', async () => {
    setUrl('/staff/subscriptions?status=Suspended&suspensionReason=UnpaidCycles&paymentMethod=BankTransfer&q=honey&sort=product&page=1');
    const seen = recordRequests('/api/staff/subscriptions');
    renderScreen(<StaffSubscriptionsList />);
    await screen.findByRole('table', { name: 'Subscriptions' });
    expect(Object.fromEntries(seen[0]!.searchParams)).toEqual({
      status: 'Suspended', suspensionReason: 'UnpaidCycles', paymentMethod: 'BankTransfer', q: 'honey', sort: 'product', pageNumber: '1', pageSize: '25',
    });
  });

  it('does not send a status the server does not know (a hand-edited address)', async () => {
    setUrl('/staff/subscriptions?status=Banana');
    const seen = recordRequests('/api/staff/subscriptions');
    renderScreen(<StaffSubscriptionsList />);
    await screen.findByRole('table', { name: 'Subscriptions' });
    expect(seen[0]!.searchParams.has('status')).toBe(false);
  });

  it('shows the empty state, and a way back, when nothing matches', async () => {
    setUrl('/staff/subscriptions?q=zzzz-no-such');
    renderScreen(<StaffSubscriptionsList />);
    expect(await screen.findByText('No subscriptions match.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  it('shows the permission message in place of the list on a 403', async () => {
    actAs('Cashier');
    renderScreen(<StaffSubscriptionsList />);
    expect(await screen.findByText("You don’t have permission to do this.")).toBeInTheDocument();
  });

  it('has the All and Unpaid link nav, All current', async () => {
    renderScreen(<StaffSubscriptionsList />);
    const nav = await screen.findByRole('navigation', { name: 'Subscription lists' });
    expect(within(nav).getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Unpaid' })).toHaveAttribute('href', '/staff/subscriptions/unpaid');
  });
});

/** U28 -- Export CSV. */
describe('U28 export', () => {
  it.each([['ShopManager'], ['Accountant'], ['Administrator']])('is shown to %s', async (role) => {
    actAs(role);
    renderScreen(<StaffSubscriptionsList />);
    expect(await screen.findByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it.each([['Reception'], ['Inventory']])('is not shown to %s', async (role) => {
    actAs(role);
    renderScreen(<StaffSubscriptionsList />);
    await screen.findByRole('table', { name: 'Subscriptions' });
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
  });

  it('downloads export.csv with the current filters and no paging', async () => {
    const user = userEvent.setup();
    setUrl('/staff/subscriptions?status=Suspended&q=honey&sort=product&page=2');
    renderScreen(<StaffSubscriptionsList />);
    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    const [path, fallback] = download.mock.calls[0]!;
    expect(fallback).toBe('subscriptions.csv');
    const url = new URL(path, 'http://x');
    expect(url.pathname).toBe('/api/staff/subscriptions/export.csv');
    expect(Object.fromEntries(url.searchParams)).toEqual({ status: 'Suspended', q: 'honey', sort: 'product' });
  });

  it('explains a 413 with the server sentence', async () => {
    const user = userEvent.setup();
    download.mockRejectedValueOnce(new ApiError('Something went wrong. Please try again.', 413));
    renderScreen(<StaffSubscriptionsList />);
    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many rows to export. Narrow the filters.');
  });

  it('explains a 403 with the permission sentence', async () => {
    const user = userEvent.setup();
    download.mockRejectedValueOnce(new ApiForbiddenError({ errors: [{ errorCode: 'ActionNotPermitted', errorMessage: 'Not permitted.' }] }));
    renderScreen(<StaffSubscriptionsList />);
    await user.click(await screen.findByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(PERMISSION_DENIED_MESSAGE);
  });
});
