import { test, expect } from './fixtures';
import { openReportsAs } from './reports-helpers';
import type { Page } from '@playwright/test';
import { subscriptionFixtureIds } from '../../mocks/handlers/subscriptions/fixtures';

/**
 * HO-P6 S2 (E9, US-SUB-05 adapted, US-SUB-06). The staff subscription screens against the mock server:
 * filters in the address, the CSV export, the unpaid worklist, restart and cancel, and what Reception and an
 * Accountant can and cannot do. Seeded subscriptions come from `mocks/handlers/subscriptions/fixtures.ts`; the
 * spec computes no date.
 */
const ids = subscriptionFixtureIds;
const SUBSCRIPTIONS = '/staff/subscriptions';

/** The data rows of the list: table rows from 768 px, the cards (list items) below it. Header rows are not counted. */
function subscriptionRows(page: Page) {
  return page
    .getByRole('table', { name: 'Subscriptions' })
    .getByRole('row')
    .filter({ has: page.getByRole('cell') })
    .or(page.getByRole('list', { name: 'Subscriptions' }).getByRole('listitem'));
}

type Controls = { lock(id: string): void; setMaxExportRows(rows: number | null): void };

/** What a spec cannot cause through the UI (the cut-off passing, a low export cap): the mock server's controls (control.ts). */
async function mockControl(page: Page, name: keyof Controls, arg: string | number | null) {
  await page.waitForFunction(() => Boolean((window as unknown as { __subscriptionsMock?: unknown }).__subscriptionsMock));
  await page.evaluate(
    ([method, value]) => {
      const c = (window as unknown as { __subscriptionsMock: Record<string, (v: unknown) => void> }).__subscriptionsMock;
      c[method as string]!(value);
    },
    [name, arg] as const,
  );
}

test.describe('ShopManager', () => {
  test('filters (Suspended + Unpaid orders) are kept in the address and survive a reload', async ({ page }) => {
    await openReportsAs(page, 'ShopManager', SUBSCRIPTIONS);
    await expect(page.getByRole('heading', { level: 1, name: 'Subscriptions' })).toBeVisible();

    await page.getByLabel('Status').selectOption('Suspended');
    await page.getByLabel('Suspension reason').selectOption('UnpaidCycles');
    await expect(page).toHaveURL(/status=Suspended/);
    await expect(page).toHaveURL(/suspensionReason=UnpaidCycles/);
    await expect(subscriptionRows(page)).toHaveCount(2); // Sam's and Shirin's suspended-for-unpaid subscriptions
    await expect(subscriptionRows(page).getByText('Product unavailable')).toHaveCount(0);

    await page.reload();
    await expect(page.getByLabel('Status')).toHaveValue('Suspended');
    await expect(page.getByLabel('Suspension reason')).toHaveValue('UnpaidCycles');
    await expect(subscriptionRows(page)).toHaveCount(2);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(new RegExp(`${SUBSCRIPTIONS}$`));
  });

  test('nextDeliveryOn narrows the list to that day, shows as a removable chip, and goes into the export', async ({ page }) => {
    await openReportsAs(page, 'ShopManager', SUBSCRIPTIONS);
    const dueOn = await page.evaluate(async () => {
      const base = (window as unknown as { __apiBaseUrl?: string }).__apiBaseUrl ?? '';
      const response = await fetch(`${base}/api/staff/subscriptions/due-tomorrow`, { credentials: 'include' });
      return ((await response.json()) as { dueOn: string }).dueOn;
    });
    await expect(subscriptionRows(page).first()).toBeVisible();
    const all = await subscriptionRows(page).count();
    await page.goto(`${SUBSCRIPTIONS}?status=Active&nextDeliveryOn=${dueOn}`);
    const chip = page.getByRole('button', { name: /^Remove filter: Next delivery/ });
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('Next delivery:');
    await expect(subscriptionRows(page).first()).toBeVisible();
    const narrowed = await subscriptionRows(page).count();
    expect(narrowed).toBeGreaterThanOrEqual(1);
    expect(narrowed).toBeLessThan(all);

    const exportRequest = page.waitForRequest((r) => r.url().includes('/export.csv'));
    await page.getByRole('button', { name: 'Export CSV' }).click();
    expect(new URL((await exportRequest).url()).searchParams.get('nextDeliveryOn')).toBe(dueOn);

    await chip.click();
    await expect(page).not.toHaveURL(/nextDeliveryOn/);
    await expect(chip).toHaveCount(0);
    await expect(page).toHaveURL(/status=Active/);
  });

  test('search, sort and a row link to the detail', async ({ page }) => {
    await openReportsAs(page, 'ShopManager', SUBSCRIPTIONS);
    await page.getByRole('searchbox', { name: 'Customer, mobile or product' }).fill('shirin');
    await expect(page).toHaveURL(/q=shirin/);
    await expect(subscriptionRows(page)).toHaveCount(1);
    await page.getByRole('link', { name: /Raw Forest Honey/ }).click();
    await expect(page).toHaveURL(new RegExp(`${SUBSCRIPTIONS}/${ids.others.suspendedUnpaid}$`));
    await expect(page.getByRole('heading', { level: 1, name: /Raw Forest Honey/ })).toBeVisible();
  });

  test('Export CSV asks for the current filters with no paging and saves subscriptions.csv', async ({ page }) => {
    await openReportsAs(page, 'ShopManager', `${SUBSCRIPTIONS}?status=Suspended&sort=product&page=1`);
    const request = page.waitForRequest((r) => r.url().includes('/api/staff/subscriptions/export.csv'));
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const url = new URL((await request).url());
    expect(Object.fromEntries(url.searchParams)).toEqual({ status: 'Suspended', sort: 'product' });
    const file = await download;
    expect(file.suggestedFilename()).toBe('subscriptions.csv');
    const text = await (await import('node:fs/promises')).readFile((await file.path())!, 'utf8');
    expect(text.split(/\r?\n/)[0]).toContain('"SubscriptionId","Customer","Mobile","Product"');
  });

  test('a 413 from the export is explained in words', async ({ page }) => {
    await openReportsAs(page, 'ShopManager', SUBSCRIPTIONS);
    await mockControl(page, 'setMaxExportRows', 2);
    await page.getByRole('button', { name: 'Export CSV' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Too many rows to export. Narrow the filters.' })).toBeVisible();
  });

  test('Unpaid lists the Suspended and At risk groups with their unpaid orders; restarting one moves it out of Suspended', async ({ page }) => {
    await openReportsAs(page, 'ShopManager', SUBSCRIPTIONS);
    await page.getByRole('navigation', { name: 'Subscription lists' }).getByRole('link', { name: 'Unpaid' }).click();
    await expect(page).toHaveURL(/\/staff\/subscriptions\/unpaid$/);
    const suspended = page.getByRole('region', { name: 'Suspended' });
    const atRisk = page.getByRole('region', { name: 'At risk' });
    await expect(suspended).toBeVisible();
    await expect(atRisk).toBeVisible();
    await expect(suspended.getByText('Shirin Akter')).toBeVisible();
    await expect(suspended.getByRole('link', { name: /^ORD-/ })).not.toHaveCount(0);
    await expect(suspended.getByText('Expired unpaid').first()).toBeVisible();

    await suspended.getByRole('link', { name: /Open Shirin Akter/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${ids.others.suspendedUnpaid}$`));
    await page.getByRole('button', { name: 'Restart' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: "Restart Shirin Akter's subscription to Raw Forest Honey?" })).toBeVisible();
    await dialog.getByRole('button', { name: 'Restart' }).click(); // no reason yet
    await expect(dialog.getByText('Give a reason for restarting this subscription.')).toBeVisible();
    await dialog.getByLabel(/Reason/).fill('Paid at the Uttara counter');
    await dialog.getByRole('button', { name: 'Restart' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('status').filter({ hasText: /^Restarted\. Next delivery on / })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Records' })).toContainText('Restarted on');
    await expect(page.getByRole('region', { name: 'Records' })).toContainText('Paid at the Uttara counter');
    await expect(page.getByRole('button', { name: 'Restart' })).toHaveCount(0);

    await page.goto('/staff/subscriptions/unpaid');
    await expect(page.getByRole('region', { name: 'Suspended' }).getByText('Shirin Akter')).toHaveCount(0);
  });

  // A cross-branch refusal (HO-P6 20.9) would be the order page's own; the link is kept either way.
  test('an order number in the history opens the staff order page', async ({ page }) => {
    await openReportsAs(page, 'ShopManager', `${SUBSCRIPTIONS}/${ids.others.suspendedUnpaid}`);
    const link = page.getByRole('region', { name: 'Order history' }).getByRole('link', { name: /^ORD-/ }).first();
    const number = (await link.textContent())!.trim();
    await link.click();
    await expect(page).toHaveURL(/\/staff\/orders\/[0-9a-f-]{36}$/);
    await expect(page.getByText(number).first()).toBeVisible();
  });

  test('cancelling needs a note and ends an unlocked subscription at once', async ({ page }) => {
    await openReportsAs(page, 'ShopManager', `${SUBSCRIPTIONS}/${ids.others.active}`);
    await page.getByRole('button', { name: 'Cancel subscription' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Cancel subscription' }).click();
    await expect(dialog.getByText('Give a reason for cancelling this subscription.')).toBeVisible();
    await dialog.getByLabel(/Note/).fill('Customer asked by phone');
    await dialog.getByRole('button', { name: 'Cancel subscription' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Subscription cancelled.' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Records' })).toContainText('Cancelled by the shop, Customer asked by phone');
    await expect(page.getByRole('button', { name: 'Cancel subscription' })).toHaveCount(0);
  });

  test('after the cut-off a cancel is scheduled, and the wording says so', async ({ page }) => {
    await openReportsAs(page, 'ShopManager', `${SUBSCRIPTIONS}/${ids.others.active}`);
    await mockControl(page, 'lock', ids.others.active);
    await page.reload();
    await page.getByRole('button', { name: 'Cancel subscription' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('is already being prepared and will still be placed; the subscription ends after it.');
    await dialog.getByLabel(/Note/).fill('Moving away');
    await dialog.getByRole('button', { name: 'Cancel subscription' }).click();
    await expect(page.getByRole('status').filter({ hasText: /^Cancellation scheduled\. Ends after the delivery on / })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Schedule' })).toContainText('Ends after the delivery on');
  });

  test('the sidebar has a Subscriptions entry that is current on the list, Unpaid and a detail page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const path of [SUBSCRIPTIONS, `${SUBSCRIPTIONS}/unpaid`, `${SUBSCRIPTIONS}/${ids.others.paused}`]) {
      await openReportsAs(page, 'ShopManager', path);
      const link = page.locator('aside').getByRole('link', { name: 'Subscriptions' });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('aria-current', 'page');
    }
  });
});

test.describe('other roles', () => {
  test('Reception sees the record but no Restart, no Cancel and no Export, and is told who can act', async ({ page }) => {
    await openReportsAs(page, 'Reception', SUBSCRIPTIONS);
    await expect(subscriptionRows(page).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toHaveCount(0);

    await page.goto(`${SUBSCRIPTIONS}/${ids.others.suspendedUnpaid}`);
    await expect(page.getByRole('heading', { level: 1, name: /Raw Forest Honey/ })).toBeVisible();
    await expect(page.getByText('Only a shop manager or an administrator can restart or cancel a subscription.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restart' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancel subscription' })).toHaveCount(0);
  });

  test('an Accountant can export but has no actions', async ({ page }) => {
    await openReportsAs(page, 'Accountant', SUBSCRIPTIONS);
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await page.goto(`${SUBSCRIPTIONS}/${ids.others.suspendedUnpaid}`);
    await expect(page.getByText('Only a shop manager or an administrator can restart or cancel a subscription.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restart' })).toHaveCount(0);
  });

  test('an unknown subscription is explained, with a way back', async ({ page }) => {
    await openReportsAs(page, 'ShopManager', `${SUBSCRIPTIONS}/5b000000-0000-0000-0000-0000000000ff`);
    await expect(page.getByText("We couldn't find that subscription.")).toBeVisible();
    await page.getByRole('link', { name: 'All subscriptions' }).click();
    await expect(page).toHaveURL(new RegExp(`${SUBSCRIPTIONS}$`));
  });
});
