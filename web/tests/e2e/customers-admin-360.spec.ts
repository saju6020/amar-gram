import { test, expect, signInAsStaff } from './fixtures';

// HO-P5 Amended (am): the page-overflow checks cannot see text squeezed to a letter a line inside a
// list row, a table cell or a card heading that still fits the screen.
test.beforeEach(async ({ page }) => {
  await signInAsStaff(page);
  await page.setViewportSize({ width: 360, height: 780 });
});

async function narrowest(locator: import('@playwright/test').Locator): Promise<number> {
  const widths = await locator.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  expect(widths.length).toBeGreaterThan(0);
  return Math.min(...widths);
}

test('customer rows keep the name readable beside an Incomplete pill', async ({ page }) => {
  await page.goto('/staff/customers');
  const rows = page.getByRole('list', { name: 'Customers' }).getByRole('button');
  await expect(rows.filter({ hasText: 'Incomplete' }).first()).toBeVisible();
  expect(await narrowest(rows.locator('span.flex-1'))).toBeGreaterThanOrEqual(120);
});

test('the staff Outlet column keeps a readable width', async ({ page }) => {
  await page.goto('/staff/admin/staff-accounts');
  const outletCells = page.locator('td span.flex-col').filter({ hasText: /outlet|warehouse/i });
  await expect(outletCells.first()).toBeVisible();
  expect(await narrowest(outletCells)).toBeGreaterThanOrEqual(150);
});

test('an outlet card heading is not squeezed by its pills', async ({ page }) => {
  await page.goto('/staff/admin/branches');
  const headings = page.locator('article h2');
  await expect(headings.first()).toBeVisible();
  // Two lines at most: squeezed beside its pills, "Dhanmondi outlet" broke into three.
  const lines = await headings.evaluateAll((elements) =>
    elements.map((element) => Math.round(element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight))),
  );
  for (const count of lines) expect(count).toBeLessThanOrEqual(2);
});
