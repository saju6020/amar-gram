import type { Page } from '@playwright/test';
import { test, expect as baseExpect } from './fixtures';
import { signInEstablished } from './portal-helpers';
import { openReportsAs } from './reports-helpers';
import { seedProducts } from '../../mocks/handlers/shop/fixtures';
import { subscriptionFixtureIds } from '../../mocks/handlers/subscriptions/fixtures';
import type { SubscriptionsMockControls } from '../../mocks/handlers/subscriptions/control';

// The first visit to each back-office route compiles it in `next dev`: allow for that.
const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000 });

/**
 * HO-P6 S3 (E13, A15, A16). The back-office touch points against the mock server: the product editor's "Can be subscribed to"
 * switch (and the signed-in customer's offer following it), the customer profile's Subscriptions tab, the dashboard's
 * "Subscription orders due tomorrow" row, and the orders Channel filter. Seeded ids come from the fixtures; nothing here
 * computes a date. In mock mode the browser's mock store is shared by staff and customer screens, so the offer (a client island
 * reading C1) follows the flag the staff just saved; the server-rendered product page itself is unchanged.
 */
const ids = subscriptionFixtureIds;
const NEEM = seedProducts().find((p) => p.slug === 'neem-soap-bar')!;
const SUBSCRIBABLE = { name: 'Can be subscribed to' };

async function resetSubscriptions(page: Page): Promise<void> {
  await page.evaluate(() => {
    const controls = (window as unknown as { __subscriptionsMock?: SubscriptionsMockControls }).__subscriptionsMock;
    controls?.reset();
  });
}

async function saveDetails(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  await expect(page.locator('form [role="alert"]')).toHaveCount(0); // no save error (the route announcer is not in the form)
}

test.describe('product editor (BG-15)', () => {
  test('E13: tick "Can be subscribed to", save, and the signed-in customer sees the offer; untick, save, and it is gone', async ({ page }) => {
    await openReportsAs(page, 'Administrator', `/staff/shop/products/${NEEM.productId}`);
    const box = page.getByRole('checkbox', SUBSCRIBABLE);
    await expect(box).not.toBeChecked();
    await expect(page.getByText('Turning it off does not cancel existing subscriptions', { exact: false })).toBeVisible();

    await box.check();
    await saveDetails(page);
    await page.reload();
    await expect(page.getByRole('checkbox', SUBSCRIBABLE)).toBeChecked();

    // The customer, in the same tab (the mock store is the browser's).
    await signInEstablished(page);
    await page.goto(`/shop/products/${NEEM.slug}`);
    await expect(page.getByRole('button', { name: /Add to (cart|basket)/ })).toBeVisible();
    await expect(page.getByTestId('subscribe-offer')).toBeVisible();
    await expect(page.getByRole('link', { name: /^Subscribe/ })).toHaveAttribute('href', /\/portal\/subscriptions\/new\/[0-9a-f-]{36}$/);

    // Untick and save as staff again: the offer is gone.
    await openReportsAs(page, 'Administrator', `/staff/shop/products/${NEEM.productId}`);
    await expect(page.getByRole('checkbox', SUBSCRIBABLE)).toBeChecked();
    await page.getByRole('checkbox', SUBSCRIBABLE).uncheck();
    await saveDetails(page);
    await signInEstablished(page);
    // The offer reads C1 after render: wait for that answer, then for the page to paint it, before asserting the absence.
    const options = page.waitForResponse((r) => r.url().includes('/subscriptions/options'));
    await page.goto(`/shop/products/${NEEM.slug}`);
    await expect(page.getByRole('button', { name: /Add to (cart|basket)/ })).toBeVisible();
    expect((await options).status()).toBe(200);
    await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
    await expect(page.getByTestId('subscribe-offer')).toHaveCount(0);
  });
});

test.describe('customer profile (US-SUB-06)', () => {
  test('E13: the Subscriptions tab lists the seeded live subscriptions and links to the staff detail', async ({ page }) => {
    await openReportsAs(page, 'Administrator', `/staff/customers/${ids.customerId}`);
    await resetSubscriptions(page);
    await page.reload();
    const tabs = page.getByRole('tablist', { name: 'Customer details' });
    const tab = tabs.getByRole('tab', { name: /^Subscriptions \(\d+\)$/ });
    await expect(tab).toBeVisible();
    // Orders, Subscriptions, Billing, Notes: the tab sits after Orders.
    await expect(tabs.getByRole('tab').nth(1)).toHaveText(/^Subscriptions/);
    await tab.click();

    const panel = page.getByRole('tabpanel', { name: 'Subscriptions' });
    await expect(panel.getByRole('link').first()).toBeVisible();
    const count = Number((await tab.textContent())!.match(/\((\d+)\)/)![1]);
    await expect(panel.getByRole('link')).toHaveCount(count);
    await expect(panel).toContainText(/\d+ suspended · \d+ cancelled/);
    // Status is a word, and the suspended ones are listed too.
    await expect(panel.getByText('Suspended').first()).toBeVisible();

    const link = panel.locator(`a[href="/staff/subscriptions/${ids.mine.activeUnlocked}"]`);
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/staff/subscriptions/${ids.mine.activeUnlocked}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('dashboard (BG-15, OQ-12)', () => {
  test('E13: "Subscription orders due tomorrow" shows the server count and opens the Active list', async ({ page }) => {
    await openReportsAs(page, 'Administrator', '/staff');
    await resetSubscriptions(page);
    await page.reload();
    const panel = page.getByRole('region', { name: 'Needs attention' }).or(page.locator('section', { has: page.getByRole('heading', { name: 'Needs attention' }) }));
    const row = panel.getByRole('link', { name: /Subscription orders due tomorrow/ });
    await expect(row).toBeVisible();
    const served = await page.evaluate(async () => {
      const base = (window as unknown as { __apiBaseUrl?: string }).__apiBaseUrl ?? '';
      const response = await fetch(`${base}/api/staff/subscriptions/due-tomorrow`, { credentials: 'include' });
      return (await response.json()) as { count: number; suspendedCount: number };
    });
    expect(served.count).toBeGreaterThanOrEqual(1);
    await expect(row).toContainText(String(served.count));
    await expect(panel.getByRole('link', { name: /Subscriptions suspended/ })).toContainText(String(served.suspendedCount));

    await row.click();
    await expect(page).toHaveURL(/\/staff\/subscriptions\?status=Active$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Subscriptions' })).toBeVisible();
    await expect(page.getByLabel('Status')).toHaveValue('Active');
  });
});

test.describe('orders channel (OQ-11)', () => {
  test('E13: Channel "Subscription" lists only subscription orders and the pills are counted with the filter', async ({ page }) => {
    await openReportsAs(page, 'Administrator', '/staff/orders');
    const all = page.getByRole('tablist', { name: 'Order status' }).getByRole('tab', { name: /^All/ });
    await expect(all).toHaveAttribute('aria-selected', 'true');
    await expect(all).toContainText(/\d/); // the counts arrive from their own request
    const total = Number((await all.textContent())!.match(/^All(\d+)/)![1]);

    await page.getByText('More filters').click();
    const channel = page.getByLabel('Channel');
    await expect(channel.locator('option')).toHaveText(['Any channel', 'Online', 'Counter', 'Subscription']);
    await channel.selectOption('Subscription');
    await expect(page).toHaveURL(/channel=Subscription/);

    // Table rows from 1024 px, the list's items (cards) below it.
    const rows = page
      .getByRole('table')
      .getByRole('row')
      .filter({ has: page.getByRole('cell') })
      .or(page.getByRole('list', { name: 'Orders' }).getByRole('listitem'));
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) await expect(rows.nth(i)).toContainText('Subscription');
    // The "All" pill counts the filtered orders (the server counts under every filter but status).
    await expect(all).toContainText(`All${count}`);
    const filteredTotal = Number((await all.textContent())!.match(/^All(\d+)/)![1]);
    expect(filteredTotal).toBeLessThan(total);

    await channel.selectOption('');
    await expect(page).not.toHaveURL(/channel=/);
  });
});
