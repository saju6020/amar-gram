import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { fullDashboard, portalIds } from '@/mocks/handlers/portal/fixtures';
import { resetPortalMock, serveDashboard } from './helpers';
import { setUrl } from '../common/nav-mock';
import { AccountSidebar, initialsOf } from '@/components/portal/AccountSidebar';
import { ACCOUNT_LANDING } from '@/components/portal/account-nav';
import { PortalDashboard } from '@/components/portal/dashboard/PortalDashboard';
import { MyOrdersList } from '@/components/orders/MyOrdersList';
import { MyOrderDetail } from '@/components/orders/MyOrderDetail';
import { AccountShell } from '@/components/account/AccountShell';
import { PersonalDataExportCard } from '@/components/account/PersonalDataExportCard';
import SignInPage from '@/app/(auth)/sign-in/page';
import type { CustomerOrderDetail } from '@/lib/api/my-orders';

vi.mock('next/navigation', () => import('../common/nav-mock'));
vi.mock('@/lib/hooks/useSession', () => ({
  useCustomerSession: () => ({
    data: { customerId: 'c1', fullName: 'Ayesha Rahman', expiresOn: '2030-01-01T00:00:00Z' },
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const money = (amount: string) => ({ amount, currencyCode: 'BDT' });
const ZERO = money('0.00');

function line(n: number) {
  return {
    lineId: `ln${n}`,
    lineNumber: n,
    skuId: `sku-${n}`,
    productName: `Product ${n}`,
    variantLabel: '1 kg',
    quantity: 1,
    unitPrice: money('100.00'),
    lineSubtotal: money('100.00'),
    lineDiscount: ZERO,
    orderDiscountShare: ZERO,
    taxRatePercent: 0,
    taxAmount: ZERO,
    lineTotal: money('100.00'),
  };
}

function order(overrides: Partial<CustomerOrderDetail> = {}): CustomerOrderDetail {
  return {
    id: 'o1',
    orderNumber: 'SO-2026-00042',
    placedOn: '2026-09-02T05:00:00Z',
    status: 'Delivered',
    fulfilmentMethod: 'Delivery',
    paymentMethod: 'CashOnDelivery',
    branchTimeZoneId: 'Asia/Dhaka',
    lines: [1, 2, 3, 4, 5].map(line),
    totals: {
      subtotal: money('500.00'),
      lineDiscountTotal: ZERO,
      orderDiscount: ZERO,
      deliveryCharge: ZERO,
      taxTotal: ZERO,
      grandTotal: money('500.00'),
    },
    fulfilment: {
      recipientName: 'Ayesha Rahman',
      recipientPhone: '01711111111',
      line1: '1 Road',
      line2: null,
      city: 'Dhaka',
      district: 'Dhaka',
      postalCode: null,
      deliveryInstructions: null,
      zoneName: 'Dhaka',
      serviceLevel: 'Standard',
      slotDate: null,
      slotWindow: null,
      pickupBranchId: null,
      pickupBranchName: null,
      pickupBranchAddress: null,
    },
    statusHistory: [
      { to: 'Confirmed', changedOn: '2026-09-02T05:00:00Z' },
      { to: 'Delivered', changedOn: '2026-09-03T05:00:00Z' },
    ],
    paymentDueBy: null,
    transferInstructions: null,
    customerTransferReference: null,
    shipment: null,
    collectBy: null,
    invoiceNumber: null,
    amountPaid: ZERO,
    amountRefunded: ZERO,
    refundDue: ZERO,
    refunds: [],
    returns: [],
    canCancel: false,
    canRequestReturn: false,
    returnWindowEndsOn: null,
    returnableLines: [],
    canReorder: false,
    ...overrides,
  };
}

const address = (id: string, label: string, isDefault: boolean) => ({
  id,
  label,
  line1: `${label} road`,
  line2: null,
  city: 'Dhaka',
  district: 'Dhaka',
  postalCode: null,
  deliveryInstructions: null,
  isDefault,
});

beforeEach(() => setUrl('/portal'));
afterEach(() => resetPortalMock());

describe('U32 — sign-in page (SignIn.dc.html)', () => {
  it('shows the leaf panel with reasons and the back-office link; the switch keeps ?next=', () => {
    setUrl('/sign-in?next=%2Fcheckout');
    renderWithClient(<SignInPage />);

    const panel = screen.getByRole('region', { name: 'Why sign in' });
    expect(panel).toHaveTextContent('Welcome home.');
    expect(within(panel).getAllByRole('listitem')).toHaveLength(3);
    expect(within(panel).getByRole('link', { name: 'Sign in to the back office' })).toHaveAttribute(
      'href',
      '/staff/sign-in',
    );

    const switcher = screen.getByRole('navigation', { name: 'Account' });
    expect(within(switcher).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(switcher).getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/register?next=%2Fcheckout',
    );
    // The form is the unchanged SignInForm.
    expect(screen.getByLabelText(/Mobile number or email/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('U33 — account menu', () => {
  it('on /portal/orders/123: My orders is current, labels follow the design, no Subscriptions, Sign out present', async () => {
    setUrl('/portal/orders/123');
    renderWithClient(<AccountSidebar />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: /^My orders/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: /^My orders/ })).toHaveClass('bg-leaf');
    expect(within(nav).getByRole('link', { name: 'Profile & addresses' })).toBeInTheDocument();
    for (const kept of ['Wishlist', 'My reviews', 'Billing'])
      expect(within(nav).getByRole('link', { name: kept })).toBeInTheDocument();
    expect(within(nav).queryByText(/subscriptions/i)).not.toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Sign out' })).toHaveClass('text-danger-ink');
  });

  it('keeps the exports other code imports', () => {
    expect(initialsOf('Ayesha Rahman')).toBe('AR');
    expect(ACCOUNT_LANDING).toBe('/portal/orders');
  });
});

describe('U34 — overview', () => {
  it('shows the live order, the default address, Buy again without prices, the tiles; no staples box', async () => {
    serveDashboard(fullDashboard());
    const added: unknown[] = [];
    server.use(
      http.get('*/api/customers/me/orders/:id', ({ params }) =>
        HttpResponse.json(
          params.id === portalIds.orders.pending
            ? order({
                id: portalIds.orders.pending,
                orderNumber: 'SO-2026-00061',
                status: 'Confirmed',
              })
            : order({ id: String(params.id) }),
        ),
      ),
      http.get('*/api/customers/me/addresses', () =>
        HttpResponse.json({
          maxAddresses: 10,
          addresses: [address('a1', 'Office', false), address('a2', 'Home', true)],
        }),
      ),
      http.post('*/api/cart/lines', async ({ request }) => {
        added.push(await request.json());
        return HttpResponse.json({ lineId: 'l1', cartId: 'c1' });
      }),
    );
    const user = userEvent.setup();
    renderWithClient(<PortalDashboard />);

    // The live order card: the newest open order, its tracker and a way in.
    const live = await screen.findByTestId('live-order');
    expect(within(live).getByRole('heading', { name: /Order SO-2026-00061/ })).toBeInTheDocument();
    expect(within(live).getByRole('link', { name: 'View order SO-2026-00061' })).toHaveAttribute(
      'href',
      `/portal/orders/${portalIds.orders.pending}`,
    );
    expect(await within(live).findByRole('list', { name: 'Order progress steps' })).toBeVisible();

    // Default address and the count.
    const card = await screen.findByTestId('default-address');
    expect(await within(card).findByText('2 saved addresses')).toBeVisible();
    expect(card).toHaveTextContent('Home road');
    expect(within(card).getByRole('link', { name: 'Manage addresses' })).toHaveAttribute(
      'href',
      '/portal/account/addresses',
    );

    // Buy again: four of the five lines, no price, "+" adds that sku once and turns into a tick.
    const again = await screen.findByRole('region', { name: 'Buy again' });
    const buttons = await within(again).findAllByRole('button');
    expect(buttons).toHaveLength(4);
    expect(again.textContent).not.toMatch(/৳|BDT|\d+\.\d\d/);
    await user.click(within(again).getByRole('button', { name: 'Add Product 2 1 kg to basket' }));
    await waitFor(() =>
      expect(
        within(again).getByRole('button', { name: 'Product 2 1 kg added to your basket' }),
      ).toBeDisabled(),
    );
    expect(added).toEqual([{ skuId: 'sku-2', quantity: 1 }]);

    // The tiles are kept; there is no staples box.
    expect(screen.getByTestId('tile-orders')).toBeVisible();
    expect(screen.getByTestId('tile-balances')).toBeVisible();
    expect(screen.queryByText(/staples box/i)).not.toBeInTheDocument();
  });
});

describe('U35 — my orders list', () => {
  it('cards say "Order {no}", a status pill, "date · N items · total"; the filter and paging stay', async () => {
    setUrl('/portal/orders');
    server.use(
      http.get('*/api/customers/me/orders', () =>
        HttpResponse.json({
          items: [
            {
              id: 'o1',
              orderNumber: 'ORD-1',
              placedOn: '2026-10-16T04:10:00Z',
              status: 'Dispatched',
              fulfilmentMethod: 'Delivery',
              paymentMethod: 'CashOnDelivery',
              grandTotal: money('1330.00'),
              itemCount: 4,
              branchTimeZoneId: 'Asia/Dhaka',
            },
          ],
          totalCount: 25,
          pageNumber: 1,
          pageSize: 10,
        }),
      ),
    );
    renderWithClient(<MyOrdersList />);
    const link = await screen.findByRole('link', { name: 'View order ORD-1' });
    expect(link).toHaveTextContent('Order ORD-1');
    expect(link).toHaveTextContent(/16 Oct · 4 items · .*1,330/);
    expect(link).toHaveTextContent('Dispatched');
    expect(screen.getByRole('heading', { level: 1, name: 'My orders' })).toBeInTheDocument();
    expect(screen.getByLabelText('Show')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Pages' })).toHaveTextContent('Page 1 of 3');
  });
});

describe('U36 — order detail', () => {
  it('delivered with a return window and an invoice: Order again, the invoice link, Return an item; no batch', async () => {
    server.use(
      http.get('*/api/customers/me/orders/o1', () =>
        HttpResponse.json(
          order({
            canReorder: true,
            canRequestReturn: true,
            invoiceNumber: 'INV-2026-00042',
          }),
        ),
      ),
      http.get('*/api/branches', () => HttpResponse.json([])),
    );
    renderWithClient(<MyOrderDetail orderId="o1" />);
    expect(await screen.findByRole('list', { name: 'Order progress steps' })).toBeVisible();
    expect(screen.getByRole('list', { name: 'Items in this order' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Order again' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Invoice INV-2026-00042' })).toHaveAttribute(
      'href',
      '/portal/billing',
    );
    expect(screen.getByRole('link', { name: 'Return an item' })).toHaveAttribute(
      'href',
      '/portal/orders/o1/return',
    );
    expect(document.body.textContent).not.toMatch(/batch/i);
    expect(screen.queryByTestId('order-placed')).not.toBeInTheDocument();
  });

  it('no Return an item link when the server says no return can be requested', async () => {
    server.use(
      http.get('*/api/customers/me/orders/o1', () =>
        HttpResponse.json(order({ canRequestReturn: false })),
      ),
      http.get('*/api/branches', () => HttpResponse.json([])),
    );
    renderWithClient(<MyOrderDetail orderId="o1" />);
    await screen.findByRole('list', { name: 'Order progress steps' });
    expect(screen.queryByRole('link', { name: 'Return an item' })).not.toBeInTheDocument();
  });
});

describe('U37 — confirmation block', () => {
  it('?placed=1 on a cash order says where it arrives and what to have ready', async () => {
    server.use(
      http.get('*/api/customers/me/orders/o1', () =>
        HttpResponse.json(
          order({
            status: 'Confirmed',
            fulfilment: { ...order().fulfilment, slotWindow: 'Today 4pm – 8pm' },
          }),
        ),
      ),
      http.get('*/api/branches', () => HttpResponse.json([])),
    );
    renderWithClient(<MyOrderDetail orderId="o1" justPlaced />);
    const block = await screen.findByTestId('order-placed');
    expect(block).toHaveTextContent(
      /Order SO-2026-00042 arrives Today 4pm – 8pm at 1 Road, Dhaka, Dhaka\./,
    );
    expect(block).toHaveTextContent(/Please keep .*500.* in cash ready\./);
  });
});

describe('U38 — profile pages', () => {
  it('the tabs are a pill row with the current one in leaf; the deletion route is a link, not an inline box', () => {
    setUrl('/portal/account/addresses');
    renderWithClient(
      <AccountShell>
        <PersonalDataExportCard onExport={vi.fn()} isPending={false} />
      </AccountShell>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Profile & addresses' }),
    ).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Account' });
    expect(within(tabs).getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Profile',
      'Addresses',
      'Notifications',
      'Your data',
    ]);
    expect(within(tabs).getByRole('link', { name: 'Addresses' })).toHaveClass('bg-leaf');
    expect(within(tabs).getByRole('link', { name: 'Profile' })).not.toHaveClass('bg-leaf');
    expect(screen.getByRole('link', { name: 'Delete my account' })).toHaveAttribute(
      'href',
      '/portal/account/data/delete',
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
