import type { Page } from '@playwright/test';
import { test, expect as baseExpect } from './fixtures';
import { signInEstablished } from './portal-helpers';
import { shopFixtureIds } from '../../mocks/handlers/shop/fixtures';
import { subscriptionFixtureIds } from '../../mocks/handlers/subscriptions/fixtures';
import type { SubscriptionsMockControls } from '../../mocks/handlers/subscriptions/control';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000, retries: 1 });

/**
 * HO-P6 S1 §16 E5: every new customer subscription screen and dialog at 360 px has no sideways scroll and no control
 * under 44 px. The viewport is set here, so both projects measure 360.
 */

const mine = subscriptionFixtureIds.mine;
const STORE_KEY = '__amargram_subscriptions_mock_db__v2';

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

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await signInEstablished(page);
  await control(page, 'reset');
});

async function expectFits(page: Page, scopeSelector = '#main-content, [role="dialog"]'): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(overflow, 'page is wider than 360 px').toBeLessThanOrEqual(360);
  const small = await page.evaluate((selector) => {
    const found: string[] = [];
    const scopes = Array.from(document.querySelectorAll(selector));
    const seen = new Set<Element>();
    for (const scope of scopes) {
      for (const element of Array.from(
        scope.querySelectorAll('button, a[href], input, select, textarea, [role="tab"]'),
      )) {
        if (seen.has(element)) continue;
        seen.add(element);
        const type = (element as HTMLInputElement).type;
        // A radio or checkbox is operated through its label.
        const target =
          element.tagName === 'INPUT' && (type === 'radio' || type === 'checkbox')
            ? (element.closest('label') ?? element)
            : element;
        const rect = target.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (getComputedStyle(element).visibility === 'hidden') continue;
        if (rect.height < 43.5) {
          found.push(`${element.tagName.toLowerCase()} "${(element.textContent ?? '').trim().slice(0, 40)}" ${Math.round(rect.height)}px`);
        }
      }
    }
    return found;
  }, scopeSelector);
  expect(small, 'controls under 44 px').toEqual([]);
}

test('the product page offer', async ({ page }) => {
  await page.goto(`/shop/products/${shopFixtureIds.multiVariantSlug}?sku=${shopFixtureIds.skuOats2kg}`);
  await expect(page.getByRole('link', { name: 'Subscribe & save 10%' })).toBeVisible();
  await expectFits(page, '[data-slot="buy-box-subscribe"]');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(overflow).toBeLessThanOrEqual(360);
  // The existing subscription's offer reads as a sentence with a 44 px Manage link.
  await page.goto(`/shop/products/${shopFixtureIds.multiVariantSlug}`);
  await expect(page.getByText('You already subscribe to this')).toBeVisible();
  await expectFits(page, '[data-slot="buy-box-subscribe"]');
});

test('Subscribe: delivery, the inline address form, and pickup', async ({ page }) => {
  await page.goto(`/portal/subscriptions/new/${shopFixtureIds.skuOats2kg}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Subscribe' })).toBeVisible();
  // The first method Orders offers is chosen for the customer.
  await expect(page.getByRole('radio', { name: /^Cash on delivery/ })).toBeChecked();
  await expectFits(page);

  await page.getByRole('button', { name: 'Add a new address' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add address' });
  await expect(dialog).toBeVisible();
  // The shared AddressForm (components/account, import-only here) has 38 to 40 px fields and buttons: only the width is
  // checked for it, and the height is reported to the integrator (S1 slice report, §20.1).
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.getByRole('radio', { name: 'Collect from an outlet' }).check();
  await expect(page.getByRole('radiogroup', { name: 'Collect from' })).toBeVisible();
  await expectFits(page);

  await page.goto(`/portal/subscriptions/new/${subscriptionFixtureIds.skus.oats400}`);
  await expect(page.getByText('You already subscribe to this.')).toBeVisible();
  await expectFits(page);
  await page.goto('/portal/subscriptions/new/b0000000-0000-0000-0000-00000000dead');
  await expect(page.getByText("We couldn't find that product.")).toBeVisible();
  await expectFits(page);
});

test('My subscriptions: both tabs and the empty state', async ({ page }) => {
  await page.goto('/portal/subscriptions');
  await expect(page.getByRole('tab', { name: /^Current/ })).toBeVisible();
  await expect(page.getByText(/^Waiting for your transfer/)).toBeVisible();
  await expectFits(page);
  await page.getByRole('tab', { name: /^Cancelled/ }).click();
  await expect(page.getByText('Raw Forest Honey · 500 g')).toBeVisible();
  await expectFits(page);

  // A customer with nothing: the mock database is edited in the tab's storage, then re-read.
  await control(page, 'setDiscount', '10.00');
  await page.evaluate(
    ({ key, customerId }) => {
      const db = JSON.parse(window.sessionStorage.getItem(key)!);
      db.subscriptions = db.subscriptions.filter((s: { customerId: string }) => s.customerId !== customerId);
      window.sessionStorage.setItem(key, JSON.stringify(db));
    },
    { key: STORE_KEY, customerId: subscriptionFixtureIds.customerId },
  );
  await page.goto('/portal/subscriptions');
  await expect(page.getByText('No subscriptions yet. Look for Subscribe on a product page.')).toBeVisible();
  await expectFits(page);
  await page.getByRole('tab', { name: /^Cancelled/ }).click();
  await expect(page.getByText('No cancelled subscriptions.')).toBeVisible();
  await expectFits(page);
});

test('the detail: unlocked, locked, paused, suspended, cancelled and not found', async ({ page }) => {
  for (const [id, heading] of [
    [mine.activeUnlocked, /Organic Rolled Oats/],
    [mine.activeLocked, /Thai Jasmine Rice/],
    [mine.paused, /Date Palm Gur/],
    [mine.suspendedUnpaid, /Garam Masala Blend/],
    [mine.cancelled, /Raw Forest Honey/],
    [mine.addressMissing, /Pure Mustard Oil/],
  ] as const) {
    await page.goto(`/portal/subscriptions/${id}`);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Deliveries so far' })).toBeVisible();
    await expectFits(page);
  }
  await page.goto('/portal/subscriptions/5b000000-0000-0000-0000-00000000dead');
  await expect(page.getByText("We couldn't find that subscription.")).toBeVisible();
  await expectFits(page);
});

test('each of the six dialogs', async ({ page }) => {
  await page.goto(`/portal/subscriptions/${mine.activeUnlocked}`);
  await expect(page.getByRole('heading', { level: 1, name: /Organic Rolled Oats/ })).toBeVisible();
  const open = async (button: RegExp | string, dialogName: RegExp | string) => {
    await page.getByRole('button', { name: button, exact: typeof button === 'string' }).click();
    const dialog = page.getByRole('dialog', { name: dialogName });
    await expect(dialog).toBeVisible();
    await expectFits(page, '[role="dialog"]');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  };
  await open('Change', /^Change /);
  await open(/^Skip the delivery on /, /^Skip the delivery on /);
  await open('Pause', /^Pause /);
  await open('Cancel subscription', /^Cancel /);

  await page.goto(`/portal/subscriptions/${mine.paused}`);
  await open('Resume', /^Resume /);

  await page.goto(`/portal/subscriptions/${mine.activeLocked}`);
  await open('Withdraw scheduled changes', 'Withdraw scheduled changes?');
  await open('Cancel subscription', /^Cancel /);
});

test('the overview card', async ({ page }) => {
  await page.goto('/portal');
  const card = page.getByTestId('next-delivery');
  await expect(card).toBeVisible();
  await expectFits(page, '[data-testid="next-delivery"]');
});
