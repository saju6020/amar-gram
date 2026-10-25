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
