// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { resetOrderingMockData } from '@/mocks/handlers/ordering';
import { ShopTopStrip } from '@/components/shop/ShopTopStrip';
import ShopLayout from '@/app/(shop)/layout';
import ProductPage from '@/app/(shop)/shop/products/[slug]/page';
import { ApiError } from '@/lib/api/client';
import { getDeliveryPromiseServer, type StorefrontBanner } from '@/lib/api/shop-catalogue';

/**
 * HO-P5 S1 §15 U10 (the top strip and the promise), U11 (a failed promise read) and the U47 case for
 * `GET /api/shop/delivery-promise` (Api/Controllers/ShopCatalogueController.cs:113-121).
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/shop',
  useSearchParams: () => new URLSearchParams(),
}));

const PROMISE_TEXT = 'Free delivery over ৳5,000.00 · Cash on delivery across Bangladesh';

const banner = (slug: string, title: string, linkUrl: string | null = null): StorefrontBanner => ({
  slug,
  title,
  body: `${title} body`,
  placement: 'Shop',
  linkUrl,
});

const banners = [banner('b1', 'Mango season'), banner('b2', 'Eid opening hours')];

function serveBanners(list: StorefrontBanner[]) {
  server.use(http.get('*/api/content/banners', () => HttpResponse.json(list)));
}
function servePromise(body: Record<string, unknown> | null, status = 200) {
  server.use(
    http.get('*/api/shop/delivery-promise', () =>
      status === 200 ? HttpResponse.json(body) : new HttpResponse(null, { status }),
    ),
  );
}

async function renderLayout() {
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      await ShopLayout({ children: createElement('p', null, 'page body') }),
    ),
  );
}

const announcements = (html: string) =>
  html.match(/<section aria-label="Announcements"[\s\S]*?<\/section>/)?.[0] ?? '';

beforeEach(() => {
  resetOrderingMockData();
});

describe('U10: ShopTopStrip', () => {
  const money = (amount: string) => ({ amount, currencyCode: 'BDT' });

  it('states the free-delivery threshold as plain text, from the server string', () => {
    const html = renderToStaticMarkup(
      createElement(ShopTopStrip, {
        promise: { currencyCode: 'BDT', freeOver: money('5000.00'), leadTimeDays: 1 },
        banner: banner('b1', 'Mango season'),
      }),
    );
    expect(html).toContain(PROMISE_TEXT);
    expect(html).toContain('data-testid="shop-top-strip"');
    // The promise takes the strip: the banner is not also in it, and nothing says "in Dhaka" (OQ-2).
    expect(html).not.toContain('Mango season');
    expect(html).not.toContain('Dhaka');
    expect(html).not.toContain('<a ');
  });

  it('falls back to the first banner when the promise has no threshold, and renders nothing with neither', () => {
    const fallback = renderToStaticMarkup(
      createElement(ShopTopStrip, {
        promise: { currencyCode: null, freeOver: null, leadTimeDays: null },
        banner: banner('b1', 'Mango season', '/shop/products'),
      }),
    );
    expect(fallback).toContain('Mango season');
    expect(fallback).toContain('href="/shop/products"');
    expect(fallback).not.toContain('Free delivery');
    expect(
      renderToStaticMarkup(
        createElement(ShopTopStrip, {
          promise: { currencyCode: 'BDT', freeOver: null, leadTimeDays: 2 },
          banner: null,
        }),
      ),
    ).toBe('');
    expect(renderToStaticMarkup(createElement(ShopTopStrip, { promise: null, banner: undefined }))).toBe(
      '',
    );
  });
});

describe('U10/U11: the shop layout', () => {
  it('with a threshold, the strip is the promise and every Shop banner shows below the header', async () => {
    serveBanners(banners);
    const html = await renderLayout();
    expect(html).toContain(PROMISE_TEXT);
    const strip = announcements(html);
    expect(strip).toContain('Mango season');
    expect(strip).toContain('Eid opening hours');
    // The banner titles are not in the top strip.
    const top = html.match(/data-testid="shop-top-strip"[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(top).not.toContain('Mango season');
    expect(html).toContain('page body');
  });

  it('without a threshold the first banner is the strip and the rest show below (HO-P3 behaviour)', async () => {
    serveBanners(banners);
    servePromise({ currencyCode: 'BDT', freeOver: null, leadTimeDays: 1 });
    const html = await renderLayout();
    expect(html).not.toContain('Free delivery over');
    const top = html.match(/data-testid="shop-top-strip"[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(top).toContain('Mango season');
    expect(announcements(html)).toContain('Eid opening hours');
    expect(announcements(html)).not.toContain('Mango season');
  });

  it('with neither a promise nor a banner there is no strip', async () => {
    serveBanners([]);
    servePromise({ currencyCode: null, freeOver: null, leadTimeDays: null });
    const html = await renderLayout();
    expect(html).not.toContain('data-testid="shop-top-strip"');
    expect(html).toContain('page body');
  });

  it('U11: a failed promise read (500) renders the page and falls back to the banner, with no error banner', async () => {
    serveBanners(banners);
    servePromise(null, 500);
    const html = await renderLayout();
    expect(html).toContain('page body');
    expect(html).not.toContain('Free delivery over');
    expect(html).not.toMatch(/role="alert"/);
    const top = html.match(/data-testid="shop-top-strip"[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(top).toContain('Mango season');
    expect(announcements(html)).toContain('Eid opening hours');
  });
});

describe('U12: the product page passes the lead time to the delivery card', () => {
  const renderPage = async () =>
    renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        await ProductPage({
          params: Promise.resolve({ slug: 'organic-rolled-oats' }),
          searchParams: Promise.resolve({}),
        }),
      ),
    );

  it('states the server lead time', async () => {
    expect(await renderPage()).toContain('Standard delivery usually takes 1 day.');
  });

  it('a failed promise read shows no lead time and no error', async () => {
    servePromise(null, 500);
    const html = await renderPage();
    expect(html).toContain('Pick a delivery slot at checkout. The fee is shown before you place the order.');
    expect(html).not.toContain('usually takes');
    expect(html).not.toMatch(/role="alert"/);
  });
});

describe('U47: the delivery-promise mock answers as the server does', () => {
  it('is the primary zone’s Standard threshold and lead time, as the server’s money strings', async () => {
    await expect(getDeliveryPromiseServer()).resolves.toEqual({
      currencyCode: 'BDT',
      freeOver: { amount: '5000.00', currencyCode: 'BDT' },
      leadTimeDays: 1,
    });
  });

  it('is all null when no active zone offers a Standard service', async () => {
    const { db } = await import('@/mocks/handlers/ordering/store');
    for (const zone of db.zones) zone.isActive = false;
    await expect(getDeliveryPromiseServer()).resolves.toEqual({
      currencyCode: null,
      freeOver: null,
      leadTimeDays: null,
    });
  });

  it('a Standard service without a threshold has a lead time and no freeOver', async () => {
    const { db } = await import('@/mocks/handlers/ordering/store');
    db.zones[0]!.services.find((s) => s.serviceLevel === 'Standard')!.freeOverCents = null;
    await expect(getDeliveryPromiseServer()).resolves.toMatchObject({
      freeOver: null,
      leadTimeDays: 1,
    });
  });

  it('a 5xx surfaces as an ApiError so the layout can treat it as "no promise"', async () => {
    servePromise(null, 500);
    await expect(getDeliveryPromiseServer()).rejects.toBeInstanceOf(ApiError);
  });
});
