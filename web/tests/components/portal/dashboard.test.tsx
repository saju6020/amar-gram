import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { PortalDashboard } from '@/components/portal/dashboard/PortalDashboard';
import {
  degradedDashboard,
  fullDashboard,
  newCustomerDashboard,
  ordersNotDeliveredDashboard,
  portalIds,
} from '@/mocks/handlers/portal/fixtures';
import {
  PORTAL_BILLING,
  PORTAL_ORDERS,
  portalInvoiceHref,
  portalOrderHref,
} from '@/lib/routing/portal-links';
import { renderWithClient, resetPortalMock, serveDashboard } from './helpers';

afterEach(() => resetPortalMock());

/** Resolves when the subscriptions list (C3) has been answered, so "the card is absent" is asserted after the answer. */
function c3Answered(): Promise<void> {
  return new Promise((resolve) => {
    const done = ({ request }: { request: Request }) => {
      if (request.url.includes('/api/customers/me/subscriptions')) {
        server.events.removeListener('response:mocked', done);
        // The query settles a tick after the response.
        setTimeout(resolve, 0);
      }
    };
    server.events.on('response:mocked', done);
  });
}

const tile = (id: string) => screen.findByTestId(`tile-${id}`);

describe('Portal dashboard — greeting and empty states (US-POR-01)', () => {
  it('U-A1: a new customer sees every tile say its true empty', async () => {
    serveDashboard(newCustomerDashboard());
    renderWithClient(<PortalDashboard />);

    expect(within(await tile('orders')).getByText(/haven’t placed an order/i)).toBeVisible();
    expect(within(await tile('balances')).getByText(/nothing to pay right now/i)).toBeVisible();
  });

  it('U-A17: the greeting uses the customer name; a customer section that is Unavailable loses only the name', async () => {
    serveDashboard(fullDashboard());
    const first = renderWithClient(<PortalDashboard />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome back, Sam' }),
    ).toBeVisible();
    first.unmount();

    const body = fullDashboard();
    body.customer = { state: 'Unavailable', data: null };
    serveDashboard(body);
    renderWithClient(<PortalDashboard />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible();
    expect(await tile('orders')).toBeVisible();
  });
});

describe('Portal dashboard — balances (ADR-FE-122: no payment surface)', () => {
  it('U-A3: balances Unavailable shows no amount and no "Nothing to pay"; Try again refetches the dashboard', async () => {
    let degraded = true;
    const calls = serveDashboard(() => (degraded ? degradedDashboard() : fullDashboard()));
    renderWithClient(<PortalDashboard />);

    const balances = await tile('balances');
    expect(within(balances).getByText(/couldn’t load your balances/i)).toBeVisible();
    expect(within(balances).queryByText(/nothing to pay/i)).toBeNull();
    expect(within(balances).queryByText(/৳|BDT|USD/)).toBeNull();
    // the other tiles are intact
    expect(within(await tile('orders')).getByRole('link', { name: 'SO-2026-00042' })).toBeVisible();

    degraded = false;
    await userEvent.setup().click(within(balances).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(calls.n).toBe(2));
    expect(await screen.findByTestId('outstanding-BDT')).toBeVisible();
    expect(screen.queryByTestId('tile-balances-unavailable')).toBeNull();
  });

  it('U-A4: BDT and USD are two amounts with no total; how to pay and outlet contacts show; no pay control exists', async () => {
    serveDashboard(fullDashboard());
    server.use(
      http.get('*/api/branches', () =>
        HttpResponse.json([
          {
            id: 'b0000000-0000-0000-0000-000000000001',
            name: 'Gulshan',
            addressLine: null,
            phoneNumber: '+880 2 5504 1122',
            email: null,
            timeZoneId: 'Asia/Dhaka',
            weeklyHours: [],
          },
        ]),
      ),
    );
    renderWithClient(<PortalDashboard />);
    const balances = await tile('balances');

    expect(within(balances).getByTestId('outstanding-BDT')).toHaveTextContent('3,250');
    expect(within(balances).getByTestId('outstanding-USD')).toHaveTextContent('$40.00');
    expect(within(balances).getByText(/never added together/i)).toBeVisible();
    expect(within(balances).getByText(/cash or card, or by bank transfer/i)).toBeVisible();
    expect(await within(balances).findByText(/\+880 2 5504 1122/)).toBeVisible();

    // ADR-FE-122: nothing whose name contains "pay" is a button or a link in the whole dashboard
    const controls = [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')];
    for (const control of controls) {
      expect(control.getAttribute('aria-label') ?? control.textContent ?? '').not.toMatch(/\bpay/i);
    }
    // the only links out of the tile go to invoices (and the billing list)
    for (const link of within(balances).getAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(new RegExp(`^${PORTAL_BILLING}`));
    }
    expect(within(balances).getByRole('link', { name: 'INV-2026-00318' })).toHaveAttribute(
      'href',
      portalInvoiceHref(portalIds.invoices.overdue),
    );
    expect(within(balances).getByText('Part paid')).toBeVisible();
  });

  it('U-A15: an open-invoice count at the 500 cap reads "500 or more"', async () => {
    const body = fullDashboard();
    if (body.balances?.data) body.balances.data.openInvoiceCount = 500;
    serveDashboard(body);
    renderWithClient(<PortalDashboard />);
    expect(await screen.findByText('500 or more open invoices')).toBeVisible();
  });

  it('U-A15b: a count below the cap is exact', async () => {
    serveDashboard(fullDashboard());
    renderWithClient(<PortalDashboard />);
    expect(await screen.findByText('3 open invoices · oldest due first')).toBeVisible();
  });
});

describe('Portal dashboard — orders', () => {
  it('U-A14: the tracking number shows when present, and the order links to the order page', async () => {
    serveDashboard(fullDashboard());
    renderWithClient(<PortalDashboard />);
    const orders = await tile('orders');
    expect(within(orders).getByText(/Tracking DHK-88213-BD/)).toBeVisible();
    expect(within(orders).getAllByText(/Tracking/)).toHaveLength(1);
    expect(within(orders).getByRole('link', { name: 'SO-2026-00042' })).toHaveAttribute(
      'href',
      portalOrderHref(portalIds.orders.delivered),
    );
  });

  it('U-B7: the order again button follows the server canReorder flag, with the reason when it is false', async () => {
    serveDashboard(fullDashboard());
    renderWithClient(<PortalDashboard />);
    const orders = await tile('orders');
    const pending = within(orders).getByRole('button', { name: 'Order SO-2026-00061 again' });
    expect(pending).toBeDisabled();
    expect(pending).toHaveAccessibleDescription(/once this order has been delivered or closed/i);
    expect(within(orders).getByRole('button', { name: 'Order SO-2026-00042 again' })).toBeEnabled();
  });
});

describe('Portal dashboard — states', () => {
  it('U-A9: pending shows a fixed-height skeleton, then the tiles', async () => {
    serveDashboard(fullDashboard());
    renderWithClient(<PortalDashboard />);
    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
    expect(await tile('orders')).toBeVisible();
    expect(screen.queryByTestId('dashboard-skeleton')).toBeNull();
  });

  it('U-A11b (HO-P6 U25): the dashboard payload has no subscriptions key; the "Next delivery" card comes only from the subscriptions endpoint', async () => {
    document.cookie = 'pc_session=test; path=/';
    try {
      const body = fullDashboard();
      expect(Object.keys(body)).not.toContain('subscriptions');
      serveDashboard(body);
      renderWithClient(<PortalDashboard />);
      await tile('orders');
      // No tile for subscriptions in the dashboard payload, and no heading invented for one.
      expect(screen.queryByTestId('tile-subscriptions')).toBeNull();
      // The card is the soonest live subscription of C3: its product, "Next delivery on {date}" and a Manage link.
      const card = await screen.findByTestId('next-delivery');
      expect(within(card).getByRole('heading', { level: 2, name: 'Next delivery' })).toBeVisible();
      expect(within(card).getByText(/^Next delivery on /)).toBeVisible();
      expect(within(card).getByRole('link', { name: 'Manage' })).toHaveAttribute(
        'href',
        expect.stringMatching(/^\/portal\/subscriptions\/[0-9a-f-]{36}$/),
      );
    } finally {
      document.cookie = 'pc_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  });

  it('U25: with no live subscription, or when C3 fails, the card is absent and nothing else changes', async () => {
    document.cookie = 'pc_session=test; path=/';
    try {
      server.use(
        http.get('*/api/customers/me/subscriptions', () =>
          HttpResponse.json({ items: [], pageNumber: 1, pageSize: 1, totalCount: 0 }),
        ),
      );
      serveDashboard(fullDashboard());
      const answered = c3Answered();
      const first = renderWithClient(<PortalDashboard />);
      await tile('orders');
      await answered;
      expect(screen.queryByTestId('next-delivery')).toBeNull();
      first.unmount();

      server.use(http.get('*/api/customers/me/subscriptions', () => HttpResponse.json({}, { status: 500 })));
      const failed = c3Answered();
      renderWithClient(<PortalDashboard />);
      expect(await tile('orders')).toBeVisible();
      await failed;
      expect(await screen.findByTestId('default-address')).toBeVisible();
      expect(screen.queryByTestId('next-delivery')).toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    } finally {
      document.cookie = 'pc_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  });

  it('U-A12: a delivered section whose key is absent reads "Not available yet", not empty and not an error', async () => {
    serveDashboard(ordersNotDeliveredDashboard());
    renderWithClient(<PortalDashboard />);
    const orders = await tile('orders');
    expect(within(orders).getByText(/Not available yet/)).toBeVisible();
    expect(within(orders).queryByText(/haven’t placed/i)).toBeNull();
    expect(within(orders).queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByTestId('tile-orders-unavailable')).toBeNull();
    expect(within(await tile('balances')).getByTestId('outstanding-BDT')).toBeVisible();
  });

  it('a whole-request failure is an error with a retry, never an empty dashboard', async () => {
    let fail = true;
    server.use(
      http.get('*/api/portal/dashboard', () =>
        fail ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(fullDashboard()),
      ),
    );
    renderWithClient(<PortalDashboard />);
    expect(
      await screen.findByRole('heading', { name: /couldn’t load your home page/i }),
    ).toBeVisible();
    expect(screen.queryByTestId('tile-orders')).toBeNull();
    fail = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await tile('orders')).toBeVisible();
  });

  it('U-A10: the header links of the tiles are the portal-links constants', async () => {
    serveDashboard(fullDashboard());
    renderWithClient(<PortalDashboard />);
    expect(within(await tile('orders')).getByRole('link', { name: /All orders/ })).toHaveAttribute(
      'href',
      PORTAL_ORDERS,
    );
    expect(
      within(await tile('balances')).getByRole('link', { name: /All invoices/ }),
    ).toHaveAttribute('href', PORTAL_BILLING);
  });

  it('U-X1: every enumeration is shown through a label map — no identifier reaches the DOM', async () => {
    serveDashboard(fullDashboard());
    renderWithClient(<PortalDashboard />);
    await tile('orders');
    const text = document.body.textContent ?? '';
    for (const identifier of ['PendingPayment', 'PartPaid']) {
      expect(text).not.toContain(identifier);
    }
    expect(text).toContain('Awaiting payment');
    expect(text).toContain('Part paid');
  });

  it('an unknown status from the wire gets a neutral label and is never echoed', async () => {
    const body = fullDashboard();
    if (body.orders?.data) body.orders.data.items[0]!.status = 'SomethingNew';
    serveDashboard(body);
    renderWithClient(<PortalDashboard />);
    await tile('orders');
    expect(document.body.textContent).not.toContain('SomethingNew');
    expect(screen.getAllByText('Status unavailable').length).toBeGreaterThan(0);
  });
});

describe('Portal dashboard — order dates', () => {
  it('an order placed at 20:00Z on 9 Oct is shown as 10 Oct (Asia/Dhaka), whatever the browser zone', async () => {
    const body = fullDashboard();
    body.orders!.data!.items[0]!.placedOn = '2026-10-09T20:00:00+00:00';
    body.orders!.data!.items[1]!.placedOn = '2026-10-09T17:59:00+00:00';
    serveDashboard(body);
    renderWithClient(<PortalDashboard />);
    const orders = await tile('orders');
    expect(within(orders).getByText(/Placed 10 Oct 2026/)).toBeVisible();
    expect(within(orders).getByText(/Placed 9 Oct 2026/)).toBeVisible();
  });
});
