import { test, expect } from './fixtures';
import { expectAxeClean, openReportsAs } from './reports-helpers';
import type { Page } from '@playwright/test';
import { subscriptionFixtureIds } from '../../mocks/handlers/subscriptions/fixtures';

/**
 * HO-P6 S2 (E11, UI-6, NFR-USA-6). axe on every staff subscription screen, both dialogs and the export refusal, at
 * 1280 and 360 px: zero serious or critical violations. Also the keyboard paths: a dialog traps focus, names itself,
 * closes with Escape and returns focus to the button that opened it.
 */
const ids = subscriptionFixtureIds;
const WIDTHS = [1280, 360] as const;

async function atWidth(page: Page, width: number) {
  await page.setViewportSize({ width, height: width === 360 ? 780 : 900 });
}

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.beforeEach(async ({ page }) => atWidth(page, width));

    test('the list', async ({ page }) => {
      await openReportsAs(page, 'ShopManager', '/staff/subscriptions');
      await expect(page.getByRole('heading', { level: 1, name: 'Subscriptions' })).toBeVisible();
      await expect(page.getByRole(width === 360 ? 'list' : 'table', { name: 'Subscriptions' })).toBeVisible();
      await expectAxeClean(page);
    });

    test('the list, filtered to nothing', async ({ page }) => {
      await openReportsAs(page, 'ShopManager', '/staff/subscriptions?q=zzzz-no-such');
      await expect(page.getByText('No subscriptions match.')).toBeVisible();
      await expectAxeClean(page);
    });

    test('Unpaid', async ({ page }) => {
      await openReportsAs(page, 'ShopManager', '/staff/subscriptions/unpaid');
      await expect(page.getByRole('region', { name: 'Suspended' })).toBeVisible();
      await expectAxeClean(page);
    });

    test('the detail, with actions and read-only', async ({ page }) => {
      await openReportsAs(page, 'ShopManager', `/staff/subscriptions/${ids.others.suspendedUnpaid}`);
      await expect(page.getByRole('button', { name: 'Restart' })).toBeVisible();
      await expectAxeClean(page);
      await openReportsAs(page, 'Reception', `/staff/subscriptions/${ids.others.suspendedUnpaid}`);
      await expect(page.getByText('Only a shop manager or an administrator can restart or cancel a subscription.')).toBeVisible();
      await expectAxeClean(page);
    });

    test('the detail of a cancelled subscription and of an unknown one', async ({ page }) => {
      await openReportsAs(page, 'ShopManager', `/staff/subscriptions/${ids.others.cancelled}`);
      await expect(page.getByRole('region', { name: 'Records' })).toContainText('Cancelled on');
      await expectAxeClean(page);
      await page.goto('/staff/subscriptions/5b000000-0000-0000-0000-0000000000ff');
      await expect(page.getByText("We couldn't find that subscription.")).toBeVisible();
      await expectAxeClean(page);
    });

    test('the Restart dialog, with its required-reason error', async ({ page }) => {
      await openReportsAs(page, 'ShopManager', `/staff/subscriptions/${ids.others.suspendedUnpaid}`);
      await page.getByRole('button', { name: 'Restart' }).click();
      const dialog = page.getByRole('dialog', { name: /Restart Shirin Akter's subscription/ });
      await expect(dialog).toBeVisible();
      await expectAxeClean(page);
      await dialog.getByRole('button', { name: 'Restart' }).click();
      await expect(dialog.getByText('Give a reason for restarting this subscription.')).toBeVisible();
      await expectAxeClean(page);
    });

    test('the Cancel dialog, with its required-note error', async ({ page }) => {
      await openReportsAs(page, 'ShopManager', `/staff/subscriptions/${ids.others.active}`);
      await page.getByRole('button', { name: 'Cancel subscription' }).click();
      const dialog = page.getByRole('dialog', { name: /Cancel Farhana Yasmin's subscription/ });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel subscription' }).click();
      await expect(dialog.getByText('Give a reason for cancelling this subscription.')).toBeVisible();
      await expectAxeClean(page);
    });

    test('the export refusal (413)', async ({ page }) => {
      await openReportsAs(page, 'ShopManager', '/staff/subscriptions');
      await page.waitForFunction(() => Boolean((window as unknown as { __subscriptionsMock?: unknown }).__subscriptionsMock));
      await page.evaluate(() => (window as unknown as { __subscriptionsMock: { setMaxExportRows(n: number): void } }).__subscriptionsMock.setMaxExportRows(2));
      await page.getByRole('button', { name: 'Export CSV' }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'Too many rows to export. Narrow the filters.' })).toBeVisible();
      await expectAxeClean(page);
    });
  });
}

test('a dialog traps focus, names itself, closes with Escape and returns focus to its button', async ({ page }) => {
  await openReportsAs(page, 'ShopManager', `/staff/subscriptions/${ids.others.suspendedUnpaid}`);
  const opener = page.getByRole('button', { name: 'Restart' });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: /Restart Shirin Akter's subscription/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleDescription(/orders resume/);
  // Tab around more times than there are controls: focus never leaves the dialog.
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('the Unpaid and All links are a link nav with the current one marked, reachable by keyboard', async ({ page }) => {
  await openReportsAs(page, 'ShopManager', '/staff/subscriptions');
  const nav = page.getByRole('navigation', { name: 'Subscription lists' });
  await expect(nav.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Unpaid' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/staff\/subscriptions\/unpaid$/);
  await expect(page.getByRole('navigation', { name: 'Subscription lists' }).getByRole('link', { name: 'Unpaid' })).toHaveAttribute('aria-current', 'page');
});
