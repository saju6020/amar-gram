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
      await expect(box).toHaveAccessibleDescription(/Turning it off stops new subscriptions; existing subscriptions carry on as normal/);
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

    test('every customer profile tab is visible without a hidden scroll', async ({ page }) => {
      await openReportsAs(page, 'Administrator', `/staff/customers/${ids.customerId}`);
      const list = page.getByRole('tablist', { name: 'Customer details' });
      await expect(list).toBeVisible();
      const tabs = list.getByRole('tab');
      expect(await tabs.count()).toBeGreaterThanOrEqual(4);
      expect(await list.evaluate((el) => el.scrollWidth - el.clientWidth), 'the tab bar scrolls sideways').toBeLessThanOrEqual(1);
      // Horizontally, every tab lies inside the screen (the page may need a vertical scroll to reach the bar).
      for (const tab of await tabs.all()) {
        const box = (await tab.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      }
      await expect(page.getByRole('tab', { name: /^Billing$/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /^Notes \(\d+\)$/ })).toBeVisible();
    });

    test('the erase-personal-data panel keeps its two selects inside the card at 44 px', async ({ page }) => {
      await openReportsAs(page, 'Administrator', `/staff/customers/${ids.customerId}`);
      const card = page.getByRole('region', { name: 'Erase personal data' });
      await card.scrollIntoViewIfNeeded();
      const cardBox = (await card.boundingBox())!;
      for (const select of await card.getByRole('combobox').all()) {
        const box = (await select.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(cardBox.x);
        expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 0.5);
        expect(box.height).toBeGreaterThanOrEqual(43.5);
      }
      await checkScreen(page, card, viewport.width);
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
      // Every More-filters control and both date inputs are 44 px (owner fix 2026-11-09; the filters were 36-40 px).
      await checkScreen(page, page.getByRole('search', { name: 'Order filters' }), viewport.width);
    });
  });
}
