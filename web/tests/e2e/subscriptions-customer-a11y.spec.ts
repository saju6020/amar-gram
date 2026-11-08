import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect as baseExpect } from './fixtures';
import { signInEstablished } from './portal-helpers';
import { shopFixtureIds } from '../../mocks/handlers/shop/fixtures';
import { seedDates, subscriptionFixtureIds } from '../../mocks/handlers/subscriptions/fixtures';
import type { SubscriptionsMockControls } from '../../mocks/handlers/subscriptions/control';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000, retries: 1 });

/**
 * HO-P6 S1 §16 E6: axe (zero serious or critical) on every customer subscription screen and dialog, at 1280 and at 360,
 * including the error summary on the Subscribe form. Against MSW.
 */

const mine = subscriptionFixtureIds.mine;
const dates = seedDates();
const VIEWPORTS = [
  { name: '1280', width: 1280, height: 900 },
  { name: '360', width: 360, height: 780 },
] as const;

async function control<K extends keyof SubscriptionsMockControls>(
  page: Page,
  name: K,
  ...args: Parameters<SubscriptionsMockControls[K]>
): Promise<void> {
  await page.evaluate(
    ({ name, args }) => {
      const controls = (window as unknown as { __subscriptionsMock?: Record<string, (...a: unknown[]) => void> })
        .__subscriptionsMock;
      if (!controls) throw new Error('window.__subscriptionsMock is not installed (are mocks on?)');
      controls[name]!(...args);
    },
    { name, args: args as unknown[] },
  );
}

async function noSeriousOrCritical(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
}

for (const viewport of VIEWPORTS) {
  test.describe(`axe at ${viewport.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await signInEstablished(page);
      await control(page, 'reset');
    });

    test('the product page offer', async ({ page }) => {
      await page.goto(`/shop/products/${shopFixtureIds.multiVariantSlug}?sku=${shopFixtureIds.skuOats2kg}`);
      await expect(page.getByRole('link', { name: 'Subscribe & save 10%' })).toBeVisible();
      await noSeriousOrCritical(page);
    });

    test('the Subscribe form, with the error summary, in pickup, and when it is not offered', async ({ page }) => {
      await page.goto(`/portal/subscriptions/new/${shopFixtureIds.skuOats2kg}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Subscribe' })).toBeVisible();
      await expect(page.getByRole('radio', { name: /^Cash on delivery/ })).toBeChecked();
      await noSeriousOrCritical(page);

      // A first-delivery date before the earliest: the server refuses it and the summary and the field say so.
      await page.getByLabel('First delivery date').fill(dates.today);
      await page.getByRole('button', { name: 'Start subscription' }).click();
      const summary = page.getByRole('alert').filter({ hasText: /We couldn.t start your subscription/ });
      await expect(summary).toBeVisible();
      await expect(summary).toBeFocused();
      await noSeriousOrCritical(page);

      await page.getByRole('radio', { name: 'Collect from an outlet' }).check();
      await expect(page.getByRole('radiogroup', { name: 'Collect from' })).toBeVisible();
      await noSeriousOrCritical(page);

      await page.goto(`/portal/subscriptions/new/${subscriptionFixtureIds.skus.oats400}`);
      await expect(page.getByText('You already subscribe to this.')).toBeVisible();
      await noSeriousOrCritical(page);
    });

    test('My subscriptions, both tabs', async ({ page }) => {
      await page.goto('/portal/subscriptions');
      await expect(page.getByText(/^Waiting for your transfer/)).toBeVisible();
      await noSeriousOrCritical(page);
      await page.getByRole('tab', { name: /^Cancelled/ }).click();
      await expect(page.getByText('Raw Forest Honey · 500 g')).toBeVisible();
      await noSeriousOrCritical(page);
    });

    test('the detail in each state', async ({ page }) => {
      for (const [id, heading] of [
        [mine.activeUnlocked, /Organic Rolled Oats/],
        [mine.activeLocked, /Thai Jasmine Rice/],
        [mine.paused, /Date Palm Gur/],
        [mine.suspendedUnpaid, /Garam Masala Blend/],
        [mine.suspendedProductUnavailable, /Red Lentils/],
        [mine.cancelled, /Raw Forest Honey/],
        [mine.addressMissing, /Pure Mustard Oil/],
      ] as const) {
        await page.goto(`/portal/subscriptions/${id}`);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        await noSeriousOrCritical(page);
      }
      await page.goto('/portal/subscriptions/5b000000-0000-0000-0000-00000000dead');
      await expect(page.getByText("We couldn't find that subscription.")).toBeVisible();
      await noSeriousOrCritical(page);
    });

    test('every dialog', async ({ page }) => {
      const open = async (button: RegExp | string, dialogName: RegExp | string) => {
        await page.getByRole('button', { name: button, exact: typeof button === 'string' }).click();
        const dialog = page.getByRole('dialog', { name: dialogName });
        await expect(dialog).toBeVisible();
        await noSeriousOrCritical(page);
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
      };
      await page.goto(`/portal/subscriptions/${mine.activeUnlocked}`);
      await expect(page.getByRole('heading', { level: 1, name: /Organic Rolled Oats/ })).toBeVisible();
      await open('Change', /^Change /);
      await open(/^Skip the delivery on /, /^Skip the delivery on /);
      await open('Pause', /^Pause /);
      await open('Cancel subscription', /^Cancel /);

      // The cancel dialog's own error: no reason chosen.
      await page.getByRole('button', { name: 'Cancel subscription' }).click();
      const cancel = page.getByRole('dialog', { name: /^Cancel / });
      await cancel.getByRole('button', { name: 'Cancel subscription' }).click();
      await expect(cancel.getByText('Choose a reason so we know how to improve.')).toBeVisible();
      await noSeriousOrCritical(page);
      await page.keyboard.press('Escape');

      await page.goto(`/portal/subscriptions/${mine.paused}`);
      await open('Resume', /^Resume /);
      await page.goto(`/portal/subscriptions/${mine.activeLocked}`);
      await open('Withdraw scheduled changes', 'Withdraw scheduled changes?');
    });

    test('the overview card', async ({ page }) => {
      await page.goto('/portal');
      await expect(page.getByTestId('next-delivery')).toBeVisible();
      await noSeriousOrCritical(page);
    });
  });
}
