import { test, expect } from './fixtures';
import { expectNoHorizontalScroll, openReportsAs } from './reports-helpers';
import type { Locator, Page } from '@playwright/test';
import { subscriptionFixtureIds } from '../../mocks/handlers/subscriptions/fixtures';

/**
 * HO-P6 S2 (E10, UI-1, NFR-CMP-2). Every staff subscription screen and both dialogs at 360 px: no sideways scroll and
 * every control at least 44 px high. The list becomes cards below 768 px. Read-only roles are covered by the Reception
 * detail. Seeded ids come from `mocks/handlers/subscriptions/fixtures.ts`.
 */
const ids = subscriptionFixtureIds;
const TARGET = 44;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
});

/**
 * Every visible control inside `scope` is at least 44 px tall. A link may wrap a taller child (an inline-flex target
 * inside the shared table's row link), so a link counts the tallest thing inside it.
 */
async function expectTargets(scope: Locator) {
  const small = await scope.evaluate((root, minimum) => {
    const controls = Array.from(root.querySelectorAll<HTMLElement>('a[href], button, select, input:not([type="hidden"]), textarea'));
    return controls
      .filter((el) => el.getClientRects().length > 0 && !el.closest('.sr-only') && getComputedStyle(el).visibility !== 'hidden')
      .map((el) => {
        const own = el.getBoundingClientRect().height;
        const inner = Array.from(el.querySelectorAll<HTMLElement>('*')).map((c) => c.getBoundingClientRect().height);
        return { name: (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim().slice(0, 40), height: Math.max(own, ...inner) };
      })
      .filter((c) => c.height < minimum - 0.5);
  }, TARGET);
  expect(small, `controls under ${TARGET}px: ${JSON.stringify(small)}`).toEqual([]);
}

async function expectFits(page: Page) {
  await expectNoHorizontalScroll(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
}

test('the list becomes cards, with its filters and Export, and fits', async ({ page }) => {
  await openReportsAs(page, 'ShopManager', '/staff/subscriptions');
  await expect(page.getByRole('list', { name: 'Subscriptions' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  await expectFits(page);
  await expectTargets(page.locator('#main-content'));
});

test('the list with a filter applied and the empty state fit', async ({ page }) => {
  await openReportsAs(page, 'ShopManager', '/staff/subscriptions?status=Suspended&suspensionReason=UnpaidCycles');
  await expect(page.getByRole('list', { name: 'Subscriptions' })).toBeVisible();
  await expectFits(page);
  await page.goto('/staff/subscriptions?q=zzzz-no-such');
  await expect(page.getByText('No subscriptions match.')).toBeVisible();
  await expectFits(page);
  await expectTargets(page.locator('#main-content'));
});

test('Unpaid fits, with its groups and order links', async ({ page }) => {
  await openReportsAs(page, 'ShopManager', '/staff/subscriptions/unpaid');
  await expect(page.getByRole('region', { name: 'Suspended' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'At risk' })).toBeVisible();
  await expectFits(page);
  await expectTargets(page.locator('#main-content'));
});

test('the detail stacks its panels and fits (suspended, with actions)', async ({ page }) => {
  await openReportsAs(page, 'ShopManager', `/staff/subscriptions/${ids.others.suspendedUnpaid}`);
  await expect(page.getByRole('button', { name: 'Restart' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Order history' })).toBeVisible();
  await expectFits(page);
  await expectTargets(page.locator('#main-content'));
});

test('a read-only role sees the detail without actions, and it fits', async ({ page }) => {
  await openReportsAs(page, 'Reception', `/staff/subscriptions/${ids.others.suspendedUnpaid}`);
  await expect(page.getByText('Only a shop manager or an administrator can restart or cancel a subscription.')).toBeVisible();
  await expectFits(page);
  await expectTargets(page.locator('#main-content'));
});

test('the Restart dialog fits and its controls are 44 px', async ({ page }) => {
  await openReportsAs(page, 'ShopManager', `/staff/subscriptions/${ids.others.suspendedUnpaid}`);
  await page.getByRole('button', { name: 'Restart' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Restart' }).click(); // shows the required-reason error too
  await expect(dialog.getByText('Give a reason for restarting this subscription.')).toBeVisible();
  await expectFits(page);
  await expectTargets(dialog);
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
});

test('the Cancel dialog fits and its controls are 44 px', async ({ page }) => {
  await openReportsAs(page, 'ShopManager', `/staff/subscriptions/${ids.others.active}`);
  await page.getByRole('button', { name: 'Cancel subscription' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectFits(page);
  await expectTargets(dialog);
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
});

test('the sidebar sheet shows the Subscriptions entry', async ({ page }) => {
  await openReportsAs(page, 'ShopManager', '/staff/subscriptions');
  const trigger = page.locator('[aria-label="Expand menu"]');
  await trigger.focus();
  await trigger.press('Enter');
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  const link = sheet.getByRole('link', { name: 'Subscriptions', exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('aria-current', 'page');
  await link.click();
  await expect(page).toHaveURL(/\/staff\/subscriptions$/);
});
