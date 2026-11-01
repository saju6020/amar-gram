import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

/**
 * HO-P3 E1 (S0): the store-front shell. The phone tab bar shows below `md` on the shop pages, is absent
 * on /cart (which has its own sticky footer) and never covers the end of the page; at desktop width
 * there is no tab bar; adding an item raises the header's basket count by one.
 */

const EMAIL = 'hello@amargram.example';

function widthOf(page: import('@playwright/test').Page): number {
  return page.viewportSize()?.width ?? 1280;
}

test.describe('store-front shell (HO-P3 E1)', () => {
  test('phone: the tab bar is on /shop and /shop/products, not on /cart, and never covers the footer', async ({
    page,
  }) => {
    test.skip(widthOf(page) >= 768, 'phone layout only');
    const tabBar = page.getByRole('navigation', { name: 'Shop sections' });

    await page.goto('/shop');
    await expect(tabBar).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.goto('/shop/products');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(tabBar).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Shop' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // Scroll to the very bottom: the footer's last link sits above the bar, not under it.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const lastLink = page.getByRole('link', { name: EMAIL });
    await expect(lastLink).toBeVisible();
    const linkBox = await lastLink.boundingBox();
    const barBox = await tabBar.boundingBox();
    expect(linkBox).not.toBeNull();
    expect(barBox).not.toBeNull();
    expect(linkBox!.y + linkBox!.height).toBeLessThanOrEqual(barBox!.y + 1);

    await page.goto('/cart');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(tabBar).toHaveCount(0);
  });

  // HO-P5 S1 (E4): the strip states the server's free-delivery threshold (no place name, no arithmetic).
  test('the top strip shows the delivery promise on the home page and the catalogue, axe clean', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const promise = 'Free delivery over ৳5,000.00 · Cash on delivery across Bangladesh';
    for (const path of ['/shop', '/shop/products']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByTestId('shop-top-strip')).toHaveText(promise);
      await expect(page.getByTestId('shop-top-strip').getByRole('link')).toHaveCount(0);
    }
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    ).toEqual([]);
  });

  test('desktop: there is no tab bar', async ({ page }) => {
    test.skip(widthOf(page) < 768, 'desktop layout only');
    await page.goto('/shop');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Shop sections' })).toBeHidden();
  });

  test('adding an item raises the header basket count by one and swaps Add for a stepper', async ({
    page,
  }) => {
    await page.goto('/shop/products');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const header = page.getByRole('banner');
    const before = Number(
      (await header
        .getByTestId('cart-count')
        .first()
        .textContent({ timeout: 2_000 })
        .catch(() => '0')) ?? 0,
    );

    const add = page.getByRole('button', { name: /^Add .+ to basket$/ }).first();
    await add.click();
    await expect(header.getByTestId('cart-count').first()).toHaveText(String(before + 1));
    await expect(page.getByRole('button', { name: /^One more / }).first()).toBeVisible();
  });
});
