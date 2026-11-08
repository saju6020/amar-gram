import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { SubscriptionCard } from '@/components/subscriptions/SubscriptionCard';
import { MySubscriptionsList } from '@/components/subscriptions/MySubscriptionsList';
import { SubscriptionDetail } from '@/components/subscriptions/SubscriptionDetail';
import { warningLine } from '@/lib/subscriptions/copy';
import type { CustomerSubscriptionDetail, SubscriptionCycle, SubscriptionView } from '@/lib/api/subscriptions';
import { customerDetailOf, findSubscription, subscriptionViewOf } from '@/mocks/handlers/subscriptions/store';
import { formatCycleDate } from '@/lib/subscriptions/dates';
import { currentUrl, setUrl } from '../common/nav-mock';
import { settle, ids, mockControls, recordRequests, renderWithClient, resetSubscriptions, signIn, signOut } from './helpers';

vi.mock('next/navigation', () => import('../common/nav-mock'));

beforeEach(() => {
  resetSubscriptions();
  signIn();
});
afterEach(() => {
  signOut();
  vi.unstubAllGlobals();
});

/** The server's detail for one of the seeds, changed by a test (a fixture the real server could send). */
function serveDetail(id: string, change: (detail: CustomerSubscriptionDetail) => CustomerSubscriptionDetail) {
  server.use(
    http.get(`*/api/customers/me/subscriptions/${id}`, () =>
      HttpResponse.json(change(customerDetailOf(findSubscription(id)!))),
    ),
  );
}

async function detailReady(id: string) {
  setUrl(`/portal/subscriptions/${id}`);
  const view = renderWithClient(<SubscriptionDetail id={id} />);
  await screen.findByRole('heading', { level: 1 });
  return view;
}

describe('My subscriptions (U15)', () => {
  beforeEach(() => setUrl('/portal/subscriptions'));

  it('shows both tabs with the totalCount of their own query, and a card per subscription', async () => {
    renderWithClient(<MySubscriptionsList />);
    expect(await screen.findByRole('tab', { name: 'Current (7)' })).toBeVisible();
    expect(await screen.findByRole('tab', { name: 'Cancelled (1)' })).toBeVisible();
    const list = await screen.findByRole('list', { name: 'Current subscriptions' });
    const cards = within(list).getAllByRole('link');
    expect(cards).toHaveLength(7);
    const unlocked = within(list).getByRole('link', { name: /Organic Rolled Oats · 400 g/ });
    expect(unlocked).toHaveAttribute('href', `/portal/subscriptions/${ids.mine.activeUnlocked}`);
    expect(unlocked).toHaveTextContent('2 × every 4 weeks');
    expect(unlocked).toHaveTextContent(/Next delivery on \w{3} \d+ \w{3}/);
    expect(unlocked).toHaveTextContent('Active');

    const paused = within(list).getByRole('link', { name: /Date Palm Gur/ });
    expect(paused).toHaveTextContent('Paused: no deliveries until you resume.');
    expect(paused).toHaveTextContent('Paused');
    const suspended = within(list).getByRole('link', { name: /Garam Masala Blend/ });
    expect(suspended).toHaveTextContent('Suspended: see why');
    expect(suspended).toHaveTextContent('This subscription was paused after unpaid orders.');
  });

  it('the Cancelled tab lists the cancelled one with when it ended', async () => {
    const user = userEvent.setup();
    renderWithClient(<MySubscriptionsList />);
    await user.click(await screen.findByRole('tab', { name: /^Cancelled/ }));
    const card = await screen.findByRole('link', { name: /Raw Forest Honey · 500 g/ });
    expect(card).toHaveTextContent(/^.*Ended on \d+ \w{3} 2026, \d\d:\d\d \(Asia\/Dhaka\)/);
    expect(card).toHaveTextContent('Cancelled');
  });

  it('shows the one warning line in the order of the design, for each of the five cases', () => {
    const base = subscriptionViewOf(findSubscription(ids.mine.activeUnlocked)!);
    const view = (change: Partial<SubscriptionView>): SubscriptionView => ({ ...base, ...change });
    const cycle = { orderState: 'AwaitingPayment', paymentExpiresOn: '2026-11-08T10:00:00+06:00' } as SubscriptionCycle;
    const pending = { terms: null, skip: true, statusChange: null, appliesFromCycleOn: '2026-11-20' };

    expect(warningLine(view({}))).toBeNull();
    expect(warningLine(view({ status: 'Suspended', suspensionReason: 'ProductUnavailable' }))).toBe(
      'This subscription was paused because the product is no longer available. Please contact the shop.',
    );
    expect(warningLine(view({ terms: { ...base.terms, deliveryAddressMissing: true } }))).toBe(
      'Your delivery address was removed. Choose another.',
    );
    expect(warningLine(view({ lastCycle: cycle }))).toMatch(/^Waiting for your transfer: pay by .*\(Asia\/Dhaka\)$/);
    expect(warningLine(view({ pending }))).toBe('Changes scheduled from Fri 20 Nov');
    expect(warningLine(view({ product: { ...base.product, isAvailable: false } }))).toBe("This product can't be bought right now");
    // Priority: suspension, then address, then transfer, then scheduled changes, then product.
    expect(
      warningLine(
        view({
          status: 'Suspended',
          suspensionReason: 'UnpaidCycles',
          terms: { ...base.terms, deliveryAddressMissing: true },
          lastCycle: cycle,
          pending,
          product: { ...base.product, isAvailable: false },
        }),
      ),
    ).toMatch(/paused after unpaid orders/);
    expect(
      warningLine(view({ terms: { ...base.terms, deliveryAddressMissing: true }, lastCycle: cycle, pending })),
    ).toBe('Your delivery address was removed. Choose another.');
  });

  it('the seeded cards carry them: address removed, transfer still to pay, scheduled changes', async () => {
    renderWithClient(<MySubscriptionsList />);
    const list = await screen.findByRole('list', { name: 'Current subscriptions' });
    expect(within(list).getByRole('link', { name: /Pure Mustard Oil/ })).toHaveTextContent(
      'Your delivery address was removed. Choose another.',
    );
    expect(within(list).getByRole('link', { name: /Mango Pickle/ })).toHaveTextContent(/Waiting for your transfer: pay by/);
    expect(within(list).getByRole('link', { name: /Thai Jasmine Rice/ })).toHaveTextContent(/Changes scheduled from/);
  });

  it('empty: points at the shop; a failed read offers Try again', async () => {
    server.use(
      http.get('*/api/customers/me/subscriptions', () =>
        HttpResponse.json({ items: [], pageNumber: 1, pageSize: 10, totalCount: 0 }),
      ),
    );
    const first = renderWithClient(<MySubscriptionsList />);
    expect(await screen.findByText('No subscriptions yet. Look for Subscribe on a product page.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Browse the shop' })).toHaveAttribute('href', '/shop');
    first.unmount();

    server.use(http.get('*/api/customers/me/subscriptions', () => HttpResponse.json({}, { status: 500 })));
    renderWithClient(<MySubscriptionsList />);
        expect(await screen.findByRole('button', { name: 'Try again' })).toBeVisible();
  });

  it('?page=2 requests that page', async () => {
    setUrl('/portal/subscriptions?page=2');
    const requests = recordRequests('/api/customers/me/subscriptions?');
    renderWithClient(<MySubscriptionsList />);
    await waitFor(() => expect(requests.urls.some((u) => u.includes('status=live') && u.includes('pageNumber=2'))).toBe(true));
    requests.stop();
    expect(currentUrl()).toBe('/portal/subscriptions?page=2');
  });
});

describe('the detail, unlocked (U16)', () => {
  it('shows the next delivery, why it is the order date, the cut-off in the commerce zone, and exactly the allowed actions', async () => {
    await detailReady(ids.mine.activeUnlocked);
    expect(screen.getByRole('heading', { level: 1, name: 'Organic Rolled Oats · 400 g' })).toBeVisible();
    expect(screen.getByText(/^Next delivery on \w{3} \d+ \w{3}$/)).toBeVisible();
    expect(screen.getByText('The order is placed on this date.')).toBeVisible();
    expect(screen.getByText(/^Changes made before .*\(Asia\/Dhaka\) apply to the delivery on .* After that, they start with the next one\.$/)).toBeVisible();
    const actions = within(screen.getByRole('group', { name: 'What you can do' }));
    expect(actions.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Change',
      expect.stringMatching(/^Skip the delivery on \w{3} \d+ \w{3}$/),
      'Pause',
      'Cancel subscription',
    ]);
  });

  it('renders buttons from allowedActions only: a list without Pause shows no Pause, one with Resume shows it whatever the status', async () => {
    serveDetail(ids.mine.activeUnlocked, (d) => ({ ...d, allowedActions: ['ChangeTerms', 'Cancel'] }));
    await detailReady(ids.mine.activeUnlocked);
    const actions = within(screen.getByRole('group', { name: 'What you can do' }));
    expect(actions.getAllByRole('button').map((b) => b.textContent)).toEqual(['Change', 'Cancel subscription']);
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('the terms, and the estimate exactly as the server sent it (U12)', async () => {
    await detailReady(ids.mine.activeUnlocked);
    const terms = screen.getByRole('region', { name: 'Your subscription' });
    expect(terms).toHaveTextContent('Every 4 weeks');
    expect(terms).toHaveTextContent('Deliver to Home');
    expect(terms).toHaveTextContent('Cash on delivery');
    const estimate = screen.getByRole('region', { name: 'Estimate for each delivery' });
    expect(estimate).toHaveTextContent('2 × ৳650.00');
    expect(estimate).toHaveTextContent('৳1,300.00');
    expect(estimate).toHaveTextContent('Subscription discount −10%');
    expect(estimate).toHaveTextContent('−৳130.00');
    expect(estimate).toHaveTextContent('৳1,170.00');
    expect(estimate).toHaveTextContent('Delivery and tax are added when each order is placed.');
  });

  it('a missing estimate hides the panel; a removed address is a warning that opens the change dialog', async () => {
    serveDetail(ids.mine.addressMissing, (d) => ({ ...d, estimate: null }));
    const user = userEvent.setup();
    await detailReady(ids.mine.addressMissing);
    expect(screen.queryByRole('region', { name: 'Estimate for each delivery' })).toBeNull();
    expect(screen.getByText('Your delivery address was removed. Choose another.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Choose another address' }));
    expect(await screen.findByRole('dialog', { name: /^Change Pure Mustard Oil/ })).toBeVisible();
  });

  it('a 404 says so and links to the list', async () => {
    setUrl('/portal/subscriptions/x');
    renderWithClient(<SubscriptionDetail id={ids.others.active} />);
    expect(await screen.findByText("We couldn't find that subscription.")).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to my subscriptions' })).toHaveAttribute('href', '/portal/subscriptions');
  });
});

describe('the detail, locked (U17)', () => {
  it('shows the locked sentence with the following delivery, and the skip button names the server\'s skippableCycleOn', async () => {
    await detailReady(ids.mine.activeLocked);
    expect(
      screen.getByText(/^Your delivery on \w{3} \d+ \w{3} is already being prepared\. Changes now start with the delivery on \w{3} \d+ \w{3}\.$/),
    ).toBeVisible();
    expect(screen.queryByText(/^Changes made before/)).toBeNull();
    const skip = screen.getByRole('button', { name: /^Skip the delivery on / });
    const detail = customerDetailOf(findSubscription(ids.mine.activeLocked)!);
    expect(skip).toHaveAccessibleName(`Skip the delivery on ${formatCycleDate(detail.skippableCycleOn)}`);
    expect(screen.getByRole('region', { name: 'Scheduled changes' })).toHaveTextContent('New terms from the delivery on');
  });

  it('pause and cancel use the locked wording because isLocked is true; the same dates with isLocked false use the unlocked wording', async () => {
    const user = userEvent.setup();
    serveDetail(ids.mine.activeLocked, (d) => ({ ...d, pending: null, allowedActions: ['ChangeTerms', 'Pause', 'Cancel'] }));
    const view = await detailReady(ids.mine.activeLocked);
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    const pause = await screen.findByRole('dialog', { name: /^Pause / });
    expect(pause).toHaveTextContent(/is already being prepared and will still arrive\. Your subscription pauses after it\./);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    expect(await screen.findByRole('dialog', { name: /^Cancel / })).toHaveTextContent(
      /is already being prepared and will still arrive\. Your subscription ends after it\./,
    );
    view.unmount();

    serveDetail(ids.mine.activeLocked, (d) => ({ ...d, isLocked: false, pending: null, allowedActions: ['ChangeTerms', 'Pause', 'Cancel'] }));
    await detailReady(ids.mine.activeLocked);
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    const unlocked = await screen.findByRole('dialog', { name: /^Pause / });
    expect(unlocked).toHaveTextContent('No orders are placed until you resume.');
    expect(unlocked).not.toHaveTextContent('already being prepared');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Cancel subscription' }));
    expect(await screen.findByRole('dialog', { name: /^Cancel / })).toHaveTextContent(
      'Your subscription ends now and no more orders are placed.',
    );
  });
});

describe('suspension (U22)', () => {
  it('unpaid orders: the banner has every outlet\'s name and phone from P4, and the only action is Cancel', async () => {
    await detailReady(ids.mine.suspendedUnpaid);
    expect(screen.getByText('This subscription was paused after unpaid orders. Please contact the shop to restart it.')).toBeVisible();
    const contacts = await screen.findByRole('list', { name: 'Contact the shop' });
    expect(within(contacts).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(within(contacts).getAllByRole('listitem')[0]).toHaveTextContent(/: \+?[\d ]{6,}/);
    expect(
      within(screen.getByRole('group', { name: 'What you can do' })).getAllByRole('button').map((b) => b.textContent),
    ).toEqual(['Cancel subscription']);
  });

  it('no contacts are shown when P4 fails; the other reason has no contacts at all', async () => {
    server.use(http.get('*/api/branches', () => HttpResponse.json({}, { status: 500 })));
    const first = await detailReady(ids.mine.suspendedUnpaid);
    await screen.findByText(/paused after unpaid orders/);
    await settle(150);
    expect(screen.queryByRole('list', { name: 'Contact the shop' })).toBeNull();
    first.unmount();

    server.resetHandlers();
    await detailReady(ids.mine.suspendedProductUnavailable);
    expect(screen.getByText('This subscription was paused because the product is no longer available. Please contact the shop.')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Contact the shop' })).toBeNull();
  });
});

describe('history (U23)', () => {
  const cycle = (n: number, change: Partial<SubscriptionCycle>): SubscriptionCycle => ({
    id: `5c000000-0000-0000-0000-0000000001${String(n).padStart(2, '0')}`,
    cycleOn: `2026-10-${String(10 + n).padStart(2, '0')}`,
    outcome: 'Generated',
    failureReason: null,
    orderId: `f5000000-0000-0000-0000-0000000001${String(n).padStart(2, '0')}`,
    orderNumber: `ORD-2026-0009${String(n).padStart(2, '0')}`,
    orderState: 'Delivered',
    paymentExpiresOn: null,
    discountPercent: '10.00',
    ...change,
  });

  const every: SubscriptionCycle[] = [
    cycle(1, { orderState: 'AwaitingPayment', paymentExpiresOn: '2026-10-20T18:00:00+06:00' }),
    cycle(2, { orderState: 'Confirmed' }),
    cycle(3, { orderState: 'Expired' }),
    cycle(4, { orderState: 'Cancelled' }),
    cycle(5, { orderState: 'Delivered' }),
    cycle(6, { orderState: 'Refused' }),
    ...(['OutOfStock', 'ProductUnavailable', 'PaymentMethodUnavailable', 'DeliveryUnavailable', 'DeliveryAddressMissing', 'OrderRefused'] as const).map(
      (reason, index) => cycle(7 + index, { outcome: 'Failed', failureReason: reason, orderId: null, orderNumber: null, orderState: null }),
    ),
  ];

  it('writes every outcome, order state and failure reason as text, links the order number, and puts the deadline in the commerce zone', async () => {
    serveDetail(ids.mine.activeUnlocked, (d) => ({ ...d, cycles: every.slice(0, 12) }));
    await detailReady(ids.mine.activeUnlocked);
    const table = screen.getByRole('table', { name: 'Deliveries so far, newest first' });
    const text = table.textContent ?? '';
    for (const expected of [
      'Awaiting your transfer: pay by Tue 20 Oct, 18:00 (Asia/Dhaka)',
      'Confirmed',
      'Expired unpaid',
      'Cancelled',
      'Delivered',
      'Refused on delivery',
      'It was out of stock, so no order was placed. Your next delivery stays on schedule.',
      'The product is no longer available, so your subscription has been paused.',
      'Your payment method is not available for this order. Please choose another in your subscription.',
      'We could not deliver to your chosen address or collection point. Please check your subscription.',
      'Your delivery address is no longer in your address book. Please choose another in your subscription.',
      'We could not place the order. Please contact the shop.',
    ]) {
      expect(text).toContain(expected);
    }
    const link = within(table).getByRole('link', { name: 'ORD-2026-000901' });
    expect(link).toHaveAttribute('href', '/portal/orders/f5000000-0000-0000-0000-000000000101');
    expect(text).not.toMatch(/OutOfStock|AwaitingPayment|PaymentMethodUnavailable/);
  });

  it('"Show more" requests page 2 of the cycles; below the table width the history is cards', async () => {
    mockControls.addCycles(ids.mine.activeUnlocked, 14);
    const user = userEvent.setup();
    const requests = recordRequests('/cycles');
    await detailReady(ids.mine.activeUnlocked);
    const table = screen.getByRole('table', { name: 'Deliveries so far, newest first' });
    expect(within(table).getAllByRole('row').length).toBeGreaterThanOrEqual(12);
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(requests.urls.some((u) => u.includes('pageNumber=2'))).toBe(true));
    await waitFor(() => expect(within(table).getAllByRole('row').length).toBeGreaterThan(13));
    requests.stop();
  });

  it('narrow: the history is a list of cards', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    await detailReady(ids.mine.activeUnlocked);
    expect(screen.getByRole('list', { name: 'Deliveries so far, newest first' })).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('the first delivery date is announced after subscribing ("?subscribed=1" is read once and removed)', async () => {
    setUrl(`/portal/subscriptions/${ids.mine.activeUnlocked}?subscribed=1`);
    renderWithClient(<SubscriptionDetail id={ids.mine.activeUnlocked} />);
    expect(await screen.findByText(/^Subscribed\. Your first delivery is on \w{3} \d+ \w{3}\.$/)).toBeVisible();
    await waitFor(() => expect(currentUrl()).toBe(`/portal/subscriptions/${ids.mine.activeUnlocked}`));
    expect(screen.getByText(/^Subscribed\./).closest('[role="status"]')).not.toBeNull();
  });
});

describe('the list past the end, and the tab in the address (CR fixes)', () => {
  it('?page=9 says the page is past the end and offers the first page, never "No subscriptions yet"', async () => {
    const user = userEvent.setup();
    setUrl('/portal/subscriptions?page=9');
    renderWithClient(<MySubscriptionsList />);
    expect(await screen.findByText('That page is past the end of your list.')).toBeVisible();
    expect(screen.queryByText(/No subscriptions yet/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Go to the first page' }));
    expect(currentUrl()).toBe('/portal/subscriptions');
    expect(await screen.findByRole('list', { name: 'Current subscriptions' })).toBeVisible();
  });

  it('the Cancelled tab is ?tab=cancelled: a reload keeps it, and its last page past the end is explained', async () => {
    const user = userEvent.setup();
    setUrl('/portal/subscriptions');
    const first = renderWithClient(<MySubscriptionsList />);
    await user.click(await screen.findByRole('tab', { name: /^Cancelled/ }));
    expect(currentUrl()).toBe('/portal/subscriptions?tab=cancelled');
    first.unmount();
    renderWithClient(<MySubscriptionsList />);
    expect(await screen.findByRole('tab', { name: /^Cancelled/, selected: true })).toBeVisible();
    expect(await screen.findByText('Raw Forest Honey · 500 g')).toBeVisible();

    setUrl('/portal/subscriptions?tab=cancelled&page=2');
    expect(await screen.findByText('That page is past the end of your list.')).toBeVisible();
  });

  it('only the selected tab points aria-controls at a panel that exists', async () => {
    setUrl('/portal/subscriptions');
    renderWithClient(<MySubscriptionsList />);
    const live = await screen.findByRole('tab', { name: /^Current/ });
    const cancelled = await screen.findByRole('tab', { name: /^Cancelled/ });
    expect(document.getElementById(live.getAttribute('aria-controls')!)).not.toBeNull();
    expect(cancelled).not.toHaveAttribute('aria-controls');
  });
});

describe('history "Show more" failing (CR fixes)', () => {
  it('a failed page 2, then a failed page 3, each retried alone while the loaded pages stay and "Show more" waits', async () => {
    mockControls.addCycles(ids.mine.activeUnlocked, 30);
    const user = userEvent.setup();
    let failPage: number | null = 2;
    server.use(
      http.get(`*/api/customers/me/subscriptions/${ids.mine.activeUnlocked}/cycles`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('pageNumber'));
        if (page === failPage) return HttpResponse.json({}, { status: 500 });
        return undefined;
      }),
    );
    await detailReady(ids.mine.activeUnlocked);
    const rows = () => within(screen.getByRole('table')).getAllByRole('row').length;
    const firstRows = rows();
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(rows()).toBeGreaterThanOrEqual(firstRows);

    failPage = 3;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('button', { name: 'Show more' });
    const afterTwo = rows();
    expect(afterTwo).toBeGreaterThan(firstRows);
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(rows()).toBeGreaterThanOrEqual(afterTwo);

    failPage = null;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull());
    expect(rows()).toBeGreaterThan(afterTwo);
  });
});

describe('hrefs built from ids', () => {
  it('encode a reserved character in the id, so it cannot change the path or add a query', () => {
    const view = subscriptionViewOf(findSubscription(ids.mine.activeUnlocked)!);
    render(<SubscriptionCard subscription={{ ...view, id: 'a/b?c#d' }} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/portal/subscriptions/a%2Fb%3Fc%23d');
  });
});
