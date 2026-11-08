import type { Locator, Page } from '@playwright/test';
import { test, expect as baseExpect } from './fixtures';
import { expectAxeClean, expectNoHorizontalScroll, openReportsAs } from './reports-helpers';
import { seedProducts } from '../../mocks/handlers/shop/fixtures';
import { subscriptionFixtureIds } from '../../mocks/handlers/subscriptions/fixtures';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000 });

/**
 * HO-P6 S3 (E14, UI-1, UI-6, NFR-CMP-2). Each back-office touch point at 1280 and at 360 px: the product editor's Organise
 * card, the customer profile's Subscriptions tab, the dashboard's attention panel and the orders "More filters" with the
 * Channel select. Each fits (no sideways scroll), its controls are at least 44 px high, and axe finds nothing serious or
 * critical.
 */
const ids = subscriptionFixtureIds;
const NEEM = seedProducts().find((p) => p.slug === 'neem-soap-bar')!;
const TARGET = 44;
const VIEWPORTS = [
  { name: '1280', width: 1280, height: 900 },
  { name: '360', width: 360, height: 780 },
] as const;

/** Every visible control inside `scope` is at least 44 px tall (a link counts the tallest thing inside it). */
async function expectTargets(scope: Locator) {
  const small = await scope.evaluate((root, minimum) => {
    const controls = Array.from(
      root.querySelectorAll<HTMLElement>('a[href], button, select, input:not([type="hidden"]), textarea, summary'),
    );
    return controls
      .filter((el) => el.getClientRects().length > 0 && !el.closest('.sr-only') && getComputedStyle(el).visibility !== 'hidden')
      .map((el) => {
        // A checkbox is a 20 px box inside a 44 px label: the label is its target.
        const target = el instanceof HTMLInputElement && el.type === 'checkbox' ? (el.closest('label') ?? el) : el;
        const own = target.getBoundingClientRect().height;
        const inner = Array.from(target.querySelectorAll<HTMLElement>('*')).map((c) => c.getBoundingClientRect().height);
        return { name: (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim().slice(0, 40), height: Math.max(own, ...inner) };
      })
      .filter((c) => c.height < minimum - 0.5);
  }, TARGET);
  expect(small, `controls under ${TARGET}px: ${JSON.stringify(small)}`).toEqual([]);
}

/** Fits, axe-clean on the whole page; the 44 px check covers the controls this slice adds or changes (`scope`). */
async function checkScreen(page: Page, scope: Locator, width: number) {
  await expectNoHorizontalScroll(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await expectTargets(scope);
  await expectAxeClean(page);
}

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.name} px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
    });

    test('the product editor Organise card with "Can be subscribed to"', async ({ page }) => {
      await openReportsAs(page, 'Administrator', `/staff/shop/products/${NEEM.productId}`);
      const box = page.getByRole('checkbox', { name: 'Can be subscribed to' });
      await expect(box).toBeVisible();
      await expect(box).toHaveAccessibleDescription(/Turning it off does not cancel existing subscriptions/);
      await checkScreen(page, box.locator('xpath=ancestor::label[1]'), viewport.width);
    });

    test('the customer Subscriptions tab', async ({ page }) => {
      await openReportsAs(page, 'Administrator', `/staff/customers/${ids.customerId}`);
      const tab = page.getByRole('tab', { name: /^Subscriptions \(\d+\)$/ });
      await expect(tab).toBeVisible();
      await tab.scrollIntoViewIfNeeded();
      await tab.click();
      const panel = page.getByRole('tabpanel', { name: 'Subscriptions' });
      await expect(panel.getByRole('link').first()).toBeVisible();
      await expect(panel).toContainText(/\d+ suspended · \d+ cancelled/);
      await checkScreen(page, panel, viewport.width);
      await expectTargets(page.getByRole('tablist', { name: 'Customer details' }));
    });

    test('the dashboard attention panel with the subscription rows', async ({ page }) => {
      await openReportsAs(page, 'Administrator', '/staff');
      await expect(page.getByRole('link', { name: /Subscription orders due tomorrow/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /Subscriptions suspended/ })).toBeVisible();
      await checkScreen(page, page.locator('section', { has: page.getByRole('heading', { name: 'Needs attention' }) }), viewport.width);
    });

    test('the orders More filters with the Channel select', async ({ page }) => {
      await openReportsAs(page, 'Administrator', '/staff/orders?channel=Subscription');
      // A filter in "More filters" keeps the section open.
      const channel = page.getByLabel('Channel');
      await expect(channel).toBeVisible();
      await expect(channel).toHaveValue('Subscription');
      await expect(channel.locator('option')).toHaveText(['Any channel', 'Online', 'Counter', 'Subscription']);
      // The Channel select is the control this slice changes; the other filters are the orders screen's own.
      await checkScreen(page, page.locator('#oq-channel').locator('xpath=..'), viewport.width);
    });
  });
}
