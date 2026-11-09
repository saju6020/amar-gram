import { Suspense } from 'react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { resetShopMockData, shopFixtureIds } from '@/mocks/handlers/shop';
import { findById } from '@/mocks/handlers/shop/store';
import ProductDetailsPage from '@/app/(staff)/staff/shop/products/[productId]/page';
import { renderWithClient } from '../product/test-utils';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/staff/shop/products',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => resetShopMockData());

async function renderPage(productId: string) {
  const element: ReactElement = (
    <Suspense fallback={null}>
      <ProductDetailsPage params={Promise.resolve({ productId })} />
    </Suspense>
  );
  await act(async () => {
    renderWithClient(element);
  });
}

const CHECKBOX = { name: 'Can be subscribed to' };

/**
 * U35 (HO-P6 S3, §11.4.2, A15) -- the product editor's "Can be subscribed to" checkbox: it reflects the stored flag, and
 * saving sends the boolean shown, in the same details `PUT` as `expectedVersion`.
 */
describe('Product editor -- Can be subscribed to (U35)', () => {
  it('reflects a non-subscribable product, explains the consequence, and is a 44 px control', async () => {
    await renderPage(shopFixtureIds.kitProductId);
    const box = await screen.findByRole('checkbox', CHECKBOX, { timeout: 4000 });
    expect(box).not.toBeChecked();
    expect(box).toHaveAccessibleDescription(
      'Customers can start a repeat delivery of any pack size. Turning it off stops new subscriptions; existing subscriptions carry on as normal.',
    );
    // jsdom has no layout: the clickable label carries the 44 px height.
    expect(box.closest('label')).toHaveClass('min-h-11');
  });

  it('reflects a subscribable product', async () => {
    await renderPage(shopFixtureIds.multiVariantProductId);
    expect(await screen.findByRole('checkbox', CHECKBOX, { timeout: 4000 })).toBeChecked();
  });

  it('ticking it and saving sends isSubscribable: true with expectedVersion in the one details PUT', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    let puts = 0;
    server.use(
      http.put('*/api/staff/shop/products/:productId', async ({ request }) => {
        puts += 1;
        body = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderPage(shopFixtureIds.kitProductId);
    await user.click(await screen.findByRole('checkbox', CHECKBOX, { timeout: 4000 }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(puts).toBe(1);
    expect(body).toMatchObject({ isSubscribable: true, expectedVersion: expect.any(Number) });
  });

  it('unticking it sends false, not an omitted field', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.put('*/api/staff/shop/products/:productId', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderPage(shopFixtureIds.multiVariantProductId);
    await user.click(await screen.findByRole('checkbox', CHECKBOX, { timeout: 4000 }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toHaveProperty('isSubscribable', false);
  });

  it('against the shop mock the saved flag sticks on the product', async () => {
    const user = userEvent.setup();
    await renderPage(shopFixtureIds.kitProductId);
    await user.click(await screen.findByRole('checkbox', CHECKBOX, { timeout: 4000 }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(findById(shopFixtureIds.kitProductId)?.isSubscribable).toBe(true));
  });
});
