import type { Locator, Page } from '@playwright/test';
import { test, expect as baseExpect, signInAsStaff } from './fixtures';
import { isMobile, setMaintenance, withFilters } from './shop-helpers';

// First visits compile routes in `next dev`: allow for that.
const expect = baseExpect.configure({ timeout: 20_000 });

/**
 * HO-SHP-002 §16 E-A2, E-A3, E-A4, E-E1 — run against MSW (the shop mock serves BOTH the browser worker
 * and `msw/node` for server rendering). E-A1 (the AC-5 journey) lives in `shop-product.spec.ts`
 * because it ends on the product page.
 */

/** Only Category is open on arrival (owner, 2026-10-17): open the group, then tick the option. */
async function tickFilter(scope: Locator, group: string, option: RegExp) {
  const toggle = scope.getByRole('button', { name: group, exact: true });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  await scope.getByRole('checkbox', { name: option }).check();
}

/**
 * HO-P3 S2: from 768 px the sort is a segmented radio group; on a phone it stays the native select
 * ("Sort by"). Both are in the page and CSS shows one, so the spec drives whichever is visible.
 */
async function chooseSortPriceAsc(page: Page) {
  if (isMobile(page)) {
    await page.getByLabel('Sort by').selectOption('price_asc');
  } else {
    await page.getByRole('radiogroup', { name: 'Sort' }).getByText('Price: low to high').click();
  }
}

async function expectSortPriceAsc(page: Page) {
  if (isMobile(page)) {
    await expect(page.getByLabel('Sort by')).toHaveValue('price_asc');
  } else {
    await expect(page.getByRole('radio', { name: 'Price: low to high' })).toBeChecked();
  }
}

test.describe('catalogue state lives in the URL', () => {
  test('E-A2: filter, sort, go to page 2, reload, press Back', async ({ page }) => {
    await page.goto('/shop/products');
    await expect(page.getByRole('heading', { level: 1, name: 'All products' })).toBeVisible();

    await withFilters(page, async (scope) => {
      await tickFilter(scope, 'Availability', /In stock only/);
    });
    await expect(page).toHaveURL(/availability=inStock/);

    await chooseSortPriceAsc(page);
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page).toHaveURL(/availability=inStock/);

    const firstNamePage1 = await page.getByRole('article').first().getByRole('heading').innerText();
    await page.getByRole('link', { name: 'Page 2', exact: true }).click();
    await expect(page).toHaveURL(/pageNumber=2/);
    await expect(page.getByRole('link', { name: 'Page 2', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const firstNamePage2 = await page.getByRole('article').first().getByRole('heading').innerText();
    expect(firstNamePage2).not.toBe(firstNamePage1);

    // Reload: filters, sort and page survive.
    await page.reload();
    await expect(page).toHaveURL(/availability=inStock/);
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page).toHaveURL(/pageNumber=2/);
    await expectSortPriceAsc(page);

    // Back restores the previous state of the same filtered, sorted results. (Back immediately
    // after a hard reload bounces in the dev server even for plain links — a framework behaviour, see
    // TC-HO-SHP-002 — so Back is exercised from the reloaded page's next navigation.)
    const firstNamePage2Again = await page
      .getByRole('article')
      .first()
      .getByRole('heading')
      .innerText();
    await page.getByRole('link', { name: 'Page 1', exact: true }).click();
    await expect(page).not.toHaveURL(/pageNumber=2/);
    await expect(page.getByRole('article').first().getByRole('heading')).toHaveText(firstNamePage1);
    await page.goBack();
    await expect(page).toHaveURL(/pageNumber=2/);
    await expect(page).toHaveURL(/availability=inStock/);
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page.getByRole('article').first().getByRole('heading')).toHaveText(
      firstNamePage2Again,
    );
  });

  test('E-A2: the result count is announced in a polite live region after a filter change', async ({
    page,
  }) => {
    await page.goto('/shop/products');
    const status = page.getByRole('status').filter({ hasText: /products?$/ });
    await expect(status).toBeVisible();
    const before = await status.innerText();
    await withFilters(page, async (scope) => {
      await tickFilter(scope, 'Origin', /Thailand/);
    });
    await expect(status).not.toHaveText(before);
    await expect(status).toHaveAttribute('aria-live', 'polite');
  });
});

test.describe('the design controls (HO-P3 S2)', () => {
  test('S2: "Certified organic only" sets the filter, shows a chip and clears again', async ({
    page,
  }) => {
    await page.goto('/shop/products');
    await withFilters(page, async (scope) => {
      await scope.getByRole('checkbox', { name: 'Certified organic only' }).check();
    });
    await expect(page).toHaveURL(/certification=CertifiedOrganic/);
    await page.getByRole('button', { name: 'Remove filter Certified organic' }).click();
    await expect(page).not.toHaveURL(/certification=/);
  });

  test('S2: the heading band carries the h1 and the count; there is no District filter', async ({
    page,
  }) => {
    await page.goto('/shop/products');
    const band = page
      .locator('main header')
      .filter({ has: page.getByRole('heading', { level: 1 }) });
    await expect(band.getByRole('status')).toHaveText(/\d+ products?/);
    await expect(page.getByText('District')).toHaveCount(0);
  });
});

test.describe('search (US-SHP-06)', () => {
  test('E-A3: a misspelled brand still finds the brand; nonsense offers alternatives', async ({
    page,
  }) => {
    await page.goto('/shop');
    await page
      .getByRole('search', { name: 'Products' })
      .getByLabel('Search the shop')
      .fill('greem valey');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/q=greem([+]|%20)valey/);
    await expect(page.getByRole('heading', { level: 2, name: 'Thai Jasmine Rice' })).toBeVisible();

    await page
      .getByRole('search', { name: 'Products' })
      .getByLabel('Search the shop')
      .fill('zzqqxx');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByText(/No products match/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Popular right now' })).toBeVisible();
    await expect(page.getByRole('article').first()).toBeVisible();
  });

  test('E-A3: a typo in a search offers a Did you mean link that keeps the filters', async ({
    page,
  }) => {
    await page.goto('/shop/products?q=gren%20vally&availability=inStock');
    await expect(page.getByText(/No products match/)).toBeVisible();
    const suggestion = page.getByRole('link', { name: 'green valley' });
    await expect(suggestion).toBeVisible();
    await suggestion.click();
    await expect(page).toHaveURL(/availability=inStock/);
    await expect(page.getByRole('heading', { level: 2, name: 'Thai Jasmine Rice' })).toBeVisible();
  });

  test('E-A4: an ingredient and a tag find matching products', async ({ page }) => {
    await page.goto('/shop/products?q=sunflower');
    await expect(page.getByRole('heading', { level: 2, name: 'Date Palm Gur' })).toBeVisible();
    await page.goto('/shop/products?q=long-grain');
    await expect(page.getByRole('heading', { level: 2, name: 'Thai Jasmine Rice' })).toBeVisible();
  });
});

test.describe('maintenance (US-ADM-08)', () => {
  test('E-E1: maintenance replaces the storefront; the back office keeps working', async ({
    page,
  }) => {
    await signInAsStaff(page);
    await setMaintenance(page, true, 'Stock take until 6pm.');
    try {
      await page.goto('/shop/products');
      await expect(page.getByText('Stock take until 6pm.')).toBeVisible();
      await expect(
        page.getByText(/Your account and past orders are still available/),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: 'Go to your account' })).toHaveAttribute(
        'href',
        '/portal',
      );
      await expect(page.getByRole('article')).toHaveCount(0);

      await page.goto('/staff/shop/products');
      await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
    } finally {
      await setMaintenance(page, false);
    }
    await page.goto('/shop/products');
    await expect(page.getByRole('article').first()).toBeVisible();
  });
});

test.describe('the shell without JavaScript (S4)', () => {
  for (const path of ['/shop', '/shop/countries', '/shop/products']) {
    test(`S4: ${path} has its header, nav and search in the HTML`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
      const page = await context.newPage();
      await page.goto(path);
      await expect(page.getByRole('link', { name: 'Amar Gram Shop' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Shop categories' })).toBeVisible();
      await expect(page.getByRole('search', { name: 'Products' })).toBeVisible();
      await expect(page.getByRole('searchbox', { name: 'Search the shop' })).toBeVisible();
      await context.close();
    });
  }
});
