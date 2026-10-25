import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

/**
 * HO-P3 E3 (S1): the shop home to Home.dc.html (desktop) and HomePhone.dc.html (360 px). It has no
 * serious or critical axe violations and no horizontal scroll at 360 / 768 / 1024 / 1440; at 360 the
 * category row scrolls inside its own nav and the products are two columns; Add on a card swaps to a
 * stepper and raises the header's basket count; "See all products" goes to the catalogue.
 */

const WIDTHS = [360, 768, 1024, 1440];

function widthOf(page: import('@playwright/test').Page): number {
  return page.viewportSize()?.width ?? 1280;
}

test.describe('shop home (HO-P3 E3)', () => {
  test('has no serious or critical accessibility violations', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/shop');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('article').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    ).toEqual([]);
  });

  test('never scrolls the page sideways at 360, 768, 1024 and 1440 px', async ({ page }) => {
    test.setTimeout(90_000);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/shop');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(overflow.scroll, `/shop at ${width}px`).toBeLessThanOrEqual(overflow.client);
    }
  });

  test('phone: the category row scrolls inside its nav and the products are two columns', async ({
    page,
  }) => {
    test.skip(widthOf(page) >= 768, 'phone layout only');
    await page.goto('/shop');
    const nav = page.getByRole('navigation', { name: 'Categories', exact: true });
    await expect(nav).toBeVisible();
    const row = await nav.locator('ul').evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
      overflowX: getComputedStyle(el).overflowX,
    }));
    expect(row.overflowX).toBe('auto');
    expect(row.scroll).toBeGreaterThan(row.client);

    const tops = await page
      .getByRole('article')
      .evaluateAll((els) =>
        els.slice(0, 8).map((el) => Math.round(el.getBoundingClientRect().top)),
      );
    expect(tops.filter((top) => top === tops[0])).toHaveLength(2);
  });

  test('desktop: the hero, the growers band and the promises are shown', async ({ page }) => {
    test.skip(widthOf(page) < 768, 'desktop layout only');
    await page.goto('/shop');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Shop the pantry' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Fresh from the haat' }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Why shop with us' })).toBeVisible();
    await expect(page.getByText(/staples box/i)).toHaveCount(0);
  });

  test('Add on a card swaps to a stepper and raises the header count', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.getByRole('article').first()).toBeVisible();
    const header = page.getByRole('banner');
    const before = Number(
      (await header
        .getByTestId('cart-count')
        .first()
        .textContent({ timeout: 2_000 })
        .catch(() => '0')) ?? 0,
    );
    await page
      .getByRole('button', { name: /^Add .+ to basket$/ })
      .first()
      .click();
    await expect(header.getByTestId('cart-count').first()).toHaveText(String(before + 1));
    await expect(page.getByRole('button', { name: /^One more / }).first()).toBeVisible();
  });

  test('"See all products" opens the catalogue', async ({ page }) => {
    await page.goto('/shop');
    await page.getByRole('link', { name: 'See all products' }).click();
    await expect(page).toHaveURL(/\/shop\/products$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
