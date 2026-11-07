import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnpaidSubscriptionsScreen } from '@/components/staff-subscriptions/UnpaidSubscriptionsScreen';
import { subscriptionFixtureIds, subscriptionSeeds } from '../../../mocks/handlers/subscriptions/fixtures';
import { setUrl } from '../common/nav-mock';
import { actAs, freshStore, renderScreen } from './helpers';

vi.mock('next/navigation', () => import('../common/nav-mock'));

const ids = subscriptionFixtureIds;

beforeEach(() => {
  freshStore();
  setUrl('/staff/subscriptions/unpaid');
  actAs('Accountant');
});

/** U29 -- "Suspended" then "At risk"; each row lists its unpaid orders as text with a link to the staff order page. */
describe('U29 unpaid worklist', () => {
  it('shows the Suspended heading before At risk, each with its rows', async () => {
    renderScreen(<UnpaidSubscriptionsScreen />);
    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Suspended', 'At risk']);

    const suspended = screen.getByRole('region', { name: 'Suspended' });
    const atRisk = screen.getByRole('region', { name: 'At risk' });
    expect(within(suspended).getByText('Shirin Akter')).toBeInTheDocument();
    expect(within(atRisk).getByText('Mizanur Rahman')).toBeInTheDocument();
  });

  it('lists each unpaid order with its date, order link, pay-by time (zone named) and state as text', async () => {
    renderScreen(<UnpaidSubscriptionsScreen />);
    const suspended = await screen.findByRole('region', { name: 'Suspended' });
    const card = within(suspended).getByText('Shirin Akter').closest('li')!;
    expect(within(card).getByText('2 unpaid in a row')).toBeInTheDocument();
    const orders = within(card).getAllByRole('link', { name: /^ORD-/ });
    expect(orders).toHaveLength(2);
    for (const link of orders) expect(link.getAttribute('href')).toMatch(/^\/staff\/orders\/[0-9a-f-]{36}$/);
    expect(within(card).getAllByText('Expired unpaid')).toHaveLength(2);
    expect(within(card).getAllByText(/^Pay by .*\(Asia\/Dhaka\)/).length).toBeGreaterThan(0);
    expect(within(card).getByRole('link', { name: /Open Shirin Akter/ })).toHaveAttribute('href', `/staff/subscriptions/${ids.others.suspendedUnpaid}`);
  });

  it('counts only what the server sends: a customer with a 0-streak awaiting transfer is At risk, not Suspended', async () => {
    renderScreen(<UnpaidSubscriptionsScreen />);
    const atRisk = await screen.findByRole('region', { name: 'At risk' });
    const awaiting = subscriptionSeeds().find((s) => s.id === ids.mine.awaitingPayment)!;
    expect(awaiting.status).toBe('Active');
    expect(within(atRisk).getByText('Sam Rahman')).toBeInTheDocument();
  });

  it('is the Unpaid link of the nav, current', async () => {
    renderScreen(<UnpaidSubscriptionsScreen />);
    const nav = await screen.findByRole('navigation', { name: 'Subscription lists' });
    expect(within(nav).getByRole('link', { name: 'Unpaid' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows the permission message on a 403', async () => {
    actAs('Cashier');
    renderScreen(<UnpaidSubscriptionsScreen />);
    expect(await screen.findByText('You don’t have permission to do this.')).toBeInTheDocument();
  });
});

describe('a page past the end', () => {
  it('says so and offers the first page, not "nothing is suspended"', async () => {
    setUrl('/staff/subscriptions/unpaid?page=99');
    renderScreen(<UnpaidSubscriptionsScreen />);
    expect(await screen.findByText('That page is past the end of the list.')).toBeInTheDocument();
    expect(screen.queryByText('No unpaid subscriptions.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go to the first page' }));
    expect(await screen.findByRole('region', { name: 'Suspended' })).toBeInTheDocument();
  });
});
