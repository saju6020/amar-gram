import { shopFixtureIds } from '../../mocks/handlers/shop';
import { test, expect as baseExpect } from './fixtures';
import { withFilters } from './shop-helpers';
// The first visit to each route compiles it in `next dev` (slow under load): allow for that.
const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 90_000 });

/**
 * HO-SHP-002 §16 E-A1, E-B1, E-B2, E-B3, E-X3 (structure) — run against MSW. The real-API run of each
 * is recorded separately (TC-HO-SHP-002 §Real API).
 */

test.describe('Shop by Country to a product (AC-5)', () => {
  test('E-A1: Shop by Country → Thailand → In stock → open a product', async ({ page }) => {
    const apiResponses: Array<{ url: string; ms: number }> = [];
    page.on('requestfinished', async (request) => {
      if (!request.url().includes('/api/shop/')) return;
      const timing = request.timing();
      apiResponses.push({ url: request.url(), ms: Math.max(0, timing.responseEnd) });
    });

    await page.goto('/shop');
    await page.getByRole('link', { name: 'Shop by country' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Shop by country' })).toBeVisible();
    // Origins are listed with their names as text.
    await expect(page.getByRole('heading', { level: 2, name: 'Thailand' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Germany' })).toBeVisible();

    await page.getByRole('link', { name: 'Thailand' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Thailand' })).toBeVisible();
    await expect(page).toHaveURL(/\/shop\/countries\/TH/);

    await withFilters(page, async (scope) => {
      // Only Category is open on arrival (owner, 2026-10-17): open Availability first.
      const toggle = scope.getByRole('button', { name: 'Availability', exact: true });
      if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
      await scope.getByRole('checkbox', { name: /In stock only/ }).check();
    });
    await expect(page).toHaveURL(/availability=inStock/);
    // The country is the page's, not a query parameter.
    await expect(page).not.toHaveURL(/origin=/);

    // Only Thai products: every card says Thailand.
    const cards = page.getByRole('article');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(cards.nth(i)).toContainText('Thailand');
      // (Cards no longer print the stock text; the filter above already limits them to in-stock.)
    }

    // The name is the card's heading link (the first link is now the wishlist heart).
    await cards.first().getByRole('heading').getByRole('link').click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /Thailand/ }).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Ingredients & certification' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Ingredients & certification' })).toContainText(
      'Ingredients',
    );
    await expect(
      page.getByRole('region', { name: 'Price and availability' }).getByText('In stock').first(),
    ).toBeVisible();

    // Recorded (MSW run): browser-visible shop API calls. The AC-5 <500 ms budget is measured
    // against the real API (TC-HO-SHP-002).
    test.info().annotations.push({
      type: 'catalogue-api-timings-ms',
      description: JSON.stringify(apiResponses.map((r) => Math.round(r.ms))),
    });
  });
});

test.describe('District of origin (HO-P5 S1, E3)', () => {
  test('a product with a district says "Grown in …" above its producer line, and lists it under Origin', async ({
    page,
  }) => {
    await page.goto(`/shop/products/${shopFixtureIds.multiVariantSlug}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Organic Rolled Oats' }),
    ).toBeVisible();
    const header = page.locator('article header').first();
    await expect(header.getByText('Grown in Dinajpur')).toBeVisible();
    await expect(header.getByText(/Amar Gram Farms/)).toContainText('Bangladesh');
    await page.getByRole('tab', { name: 'Origin & producer' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Origin & producer' })).toContainText(
      'District: Dinajpur',
    );
  });

  test('a product from a producer abroad has no "Grown in" line', async ({ page }) => {
    await page.goto(`/shop/products/${shopFixtureIds.thaiRiceSlug}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/Grown in/)).toHaveCount(0);
  });
});

test.describe('Variants and kits', () => {
  test('E-B1: an out-of-stock variant is marked while the others stay in stock', async ({
    page,
  }) => {
    await page.goto(`/shop/products/${shopFixtureIds.multiVariantSlug}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Organic Rolled Oats' }),
    ).toBeVisible();

    const selector = page.getByRole('group', { name: 'Pack size' });
    await expect(selector.getByRole('radio', { name: /4 kg/ })).toHaveAccessibleName(
      /Out of stock/,
    );
    await expect(selector.getByRole('radio', { name: /400 g/ })).toHaveAccessibleName(/In stock/);
    await expect(selector.getByRole('radio', { name: /2 kg/ })).toHaveAccessibleName(/In stock/);

    await selector.getByRole('radio', { name: /4 kg/ }).check();
    await expect(page).toHaveURL(new RegExp(`sku=${shopFixtureIds.skuOats4kg}`));
    const buyBox = page.getByRole('region', { name: 'Price and availability' });
    await expect(buyBox.getByText('Out of stock')).toBeVisible();
    await expect(page.getByRole('link', { name: /Tell me when it.s back/ })).toBeVisible();

    await selector.getByRole('radio', { name: /2 kg/ }).check();
    await expect(buyBox.getByText('৳2,450.00')).toBeVisible();
    await expect(page.getByText(/Best before 12 Nov 2026/)).toBeVisible();

    // A deep link opens the chosen variant (and survives a reload).
    await page.goto(
      `/shop/products/${shopFixtureIds.multiVariantSlug}?sku=${shopFixtureIds.skuOats4kg}`,
    );
    await expect(page.getByRole('radio', { name: /4 kg/ })).toBeChecked();
  });

  test('S2: pack size, quantity 3, Add to basket: the price stays the one SKU price', async ({
    page,
  }) => {
    await page.goto(`/shop/products/${shopFixtureIds.multiVariantSlug}`);
    const selector = page.getByRole('group', { name: 'Pack size' });
    await selector.getByRole('radio', { name: /2 kg/ }).check();
    const buyBox = page.getByRole('region', { name: 'Price and availability' });
    await expect(buyBox.getByText('৳2,450.00')).toBeVisible();
    const more = page.getByRole('button', { name: 'One more Organic Rolled Oats' });
    await more.click();
    await more.click();
    await expect(buyBox.getByText(/3 × 2 kg/)).toBeVisible();
    // Never multiplied in the browser.
    await expect(buyBox.getByText('৳2,450.00')).toBeVisible();
    await expect(buyBox.getByText(/7,350/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Add to basket' }).click();
    await expect(page.getByText('Added 3 × 2 kg to your basket.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View basket' })).toHaveAttribute('href', '/cart');
  });

  test('E-B3: a kit with one out-of-stock component is out of stock', async ({ page }) => {
    await page.goto(`/shop/products/${shopFixtureIds.kitSlug}`);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Breakfast Starter Kit' }),
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Price and availability' }).getByText('Out of stock'),
    ).toBeVisible();
    const contents = page.getByRole('region', { name: 'This kit contains' });
    await expect(contents.getByRole('listitem')).toHaveCount(2);
    await expect(contents).toContainText('1 × Organic Rolled Oats');
    await expect(contents).toContainText('Out of stock');
  });
});

test.describe('Rendering structure (NFR-PRF-1, E-X3 structure)', () => {
  test('E-X3: the LCP image is a plain <img> with dimensions, high priority and not lazy', async ({
    page,
  }) => {
    await page.goto(`/shop/products/${shopFixtureIds.multiVariantSlug}`);
    const hero = page.locator('img[fetchpriority="high"]');
    // The mock sends no photo URL, so the gallery draws the tinted pack drawing (a named role=img);
    // with a photo the first image is the LCP element and must carry the attributes below.
    if ((await hero.count()) === 0) {
      await expect(
        page
          .getByRole('article')
          .getByRole('img', { name: /Organic Rolled Oats/ })
          .first(),
      ).toBeVisible();
    } else {
      await expect(hero).toHaveCount(1);
      await expect(hero).not.toHaveAttribute('loading', 'lazy');
      await expect(hero).toHaveAttribute('width', /\d+/);
      await expect(hero).toHaveAttribute('height', /\d+/);
      await expect(hero).toHaveAttribute('alt', /.+/);
    }
    // Below-the-fold images are lazy.
    for (const img of await page
      .locator('article img[src*="product-placeholder"]:not([fetchpriority="high"])')
      .all()) {
      await expect(img).toHaveAttribute('loading', 'lazy');
    }
  });

  test('E-X3: the product page is server-rendered (real links and content without JavaScript)', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto(`/shop/products/${shopFixtureIds.multiVariantSlug}`);
    // `next dev` streams the page behind loading.tsx and, with scripts off, the streamed block stays
    // hidden - so assert on the delivered HTML rather than on visibility.
    expect(await page.content()).toMatch(/<h1[^>]*>Organic Rolled Oats<\/h1>/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/shop\/products\/organic-rolled-oats$/,
    );
    await page.goto('/shop/products');
    expect(await page.content()).toContain('href="/shop/products/organic-rolled-oats"');
    await context.close();
  });

  test('a draft product slug is a not-found page', async ({ page }) => {
    const response = await page.goto(`/shop/products/${shopFixtureIds.draftSlug}`);
    // The page streams behind loading.tsx, so the status can already be 200 when the not-found
    // boundary renders; it is then marked noindex (owner-ratified, HO-P3 Amended (h)).
    if (response?.status() !== 404) {
      await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    }
    await expect(page.getByText("We couldn't find that product.")).toBeVisible();
  });
});
