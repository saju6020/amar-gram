import fs from 'node:fs';
// Plain Playwright `test`, not ./fixtures: that wrapper waits for MSW's service worker, which never exists when
// NEXT_PUBLIC_USE_MOCKS=false (the whole point of this spec).
import { test, expect, type Page } from '@playwright/test';
import { expectAxeClean, expectNoHorizontalScroll } from './reports-helpers';

/**
 * HO-P6 S2 (§16 E18) -- the staff subscription cases re-run against the REAL API (HO-SUB-001 as built). Manual: needs
 * the API running on a scratch database with `Cors__AllowedOrigins__0` = this app's origin, this app started with
 * `NEXT_PUBLIC_USE_MOCKS=false NEXT_PUBLIC_API_BASE_URL=<the API>`, `E2E_REAL_API=1`, and `SUBS_SEED` pointing at a
 * JSON file: `{ people: { shopManager, reception, accountant: { mobile, password } }, suspendedId?, activeId? }`.
 * `suspendedId` is a subscription suspended for unpaid orders and `activeId` a live one; the restart and cancel cases
 * run only when they are given (they change the database). Skipped otherwise. Serial: the cases share one database.
 */
const SEED_PATH = process.env.SUBS_SEED;
const enabled = process.env.E2E_REAL_API === '1' && process.env.NEXT_PUBLIC_USE_MOCKS === 'false' && !!SEED_PATH;
const seed = enabled
  ? (JSON.parse(fs.readFileSync(SEED_PATH!, 'utf8')) as {
      people: Record<'shopManager' | 'reception' | 'accountant', { mobile: string; password: string }>;
      suspendedId?: string;
      activeId?: string;
    })
  : null;

const slow = expect.configure({ timeout: 30_000 });

test.describe.configure({ mode: 'serial', timeout: 180_000 });
test.skip(!enabled, 'real-API run only (E2E_REAL_API=1, NEXT_PUBLIC_USE_MOCKS=false, SUBS_SEED=<seed.json>)');

async function signInAs(page: Page, person: keyof NonNullable<typeof seed>['people']): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/staff/sign-in');
  await page.waitForFunction(() => (window as unknown as { __apiBaseUrl?: string }).__apiBaseUrl !== undefined);
  const { mobile, password } = seed!.people[person];
  const status = await page.evaluate(
    async ({ mobile, password }) => {
      const base = (window as unknown as { __apiBaseUrl?: string }).__apiBaseUrl ?? '';
      const response = await fetch(`${base}/api/staff/auth/sign-in`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: mobile, password }),
      });
      return response.status;
    },
    { mobile, password },
  );
  expect(status).toBe(200);
}

test('the shop manager lists subscriptions, keeps filters in the address and exports a CSV', async ({ page }) => {
  await signInAs(page, 'shopManager');
  await page.goto('/staff/subscriptions');
  await slow(page.getByRole('heading', { level: 1, name: 'Subscriptions' })).toBeVisible();
  await page.getByLabel('Status').selectOption('Active');
  await expect(page).toHaveURL(/status=Active/);
  await page.reload();
  await slow(page.getByLabel('Status')).toHaveValue('Active');

  const request = page.waitForRequest((r) => r.url().includes('/api/staff/subscriptions/export.csv'));
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  expect(new URL((await request).url()).searchParams.get('status')).toBe('Active');
  expect((await download).suggestedFilename()).toBe('subscriptions.csv');
  await expectAxeClean(page);
});

test('the unpaid worklist loads and is clean', async ({ page }) => {
  await signInAs(page, 'shopManager');
  await page.goto('/staff/subscriptions/unpaid');
  await slow(page.getByRole('heading', { level: 1, name: 'Unpaid subscriptions' })).toBeVisible();
  await expectAxeClean(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await expectNoHorizontalScroll(page);
});

test('a detail opens from the list, reception sees no actions and an accountant can export', async ({ page }, testInfo) => {
  await signInAs(page, 'shopManager');
  await page.goto('/staff/subscriptions');
  // At 360 the list is a card list, not a table (S2 E-cases); its first card's first link is the subscription.
  const first =
    testInfo.project.name === 'mobile-360'
      ? page.getByRole('list', { name: 'Subscriptions' }).getByRole('listitem').first().getByRole('link').first()
      : page.getByRole('table', { name: 'Subscriptions' }).getByRole('row').nth(1).getByRole('link').last();
  await slow(first).toBeVisible();
  const href = await first.getAttribute('href');
  expect(href).toMatch(/^\/staff\/subscriptions\/[0-9a-f-]{36}$/);

  await signInAs(page, 'reception');
  await page.goto(href!);
  await slow(page.getByText('Only a shop manager or an administrator can restart or cancel a subscription.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart' })).toHaveCount(0);
  await page.goto('/staff/subscriptions');
  await expect(page.getByRole('button', { name: 'Export CSV' })).toHaveCount(0);

  await signInAs(page, 'accountant');
  await page.goto('/staff/subscriptions');
  await slow(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
});

test('a suspended subscription is restarted with a reason (changes the database)', async ({ page }) => {
  test.skip(!seed?.suspendedId, 'no suspendedId in the seed');
  await signInAs(page, 'shopManager');
  await page.goto(`/staff/subscriptions/${seed!.suspendedId}`);
  await slow(page.getByRole('button', { name: 'Restart' })).toBeVisible();
  await page.getByRole('button', { name: 'Restart' }).click();
  await page.getByRole('dialog').getByLabel(/Reason/).fill('Paid at the counter (real-API run)');
  await page.getByRole('dialog').getByRole('button', { name: 'Restart' }).click();
  await slow(page.getByRole('status').filter({ hasText: /^Restarted\./ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart' })).toHaveCount(0);
});

test('a live subscription is cancelled with a note (changes the database)', async ({ page }) => {
  test.skip(!seed?.activeId, 'no activeId in the seed');
  await signInAs(page, 'shopManager');
  await page.goto(`/staff/subscriptions/${seed!.activeId}`);
  await page.getByRole('button', { name: 'Cancel subscription' }).click();
  await page.getByRole('dialog').getByLabel(/Note/).fill('Cancelled by the real-API run');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel subscription' }).click();
  await slow(page.getByRole('status').filter({ hasText: /^(Subscription cancelled\.|Cancellation scheduled\.)/ })).toBeVisible();
});
