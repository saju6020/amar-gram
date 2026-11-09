import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { server } from '@/mocks/server';
import { violation } from '@/mocks/handlers/ordering/fixtures';
import { orderingIds, resetOrderingMockData } from '@/mocks/handlers/ordering';
import { db as orderingDb, p5OrderIds } from '@/mocks/handlers/ordering/store';
import { resetShopMockData, shopFixtureIds } from '@/mocks/handlers/shop';
import { CheckoutScreen } from '@/components/checkout/CheckoutScreen';
import { MyOrderDetail } from '@/components/orders/MyOrderDetail';
import { apiFetch, ApiConflictError, ApiValidationError } from '@/lib/api/client';
import { getCheckoutQuote, placeOrder } from '@/lib/api/checkout';
import type { CheckoutQuote } from '@/lib/api/checkout';
import type { Cart } from '@/lib/api/cart';
import type { CustomerOrderDetail } from '@/lib/api/my-orders';
import { signInForTest, signOutForTest } from '../product/test-utils';
import { currentCheckoutUrl, pushed, setCheckoutUrl } from './nav';

/**
 * HO-P5 S1 §15 U13 (the checkout rider note), U14 (a server 400 naming `RiderNote`), U15 (the note on the
 * customer's order), the `Packed` hero of `MyOrderDetail` (Amended (b)), and the U47 mock refusals for the
 * place-order note (App/CommandHandlers/Validators/PlaceOrderCommandValidator.cs:24).
 */

vi.mock('next/navigation', () => import('./nav'));
// Passes through to the real `placeOrder`; only records what the screen hands it.
vi.mock('@/lib/api/checkout', async (original) => {
  const actual = await original<typeof import('@/lib/api/checkout')>();
  return { ...actual, placeOrder: vi.fn(actual.placeOrder) };
});

const money = (amount: string) => ({ amount, currencyCode: 'BDT' });

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const QUOTE: CheckoutQuote = {
  lines: [
    {
      lineRef: 'q1',
      skuId: 's1',
      productName: 'Organic Rolled Oats',
      variantLabel: '2 kg',
      quantity: 2,
      unitPrice: money('2450.00'),
      lineSubtotal: money('4900.00'),
      lineDiscount: money('0.00'),
      orderDiscountShare: money('0.00'),
      taxRatePercent: 0,
      taxAmount: money('0.00'),
      lineTotal: money('4900.00'),
    },
  ],
  excludedLines: [],
  changes: [],
  delivery: {
    available: true,
    unavailableReason: null,
    zoneId: 'z1',
    zoneName: 'Dhaka',
    serviceLevels: [],
  },
  selectedServiceLevel: null,
  pickupBranches: [{ id: 'br1', name: 'Main shop', address: 'Road 1', phone: null }],
  paymentOptions: [
    { method: 'CashOnDelivery', available: true, unavailableReason: null, message: null },
    { method: 'PayOnCollection', available: true, unavailableReason: null, message: null },
  ],
  discount: null,
  totals: {
    subtotal: money('4900.00'),
    lineDiscountTotal: money('0.00'),
    orderDiscount: money('0.00'),
    deliveryCharge: money('0.00'),
    taxTotal: money('0.00'),
    grandTotal: money('4900.00'),
  },
  pendingPolicies: [],
  canPlace: true,
  blockingReasons: [],
  fingerprint: 'F1',
  currencyCode: 'BDT',
};

const CART: Cart = {
  cartId: 'c1',
  lines: [
    {
      lineId: 'l1',
      skuId: 's1',
      productId: 'p1',
      productName: 'Organic Rolled Oats',
      variantLabel: '2 kg',
      imagePath: null,
      quantity: 2,
      unitPrice: money('2450.00'),
      priceWhenAdded: money('2450.00'),
      priceChanged: false,
      availability: 'InStock',
      availableQuantity: null,
      lineSubtotal: money('4900.00'),
    },
  ],
  itemCount: 2,
  subtotal: money('4900.00'),
  maxQuantityPerLine: 20,
  guestCartPending: false,
};

function serveCheckout() {
  server.use(
    http.get('*/api/cart', () => HttpResponse.json(CART)),
    http.get('*/api/customers/me', () =>
      HttpResponse.json({
        fullName: 'Sam Rahman',
        mobileNumber: '01711111111',
        emailAddress: null,
        hasMobileNumber: true,
        hasEmailAddress: false,
        canEditEmail: false,
        additionalPhoneNumbers: [],
        registeredOn: '2026-01-01',
      }),
    ),
    http.get('*/api/customers/me/addresses', () =>
      HttpResponse.json({ addresses: [], maxAddresses: 5 }),
    ),
    http.get('*/api/customers/me/checkout/quote', () => HttpResponse.json(QUOTE)),
  );
}

const DELIVERY_URL = '/checkout?fulfilment=Delivery&addressId=a1&paymentMethod=CashOnDelivery';
const PICKUP_URL = '/checkout?fulfilment=Pickup&pickupBranchId=br1&paymentMethod=PayOnCollection';
const PLACED = {
  orderId: 'o2',
  orderNumber: 'ORD-2',
  status: 'Confirmed',
  grandTotal: money('4900.00'),
  paymentDueBy: null,
  transferInstructions: null,
};

const noteField = () => screen.queryByLabelText('Note for the rider (optional)');
const placeButton = () => screen.findByRole('button', { name: /^Place order/ });

beforeEach(() => {
  pushed.length = 0;
  setCheckoutUrl('/checkout');
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('U13: the checkout rider note', () => {
  it('is a labelled field in section 3 for Delivery, with maxLength 300 and a live count', async () => {
    serveCheckout();
    setCheckoutUrl(DELIVERY_URL);
    const user = userEvent.setup();
    renderWithClient(<CheckoutScreen />);
    await placeButton();
    const payment = screen.getByRole('region', { name: 'Payment' });
    const field = within(payment).getByLabelText('Note for the rider (optional)');
    expect(field).toHaveAttribute('maxlength', '300');
    expect(field).toHaveAttribute('placeholder', 'e.g. call before you come up');
    expect(within(payment).getByText('0 of 300')).toBeInTheDocument();
    await user.type(field, 'Call me');
    expect(within(payment).getByText('7 of 300')).toBeInTheDocument();
    expect(field).toHaveAccessibleDescription('7 of 300');
  });

  it('is absent for Pickup', async () => {
    serveCheckout();
    setCheckoutUrl(PICKUP_URL);
    renderWithClient(<CheckoutScreen />);
    await placeButton();
    expect(noteField()).not.toBeInTheDocument();
    expect(screen.queryByText(/of 300/)).not.toBeInTheDocument();
  });

  it('sends the trimmed note for Delivery, and never writes it to the URL or to storage', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    serveCheckout();
    server.use(
      http.post('*/api/customers/me/orders', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(PLACED, { status: 201 });
      }),
    );
    setCheckoutUrl(DELIVERY_URL);
    const user = userEvent.setup();
    renderWithClient(<CheckoutScreen />);
    await placeButton();
    await user.type(noteField()!, '  Ring twice, the gate is stiff  ');
    expect(currentCheckoutUrl()).toBe(DELIVERY_URL);
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain('gate is stiff');
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('gate is stiff');
    await user.click(screen.getByRole('button', { name: /^Place order/ }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.riderNote).toBe('Ring twice, the gate is stiff');
    expect(bodies[0]!.fulfilment).toBe('Delivery');
    expect(currentCheckoutUrl()).not.toContain('gate');
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain('gate is stiff');
  });

  // The two Delivery-only guards each hold on their own: the screen never hands a note to `placeOrder`
  // for Pickup, and `placeOrder` never puts one on the wire for Pickup even if it is given one.
  it('screen guard: the request the screen builds for Pickup carries no riderNote', async () => {
    vi.mocked(placeOrder).mockClear();
    serveCheckout();
    server.use(
      http.post('*/api/customers/me/orders', () => HttpResponse.json(PLACED, { status: 201 })),
    );
    setCheckoutUrl(DELIVERY_URL);
    const user = userEvent.setup();
    renderWithClient(<CheckoutScreen />);
    await placeButton();
    await user.type(noteField()!, 'Ring twice');
    setCheckoutUrl(PICKUP_URL);
    await waitFor(() => expect(noteField()).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Place order/ })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: /^Place order/ }));
    await waitFor(() => expect(placeOrder).toHaveBeenCalledTimes(1));
    const request = vi.mocked(placeOrder).mock.calls[0]![0];
    expect(request.fulfilment).toBe('Pickup');
    expect(request.riderNote).toBeUndefined();
  });

  it('client guard: placeOrder drops a note given with Pickup, and trims one given with Delivery', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    server.use(
      http.post('*/api/customers/me/orders', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(PLACED, { status: 201 });
      }),
    );
    const { placeOrder: realPlaceOrder } = await vi.importActual<typeof import('@/lib/api/checkout')>(
      '@/lib/api/checkout',
    );
    await realPlaceOrder(
      { fulfilment: 'Pickup', pickupBranchId: 'br1', paymentMethod: 'PayOnCollection', riderNote: 'Ring twice', quoteFingerprint: 'F1' },
      'k-a',
    );
    await realPlaceOrder(
      { fulfilment: 'Delivery', addressId: 'a1', paymentMethod: 'CashOnDelivery', riderNote: '  Ring twice  ', quoteFingerprint: 'F1' },
      'k-b',
    );
    expect('riderNote' in bodies[0]!).toBe(false);
    expect(bodies[1]!.riderNote).toBe('Ring twice');
  });

  it('a whitespace-only note sends nothing', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    serveCheckout();
    server.use(
      http.post('*/api/customers/me/orders', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(PLACED, { status: 201 });
      }),
    );
    setCheckoutUrl(DELIVERY_URL);
    const user = userEvent.setup();
    renderWithClient(<CheckoutScreen />);
    await placeButton();
    await user.type(noteField()!, '    ');
    expect(screen.getByText('4 of 300')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Place order/ }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect('riderNote' in bodies[0]!).toBe(false);
  });

  it('sends no note at all for Pickup, even after one was typed for Delivery', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    serveCheckout();
    server.use(
      http.post('*/api/customers/me/orders', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(PLACED, { status: 201 });
      }),
    );
    setCheckoutUrl(DELIVERY_URL);
    const user = userEvent.setup();
    const view = renderWithClient(<CheckoutScreen />);
    await placeButton();
    await user.type(noteField()!, 'Ring twice');
    setCheckoutUrl(PICKUP_URL);
    await waitFor(() => expect(noteField()).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Place order/ })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: /^Place order/ }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]!.fulfilment).toBe('Pickup');
    expect('riderNote' in bodies[0]!).toBe(false);
    view.unmount();
  });

  it('a retry after a network failure reuses the same Idempotency-Key and the same note', async () => {
    const seen: Array<{ key: string | null; note: unknown }> = [];
    serveCheckout();
    server.use(
      http.post('*/api/customers/me/orders', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        seen.push({ key: request.headers.get('Idempotency-Key'), note: body.riderNote });
        if (seen.length === 1) return HttpResponse.error();
        return HttpResponse.json(PLACED, { status: 201 });
      }),
    );
    setCheckoutUrl(DELIVERY_URL);
    const user = userEvent.setup();
    renderWithClient(<CheckoutScreen />);
    await placeButton();
    await user.type(noteField()!, 'Call before you come up');
    await user.click(screen.getByRole('button', { name: /^Place order/ }));
    await waitFor(() => expect(seen).toHaveLength(1));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Place order/ })).toBeEnabled(),
    );
    // The field kept what was typed through the failure.
    expect(noteField()).toHaveValue('Call before you come up');
    await user.click(screen.getByRole('button', { name: /^Place order/ }));
    await waitFor(() => expect(seen).toHaveLength(2));
    expect(seen[0]!.key).toBeTruthy();
    expect(seen[1]!.key).toBe(seen[0]!.key);
    expect(seen[1]!.note).toBe('Call before you come up');
    await waitFor(() => expect(pushed).toEqual(['/portal/orders/o2?placed=1']));
  });
});

describe('U14: a server 400 naming RiderNote', () => {
  it('shows the problem under the field and leaves Place order available', async () => {
    serveCheckout();
    server.use(
      http.post('*/api/customers/me/orders', () =>
        violation(
          'RiderNote',
          'MaximumLengthValidator',
          "The length of 'Rider Note' must be 300 characters or fewer. You entered 301 characters.",
        ),
      ),
    );
    setCheckoutUrl(DELIVERY_URL);
    const user = userEvent.setup();
    renderWithClient(<CheckoutScreen />);
    await placeButton();
    await user.type(noteField()!, 'Call me');
    await user.click(screen.getByRole('button', { name: /^Place order/ }));
    const payment = screen.getByRole('region', { name: 'Payment' });
    const alert = await within(payment).findByRole('alert');
    expect(alert).toHaveTextContent(/Your note for the rider could not be accepted/);
    expect(noteField()).toHaveAttribute('aria-invalid', 'true');
    expect(noteField()).toHaveValue('Call me');
    expect(screen.getByRole('button', { name: /^Place order/ })).toBeEnabled();
    // Editing the note clears the message.
    await user.type(noteField()!, '!');
    expect(within(payment).queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('U15: the note on the customer’s order, and the Packed hero', () => {
  beforeEach(() => {
    resetOrderingMockData();
    resetShopMockData();
    signInForTest();
  });

  it('renders the note as plain text, markup shown literally', async () => {
    server.use(
      http.get('*/api/customers/me/orders/o9', async ({ request }) => {
        const real = await fetch(
          new URL(`/api/customers/me/orders/${orderingIds.orders.delivered}`, request.url),
          { headers: { cookie: request.headers.get('cookie') ?? '' } },
        );
        const detail = (await real.json()) as CustomerOrderDetail;
        detail.fulfilment.riderNote = '<b>Ring</b> twice <img src=x onerror=alert(1)>';
        return HttpResponse.json(detail);
      }),
      http.get('*/api/branches', () => HttpResponse.json([])),
    );
    const { container } = renderWithClient(<MyOrderDetail orderId="o9" />);
    const term = await screen.findByText('Note for the rider');
    expect(term.nextElementSibling).toHaveTextContent('<b>Ring</b> twice <img src=x onerror=alert(1)>');
    expect(container.querySelector('dd b, dd img')).toBeNull();
  });

  it('shows the seeded note on a delivery order and nothing when there is none', async () => {
    renderWithClient(<MyOrderDetail orderId={orderingIds.orders.delivered} />);
    const term = await screen.findByText('Note for the rider');
    expect(term.nextElementSibling).toHaveTextContent(
      'Please ring the bell twice; the gate is stiff.',
    );
  });

  it('a Packed order gets its hero and a cancel hint, and the Packing node stays current', async () => {
    // The seeded Packed order belongs to another customer; hand it to the signed-in one for this screen.
    orderingDb.orders.find((o) => o.id === p5OrderIds.packedWaiting)!.customerId =
      orderingIds.customerId;
    renderWithClient(<MyOrderDetail orderId={p5OrderIds.packedWaiting} />);
    expect(await screen.findByRole('heading', { name: 'Your order is packed' })).toBeInTheDocument();
    expect(screen.getByText(/It’s packed and we’ll tell you when/)).toBeInTheDocument();
    // A customer cannot cancel from Packed: the button is disabled and says why (the Packed cancel hint).
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeDisabled();
    expect(screen.getByText(/It’s already packed, so it can’t be cancelled here./)).toBeInTheDocument();
    // The tracker keeps the Packing node as the current step; Placed and Confirmed are done.
    const current = document.querySelectorAll('li[aria-current="step"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(/Packing/);
    expect(document.querySelectorAll('li[data-status="done"]').length).toBeGreaterThanOrEqual(2);
    // The Packed return hint: a disabled Return button that says when it opens.
    expect(screen.getByRole('button', { name: 'Return an item' })).toBeDisabled();
    expect(
      screen.getByText('You can request a return once the order has been delivered.'),
    ).toBeInTheDocument();
  });

  it('a Packed pickup order gets the pickup hero sentence', async () => {
    const packed = orderingDb.orders.find((o) => o.id === p5OrderIds.packedWaiting)!;
    packed.customerId = orderingIds.customerId;
    packed.fulfilmentMethod = 'Pickup';
    renderWithClient(<MyOrderDetail orderId={p5OrderIds.packedWaiting} />);
    expect(await screen.findByRole('heading', { name: 'Your order is packed' })).toBeInTheDocument();
    expect(
      screen.getByText('It’s packed and we’ll tell you when it’s ready to collect.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/on its way/)).not.toBeInTheDocument();
  });
});

describe('U47: the place-order mock refuses and keeps what the server does', () => {
  beforeEach(() => {
    resetOrderingMockData();
    resetShopMockData();
    signInForTest();
  });
  afterAll(() => signOutForTest());

  async function refusal(request: Promise<unknown>) {
    const error = await request.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiValidationError);
    return (error as ApiValidationError).response.errors;
  }

  it('a note over 300 characters is a 400 on RiderNote (PlaceOrderCommandValidator.cs:24)', async () => {
    const errors = await refusal(
      apiFetch('/api/customers/me/orders', {
        method: 'POST',
        idempotencyKey: 'k1',
        body: { fulfilment: 'Delivery', riderNote: 'x'.repeat(301), quoteFingerprint: 'x' },
      }),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ propertyName: 'RiderNote', errorCode: 'MaximumLengthValidator' });
  });

  it('a control character is a 400 on RiderNote, and tab, LF and CR are allowed', async () => {
    const post = (riderNote: string, key: string) =>
      apiFetch('/api/customers/me/orders', {
        method: 'POST',
        idempotencyKey: key,
        body: { fulfilment: 'Delivery', riderNote, quoteFingerprint: 'x' },
      });
    const errors = await refusal(post('ring\u0007twice', 'k2'));
    expect(errors[0]).toMatchObject({ propertyName: 'RiderNote', errorCode: 'PredicateValidator' });
    // Both rules failing is two violations, as FluentValidation reports them.
    const both = await refusal(post(`${'x'.repeat(300)}\u0000`, 'k3'));
    expect(both.map((e) => e.errorCode).sort()).toEqual(['MaximumLengthValidator', 'PredicateValidator']);
    // Allowed characters and exactly 300 pass the validator and reach the quote check (409), not a 400.
    await expect(post('line one\nline two\ttab\r', 'k4')).rejects.toBeInstanceOf(ApiConflictError);
    await expect(post('x'.repeat(300), 'k5')).rejects.toBeInstanceOf(ApiConflictError);
  });

  it('keeps the note for Delivery and drops it for Pickup, reading back as fulfilment.riderNote', async () => {
    // The mock reads the address book from the accounts API; serve one saved address.
    server.use(
      http.get('*/api/customers/me/addresses', () =>
        HttpResponse.json({
          addresses: [
            {
              id: 'a1',
              label: 'Home',
              line1: '1 Road',
              line2: null,
              city: 'Dhaka',
              district: 'Dhaka',
              postalCode: null,
              deliveryInstructions: null,
              isDefault: true,
            },
          ],
          maxAddresses: 5,
        }),
      ),
    );
    const addressId = 'a1';

    async function place(
      choice: Record<string, string>,
      riderNote: string,
      key: string,
    ) {
      await apiFetch('/api/cart/lines', {
        method: 'POST',
        body: { skuId: shopFixtureIds.skuOats400, quantity: 1 },
      });
      const quote = await getCheckoutQuote(choice as never);
      const placed = await apiFetch<{ orderId: string }>('/api/customers/me/orders', {
        method: 'POST',
        idempotencyKey: key,
        body: { ...choice, riderNote, quoteFingerprint: quote.fingerprint },
      });
      return apiFetch<CustomerOrderDetail>(`/api/customers/me/orders/${placed.orderId}`);
    }

    const delivery = await place(
      { fulfilment: 'Delivery', addressId: addressId!, paymentMethod: 'CashOnDelivery' },
      'Ring twice',
      'k-delivery',
    );
    expect(delivery.fulfilment.riderNote).toBe('Ring twice');

    const pickup = await place(
      {
        fulfilment: 'Pickup',
        pickupBranchId: orderingIds.mainBranchId,
        paymentMethod: 'PayOnCollection',
      },
      'Ring twice',
      'k-pickup',
    );
    expect(pickup.fulfilment.riderNote).toBeNull();
  });
});

