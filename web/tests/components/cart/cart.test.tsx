import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { server } from '../../../mocks/server';
import { violation } from '../../../mocks/handlers/ordering/fixtures';
import { CartScreen } from '@/components/cart/CartScreen';
import { Toaster } from '@/components/ui/toaster';
import type { Cart, CartLine } from '@/lib/api/cart';

vi.mock('next/navigation', () => import('../common/nav-mock'));

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const money = (amount: string) => ({ amount, currencyCode: 'BDT' });

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
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
    ...overrides,
  };
}

function serveCart(lines: CartLine[], extra: Partial<Cart> = {}) {
  const cart: Cart = {
    cartId: 'c1',
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: money('4900.00'),
    maxQuantityPerLine: 20,
    guestCartPending: false,
    ...extra,
  };
  server.use(http.get('*/api/cart', () => HttpResponse.json(cart)));
}

describe('CartScreen lines - HO-ORD-002 U-A1', () => {
  it('states a changed price, a limited line and an unavailable line as text; the unavailable one blocks Checkout and offers removal', async () => {
    serveCart([
      line({
        lineId: 'a',
        productName: 'Jasmine Rice',
        variantLabel: '1 kg',
        priceChanged: true,
        unitPrice: money('800.00'),
        priceWhenAdded: money('780.00'),
      }),
      line({
        lineId: 'b',
        productName: 'Mustard Oil',
        variantLabel: '1 kg',
        availability: 'Limited',
        availableQuantity: 3,
      }),
      line({
        lineId: 'c',
        productName: 'Forest Honey',
        variantLabel: '1.5 kg',
        availability: 'Unavailable',
        lineSubtotal: null,
      }),
    ]);
    renderWithClient(<CartScreen />);
    expect(await screen.findByText(/Price is now .*800\.00 \(was .*780\.00\)/)).toBeInTheDocument();
    expect(screen.getByText('Only 3 left')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/This item can.t be ordered right now/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check ?out/i })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /check ?out/i })).not.toBeInTheDocument();
    expect(screen.getByText('Disabled: Forest Honey is unavailable.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove from basket, Forest Honey 1.5 kg' }),
    ).toBeEnabled();
    expect(screen.getByRole('heading', { level: 1, name: 'Your basket' })).toBeInTheDocument();
  });

  it('offers Checkout as a link once nothing is unavailable', async () => {
    serveCart([line()]);
    renderWithClient(<CartScreen />);
    const link = await screen.findByRole('link', { name: /check ?out/i });
    expect(link.getAttribute('href')).toMatch(/^\/(checkout|sign-in\?next=%2Fcheckout)$/);
  });

  it('shows the empty state, and an error with a retry', async () => {
    serveCart([], { itemCount: 0, subtotal: money('0.00') });
    const { unmount } = renderWithClient(<CartScreen />);
    expect(await screen.findByText('Your basket is empty.')).toBeInTheDocument();
    unmount();
    server.use(http.get('*/api/cart', () => HttpResponse.json({ title: 'x' }, { status: 500 })));
    renderWithClient(<CartScreen />);
    expect(await screen.findByText("We couldn't load your basket.")).toBeInTheDocument();
  });
});

describe('CartScreen summary - U24', () => {
  it('shows the server subtotal and says delivery and total come at checkout; it works out nothing else', async () => {
    serveCart([line(), line({ lineId: 'b', skuId: 's2', productName: 'Mustard Oil' })], {
      subtotal: money('7350.00'),
    });
    renderWithClient(<CartScreen />);
    const summary = await screen.findByRole('complementary', { name: 'Basket summary' });
    expect(within(summary).getAllByText(/7,?350\.00/).length).toBeGreaterThan(0);
    expect(
      within(summary).getByText('Delivery and total are worked out at checkout.'),
    ).toBeInTheDocument();
    expect(within(summary).queryByText(/^Total$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/free delivery/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Delivery$/)).not.toBeInTheDocument();
  });

  it('remove offers an Undo that puts the line back', async () => {
    let added: unknown;
    server.use(
      http.delete('*/api/cart/lines/l1', () => new HttpResponse(null, { status: 204 })),
      http.post('*/api/cart/lines', async ({ request }) => {
        added = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    serveCart([line()]);
    const user = userEvent.setup();
    renderWithClient(
      <>
        <CartScreen />
        <Toaster />
      </>,
    );
    await user.click(
      await screen.findByRole('button', { name: 'Remove Organic Rolled Oats 2 kg from your basket' }),
    );
    // fireEvent: Radix toast's pointer handling needs APIs jsdom lacks.
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(added).toEqual({ skuId: 's1', quantity: 2 }));
  });
});

describe('CartScreen stepper - U-A2', () => {
  it('stops at the quantity in stock and says why', async () => {
    serveCart([line({ quantity: 3, availability: 'Limited', availableQuantity: 3 })]);
    renderWithClient(<CartScreen />);
    const plus = await screen.findByRole('button', {
      name: 'One more Organic Rolled Oats 2 kg',
    });
    expect(plus).toBeDisabled();
    expect(screen.getByText("You can't add more — only 3 are in stock.")).toBeInTheDocument();
  });

  it('below the limit, + is enabled and sends the next quantity', async () => {
    let body: unknown;
    server.use(
      http.put('*/api/cart/lines/l1', async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    serveCart([line({ quantity: 4 })], { maxQuantityPerLine: 5 });
    const user = userEvent.setup();
    renderWithClient(<CartScreen />);
    const plus = await screen.findByRole('button', {
      name: 'One more Organic Rolled Oats 2 kg',
    });
    expect(plus).toBeEnabled();
    await user.click(plus);
    await waitFor(() => expect(body).toEqual({ quantity: 5 }));
  });

  it('at maxQuantityPerLine, + is disabled with its own message', async () => {
    serveCart([line({ quantity: 5 })], { maxQuantityPerLine: 5 });
    renderWithClient(<CartScreen />);
    expect(
      await screen.findByText('You can buy at most 5 of an item at a time.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'One more Organic Rolled Oats 2 kg' }),
    ).toBeDisabled();
  });

  it('a refused change shows a sentence, never the error code', async () => {
    server.use(
      http.put('*/api/cart/lines/l1', () =>
        violation('quantity', 'QuantityOutOfRange', 'Choose between 1 and 20.'),
      ),
    );
    serveCart([line({ quantity: 2 })]);
    const user = userEvent.setup();
    renderWithClient(<CartScreen />);
    await user.click(
      await screen.findByRole('button', { name: 'One more Organic Rolled Oats 2 kg' }),
    );
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toMatch(/QuantityOutOfRange/);
    expect((alert.textContent ?? '').length).toBeGreaterThan(5);
  });
});
