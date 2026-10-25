// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { CatalogueView } from '@/app/(shop)/_components/CatalogueView';
import { EMPTY_CATALOGUE_PARAMS } from '@/lib/shop/catalogueParams';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/shop/products',
  useSearchParams: () => new URLSearchParams(),
}));

describe('CatalogueView server rendering — HO-SHP-002 §8.2', () => {
  it('U-F1: a storefront 503 renders the maintenance notice instead of the page', async () => {
    server.use(http.get('*/api/shop/products', () => new HttpResponse(null, { status: 503 })));
    const html = renderToStaticMarkup(
      await CatalogueView({ params: EMPTY_CATALOGUE_PARAMS, basePath: '/shop/products' }),
    );
    expect(html).toContain('Your account and past orders are still available');
    expect(html).toContain('href="/portal"');
  });

  it('U15 (HO-P3 S2): with a band title it draws the h1 and ONE polite result count in the band', async () => {
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        await CatalogueView({
          params: { ...EMPTY_CATALOGUE_PARAMS, q: 'oats' },
          basePath: '/shop/products',
          bandTitle: 'Results for “oats”',
        }),
      ),
    );
    expect(html).toMatch(/<h1[^>]*>Results for “oats”<\/h1>/);
    const statuses = html.match(/<p role="status" aria-live="polite"[^>]*>[^<]*<\/p>/g) ?? [];
    // The count is in the heading band only, and does not repeat the search the h1 states.
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toMatch(/>\d+ products?<\/p>$/);
    expect(html.indexOf('<h1')).toBeLessThan(html.indexOf('role="status"'));
  });

  it('renders real product links and pagination from the API (no client JS needed)', async () => {
    // The product cards are client components (wishlist, Add); the app's Providers wrap them.
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        await CatalogueView({ params: EMPTY_CATALOGUE_PARAMS, basePath: '/shop/products' }),
      ),
    );
    expect(html).toContain('href="/shop/products/organic-rolled-oats"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="/shop/products?pageNumber=2"');
  });
});
