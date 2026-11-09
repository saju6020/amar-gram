import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { resetShopMockData, shopFixtureIds } from '@/mocks/handlers/shop';
import ProductDetailsPage from '@/app/(staff)/staff/shop/products/[productId]/page';
import ProductTranslationsPage from '@/app/(staff)/staff/shop/products/[productId]/translations/page';
import { renderWithClient } from '../product/test-utils';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/staff/shop/products/x',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => resetShopMockData());

async function renderPage(element: React.ReactElement) {
  await act(async () => {
    renderWithClient(<Suspense fallback={null}>{element}</Suspense>);
  });
}

describe('two-command saves keep the form when the second command is refused — NFR-USA-5', () => {
  it('details then slug: details saved, slug refused → typed slug and a partial-success message stay', async () => {
    const user = userEvent.setup();
    await renderPage(
      <ProductDetailsPage
        params={Promise.resolve({ productId: shopFixtureIds.unmetChecklistProductId })}
      />,
    );
    const slug = await screen.findByLabelText(/Web address/, {}, { timeout: 4000 });
    await user.clear(slug);
    await user.type(slug, shopFixtureIds.multiVariantSlug); // already used by another product
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const alert = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(alert).toHaveTextContent(
      'Details saved; the web address was not changed — This slug is already in use.',
    );
    // The form was NOT remounted by the refetch that follows the first command.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.getByLabelText(/Web address/)).toHaveValue(shopFixtureIds.multiVariantSlug);
    expect(document.body.textContent).not.toContain('SlugAlreadyInUse');
  });
});

describe('a 409 on the second command is a conflict with Reload — S13', () => {
  const slugConflict = () =>
    server.use(
      http.put('*/api/staff/shop/products/:productId/slug', () =>
        HttpResponse.json({ title: 'Conflict' }, { status: 409 }),
      ),
    );

  async function saveWithNewSlug(user: ReturnType<typeof userEvent.setup>) {
    await renderPage(
      <ProductDetailsPage
        params={Promise.resolve({ productId: shopFixtureIds.unmetChecklistProductId })}
      />,
    );
    const slug = await screen.findByLabelText(/Web address/, {}, { timeout: 4000 });
    await user.clear(slug);
    await user.type(slug, 'typed-by-the-user');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Reload' }, { timeout: 4000 });
  }

  it('shows the conflict message with a Reload button', async () => {
    slugConflict();
    await saveWithNewSlug(userEvent.setup());
    expect(screen.getByRole('alert')).toHaveTextContent(/changed by someone else/);
  });

  it('Reload keeps the typed values when the refetch fails', async () => {
    const user = userEvent.setup();
    slugConflict();
    await saveWithNewSlug(user);
    server.use(
      http.get('*/api/staff/shop/products/:productId', () =>
        HttpResponse.json({ title: 'down' }, { status: 500 }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.getByLabelText(/Web address/)).toHaveValue('typed-by-the-user');
  });

  it('Reload re-initialises the form when the refetch succeeds', async () => {
    const user = userEvent.setup();
    slugConflict();
    await saveWithNewSlug(user);
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await vi.waitFor(() =>
      expect(screen.getByLabelText(/Web address/)).not.toHaveValue('typed-by-the-user'),
    );
  });
});

describe('saving one locale keeps typing in the others — S9', () => {
  it('does not remount the editor when one locale is saved', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/api/shop/locales', () =>
        HttpResponse.json({ defaultLocale: 'en', locales: ['en', 'bn', 'fr'] }),
      ),
    );
    await renderPage(
      <ProductTranslationsPage
        params={Promise.resolve({ productId: shopFixtureIds.unmetChecklistProductId })}
      />,
    );
    const field = (locale: string) =>
      document.querySelector<HTMLInputElement>(`#tr-${locale}-name`)!;
    await vi.waitFor(() => expect(field('fr')).toBeTruthy(), { timeout: 4000 });
    await user.type(field('fr'), 'Croquettes');
    await user.type(field('bn'), 'Nam');
    await user.click(screen.getByRole('button', { name: 'Save Bangla' }));
    // The save, the product invalidation and the refetch that follows all land before this.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(field('fr')).toHaveValue('Croquettes');
  });
});
