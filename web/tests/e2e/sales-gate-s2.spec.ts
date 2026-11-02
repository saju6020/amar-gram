import { test, expect as baseExpect, signInAsStaff } from './fixtures';
import { control } from './ordering-helpers';
import { expectAxeClean, expectNoHorizontalScroll } from './reports-helpers';
import { p5OrderIds } from '../../mocks/handlers/ordering/store';

const expect = baseExpect.configure({ timeout: 20_000 });
// No in-file retry: the TEST gate counts first attempts.
test.describe.configure({ timeout: 120_000, retries: 0 });

/**
 * HO-P5 S2 TEST gate (written by the test engineer, rows G3-G5 of TC-HO-P5-WIRING-S2): the screens S2 added or changed that no
 * existing spec checks for a sideways scroll at the project's viewport (360 px on `mobile-360`, desktop on `chromium`) or with axe in
 * their new state: the riders registry with its dialog, the counter sale with a category chosen and a change preview showing, and
 * the orders queue filtered to Packed with a Packed order's page.
 */
async function start(page: import('@playwright/test').Page) {
  await page.goto('/staff/sign-in');
  await control(page, 'reset');
  await signInAsStaff(page);
}

test('G3: the riders registry, with its add dialog open, does not scroll sideways and is axe clean', async ({ page }) => {
  await start(page);
  await page.goto('/staff/fulfilment/riders');
  await expect(page.getByRole('heading', { level: 1, name: 'Riders' })).toBeVisible();
  await expect(page.locator('#main-content')).toContainText('Rafiq Hasan');
  await expectNoHorizontalScroll(page);
  await expectAxeClean(page);
  await page.getByRole('button', { name: 'Add rider' }).click();
  await expect(page.getByRole('dialog', { name: 'Add a rider' })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('G4: the counter sale with a category chosen, a line in the basket and a change preview does not scroll sideways and is axe clean', async ({ page }) => {
  await start(page);
  await page.goto('/staff/pos');
  await expect(page.getByRole('heading', { level: 1, name: 'Counter sale' })).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Item categories' });
  await tabs.getByRole('tab', { name: 'Rice & grains' }).click();
  const grid = page.getByRole('list', { name: 'Rice & grains to sell' });
  await grid.getByRole('button', { name: /^Add Thai Jasmine Rice/ }).click();
  await expect(page.getByRole('list', { name: 'Basket' }).getByRole('listitem')).toHaveCount(1);
  await page.getByLabel(/handed over/).fill('500');
  await expect(page.getByRole('status').filter({ hasText: /Still to pay/ })).toContainText('280.00');
  await expectNoHorizontalScroll(page);
  await expectAxeClean(page);
  // Adding a payment hides the preview (Amended (ab)): nothing about change or still-to-pay remains.
  await page.getByRole('button', { name: 'Add payment' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Still to pay|Change due/ })).toHaveCount(0);
});

test('G5: the orders queue filtered to Packed, and a Packed order page, do not scroll sideways and are axe clean', async ({ page }) => {
  await start(page);
  await page.goto('/staff/orders?status=Packed');
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
  await expect(page.locator('#main-content')).toContainText('ORD-2026-000112');
  await expectNoHorizontalScroll(page);
  await expectAxeClean(page);
  await page.goto(`/staff/orders/${p5OrderIds.packedWaiting}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Order ORD-2026-000112' })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectAxeClean(page);
});
