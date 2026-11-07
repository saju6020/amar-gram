import type { Page } from '@playwright/test';
import { test, expect, signInAsCustomer } from './fixtures';

/**
 * HO-NTF-002 §16 — E-A1, E-A2, E-B1 against MSW.
 *
 * Real-API runs (HO-NTF-002 §16 "MSW first, then the real API"): E-A1 against the real API needs a
 * dispatched order so the order notification is sent; that cannot be arranged from this worktree (no database, no API process), so the real-API
 * column of E-A1/E-A2/E-B1 is recorded as NOT RUNNABLE in `docs/test-cases/TC-HO-NTF-002.md`.
 * Against MSW the seeded inbox stands in for the sent notification.
 */

test.beforeEach(async ({ page }) => {
  await signInAsCustomer(page);
});

/**
 * Checks the unread-count link. From `sm` up it is the envelope button in the header; on a phone the
 * header has no envelope (`max-sm:hidden`), so the same link, with the same accessible name, is the
 * "Messages" row in the account menu: open it, check, and close it again so it does not cover the page.
 */
async function expectUnreadLink(page: Page, count: number) {
  const link = page.getByRole('link', { name: `Inbox, ${count} unread messages` });
  if ((page.viewportSize()?.width ?? 1280) >= 640) {
    await expect(link).toBeVisible();
    return;
  }
  const menu = page.getByRole('button', { name: /^Account menu for / });
  await menu.click();
  await expect(link).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
}

test('E-A1: the inbox shows the order message with a View link to the order page, and the badge counts unread messages', async ({
  page,
}) => {
  await page.goto('/portal/inbox');
  await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible();
  await expectUnreadLink(page, 3);

  await page.getByRole('button', { name: /Order SO-2026-00042 is on its way/ }).click();
  const view = page.getByRole('link', { name: 'View', exact: true });
  await expect(view).toHaveAttribute('href', /^\/portal\/orders\//);
});

test('E-A2: opening an item clears it from the badge count', async ({ page }) => {
  await page.goto('/portal/inbox');
  await expectUnreadLink(page, 3);
  await page.getByRole('button', { name: /Order SO-2026-00042 is on its way/ }).click();
  await expectUnreadLink(page, 2);

  // The Unread filter now omits the opened item and is kept in the URL.
  await page.getByRole('button', { name: 'Unread', exact: true }).click();
  await expect(page).toHaveURL(/filter=unread/);
  await expect(page.getByRole('button', { name: /Order SO-2026-00042 is on its way/ })).toHaveCount(
    0,
  );
});

test('an unsafe linkPath produces no View link and markup in a message is shown as text', async ({
  page,
}) => {
  await page.goto('/portal/inbox');
  await page.getByRole('button', { name: /A message with an unsafe link/ }).click();
  await expect(page.getByText('This item carries a protocol-relative link')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: /<b>Bold title<\/b>/ }).click();
  await expect(page.getByText('<b>hi</b> and **x**', { exact: false }).first()).toBeVisible();
  expect(await page.locator('main b, main strong').count()).toBe(0);
});

test('E-B1: changing the preferred channel to email and saving survives a reload', async ({
  page,
}) => {
  await page.goto('/portal/account/notifications');
  await expect(page.getByRole('radio', { name: 'Text message (SMS)' })).toBeChecked();
  await page.getByRole('radio', { name: 'Email' }).check();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Your notification preferences have been saved.')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('radio', { name: 'Email' })).toBeChecked();
});
