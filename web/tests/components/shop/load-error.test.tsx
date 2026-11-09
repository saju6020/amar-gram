import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { CatalogueView } from '@/app/(shop)/_components/CatalogueView';
import { EMPTY_CATALOGUE_PARAMS } from '@/lib/shop/catalogueParams';

/**
 * S19 — a failed API read used to be `throw`n from the Server Component, which `next start`
 * answered with a 500. The page now returns a rendered error state with a retry link.
 */
const down = () => HttpResponse.json({ title: 'down' }, { status: 500 });

describe('storefront pages render an error state when the API fails — S19', () => {
  it('/shop/products (the product read fails)', async () => {
    server.use(http.get('*/api/shop/products', down));
    render(
      await CatalogueView({
        params: { ...EMPTY_CATALOGUE_PARAMS, q: 'oats' },
        basePath: '/shop/products',
      }),
    );
    expect(screen.getByText(/couldn't load the shop/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute(
      'href',
      '/shop/products?q=oats',
    );
  });

  it('/shop/products (the filters read fails)', async () => {
    server.use(http.get('*/api/shop/filters', down));
    render(await CatalogueView({ params: EMPTY_CATALOGUE_PARAMS, basePath: '/shop/products' }));
    expect(screen.getByText(/couldn't load the shop/)).toBeInTheDocument();
  });
});
