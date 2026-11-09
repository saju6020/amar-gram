import { test, expect } from './fixtures';
import { warmRoutes } from './inventory-helpers';
import { expectAxeClean, expectNoHorizontalScroll, openReportsAs } from './reports-helpers';

/**
 * HO-RPT-002 §16 E-A1, E-A2, E-X1, E-X2 for the home dashboard, against MSW. E-A4 (a refresh past
 * the interval with a dialog open) is a real-API case in `reports-real-api.spec.ts`; the MSW
 * dashboard's refresh interval is its 60 s default.
 */
test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.beforeAll(async ({ request }) => {
  await warmRoutes(request, ['/staff', '/staff/reports']);
});

test('E-A1: staff land on /staff and see their tiles for the active branch', async ({ page }) => {
  await openReportsAs(page, 'Administrator', '/');
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByRole('heading', { level: 1, name: /^Today — .* · \S/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Expiring stock' })).toBeVisible();
  await expect(page.getByText(/Updated \d\d:\d\d \(Asia\/Dhaka\)/)).toBeVisible();
  await expect(page.getByRole('link', { name: /View report/ }).first()).toBeVisible();
});

test('E-A2: an accountant sees money tiles; an inventory clerk sees stock but no money', async ({
  page,
}) => {
  await openReportsAs(page, 'Accountant', '/staff');
  await expect(page.getByRole('heading', { level: 2, name: 'Payments today' })).toBeVisible();

  await openReportsAs(page, 'Inventory', '/staff');
  await expect(page.getByRole('heading', { level: 2, name: 'Expiring stock' })).toBeVisible();
  // The figures the server sent carry no money for this role. (Scoped to the tiles: the "Latest
  // orders" panel below can legitimately say "Waiting for payment" in an order's status.)
  await expect(
    page.locator('section[aria-labelledby^="tile-"]').getByText(/payments|receivables|revenue/i),
  ).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: /payments|receivables/i })).toHaveCount(0);
  // ...and the approvals row is dropped for a role without Billing (its 403 is not a banner).
  await expect(page.getByRole('link', { name: /waiting for approval/i })).toHaveCount(0);
});

test('E7: the sales chart has a table alternative and the pipeline links to the orders in a status', async ({ page }) => {
  await openReportsAs(page, 'Administrator', '/staff');
  const chart = page.getByRole('region', { name: 'Sales, last 14 days' });
  await expect(chart).toBeVisible();
  await expect(chart.getByRole('button', { name: /Oct 2026: .*orders?$/ })).toHaveCount(14);
  // The bars' readout is polite and says the day, the server's amount and the order count.
  await chart.getByRole('button', { name: /Oct 2026: / }).first().focus();
  await expect(chart.locator('[aria-live="polite"]')).toContainText(/Oct 2026: .*orders?/);

  await chart.getByRole('button', { name: 'Show as table' }).click();
  const table = chart.getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(15);
  await expect(table.getByRole('columnheader')).toHaveText(['Date', 'Net sales', 'Orders']);

  // A role with the Sales view also sees cash on delivery out with riders, as the server's tile.
  await expect(page.getByRole('heading', { level: 2, name: 'Cash on delivery out with riders' })).toBeVisible();

  const pipeline = page.getByRole('region', { name: 'Orders in progress' });
  await pipeline.getByRole('link', { name: /^Being packed/ }).click();
  await expect(page).toHaveURL(/\/staff\/orders\?status=Packing/);
  await expect(page.getByRole('tab', { name: /^Being packed\s*,\s*\d+ orders?$/ })).toHaveAttribute('aria-selected', 'true');
});

test('E-X1/E-X2: the dashboard is axe-clean and never scrolls sideways', async ({ page }) => {
  await openReportsAs(page, 'Administrator', '/staff');
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
  await expectAxeClean(page);
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoHorizontalScroll(page);
  }
});
