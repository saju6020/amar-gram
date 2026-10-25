import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { server } from '../../../mocks/server';
import { AddToCartButton } from '@/components/cart/AddToCartButton';

vi.mock('next/navigation', () => import('../common/nav-mock'));

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('AddToCartButton - U-A4', () => {
  it('posts the SKU and quantity and announces the result', async () => {
    let body: unknown;
    server.use(
      http.post('*/api/cart/lines', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ lineId: 'x', cartId: 'y' });
      }),
    );
    const user = userEvent.setup();
    renderWithClient(<AddToCartButton skuId="s" productName="Forest Honey" />);
    await user.click(screen.getByRole('button', { name: 'Add to basket' }));
    await waitFor(() => expect(body).toEqual({ skuId: 's', quantity: 1 }));
    expect(await screen.findByText(/Added 1 × Forest Honey to your basket\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View basket' })).toHaveAttribute('href', '/cart');
  });

  it('disabled: says why in text', () => {
    renderWithClient(
      <AddToCartButton
        skuId="s"
        productName="Forest Honey"
        disabled
        disabledReason="This variant is out of stock."
      />,
    );
    expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled();
    expect(screen.getByText('This variant is out of stock.')).toBeInTheDocument();
  });
});
