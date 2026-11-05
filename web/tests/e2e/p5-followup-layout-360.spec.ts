import type { Locator, Page } from '@playwright/test';
import { test, expect, signInAsStaff } from './fixtures';
import { expectNoHorizontalScroll } from './reports-helpers';
import { accountsFixtureIds } from '../../mocks/handlers/areas/accounts';
import { administrationFixtureIds } from '../../mocks/handlers/admin';
import { orderingIds } from '../../mocks/handlers/ordering/fixtures';

// HO-P5 follow-up: the small responsive defects the S2, S3 and S4 ACCEPTANCE gates listed (S4 F4, F5, F7;
// S2 order panels, dashboard money tiles, pick list; S3 F2). The page-overflow checks cannot see a word
// squeezed to a few letters a line inside a panel that still fits the screen, so these measure it.
test.describe.configure({ timeout: 120_000, retries: 1 });

test.beforeEach(async ({ page }) => {
  await signInAsStaff(page);
  await page.setViewportSize({ width: 360, height: 780 });
});

/** The words (runs of letters and digits) inside `scope` that the browser broke across two lines. */
async function splitWords(scope: Locator): Promise<string[]> {
  return scope.evaluateAll((elements) => {
    const split: string[] = [];
    for (const element of elements) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        for (const match of text.matchAll(/[\p{L}\p{N}]+/gu)) {
          const range = document.createRange();
          range.setStart(node, match.index ?? 0);
          range.setEnd(node, (match.index ?? 0) + match[0].length);
          const tops = new Set(Array.from(range.getClientRects()).map((rect) => Math.round(rect.top)));
          if (tops.size > 1) split.push(match[0]);
        }
      }
    }
    return split;
  });
}

async function expectBoxesAtLeast(locator: Locator, height: number): Promise<void> {
  const heights = await locator.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const value of heights) expect(value).toBeGreaterThanOrEqual(height);
}

test('S4 F4: the customer search field is wide enough to read at 360 px', async ({ page }) => {
  await page.goto('/staff/customers');
  const field = page.getByRole('searchbox', { name: 'Name, mobile or email' });
  await expect(field).toBeVisible();
  const box = await field.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(200);
  const button = page.getByRole('search', { name: 'Find a customer' }).getByRole('button', { name: 'Search' });
  expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalScroll(page);
});

test('S4 F5: the customer profile facts do not break a word mid-word', async ({ page }) => {
  await page.goto(`/staff/customers/${accountsFixtureIds.customerId}`);
  const facts = page.locator('dl').filter({ hasText: 'Registration channel' });
  await expect(facts).toBeVisible();
  expect(await splitWords(facts.locator('dd'))).toEqual([]);
  await expectNoHorizontalScroll(page);
});

test('S4 F7: the roster exception Cancel button is at least 44 px tall', async ({ page }) => {
  await page.goto(`/staff/admin/branches/${administrationFixtureIds.mainBranchId}/roster`);
  // The page lists only this week's exceptions and the seeded ones are in 2027, so add one for today first.
  const exceptions = page.getByRole('region', { name: 'Roster exceptions' });
  await exceptions.getByRole('combobox', { name: 'Staff member' }).selectOption({ label: 'Nadia Karim' });
  await exceptions.getByRole('textbox', { name: 'Reason' }).fill('Cover at the counter');
  await exceptions.getByRole('button', { name: 'Add exception' }).click();
  const cancels = exceptions.locator('li').getByRole('button', { name: 'Cancel', exact: true });
  await expect(cancels.first()).toBeVisible();
  await expectBoxesAtLeast(cancels, 44);
  await expectNoHorizontalScroll(page);
});

test('S2: the staff order panels keep names and addresses whole', async ({ page }) => {
  await page.goto(`/staff/orders/${orderingIds.orders.dispatchedCod}`);
  const panels = page.locator('section').filter({ has: page.getByRole('heading', { name: /^(Customer and fulfilment|Shipment)$/ }) });
  await expect(panels).toHaveCount(2);
  expect(await splitWords(panels.locator('dd'))).toEqual([]);
  await expectNoHorizontalScroll(page);
});

for (const width of [360, 1280]) {
  test(`S2: no dashboard money figure splits across lines at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await page.goto('/staff');
    const figures = page.locator('section[aria-labelledby^="tile-"] dd > span:first-child');
    await expect(figures.first()).toBeVisible();
    const lineCounts = await figures.evaluateAll((elements) => elements.map((element) => element.getClientRects().length));
    for (const count of lineCounts) expect(count).toBe(1);
    // A figure that cannot split must still stay inside its own tile.
    const outside = await figures.evaluateAll(
      (elements) =>
        elements.filter(
          (element) => element.getBoundingClientRect().right > element.closest('section')!.getBoundingClientRect().right + 1,
        ).length,
    );
    expect(outside).toBe(0);
    await expectNoHorizontalScroll(page);
  });
}

test('S2: the pick list sheet shows its Quantity and Orders columns at 360 px', async ({ page }) => {
  await page.goto('/staff/fulfilment/pick-list');
  const regions = page.getByRole('region', { name: /^Batches to pick from/ });
  await expect(regions.first()).toBeVisible();
  const clipped = await regions.evaluateAll((elements) => elements.map((element) => element.scrollWidth - element.clientWidth));
  for (const overflow of clipped) expect(overflow).toBeLessThanOrEqual(1);
  for (const name of ['Quantity', 'Orders']) {
    await expect(regions.first().getByRole('columnheader', { name })).toBeInViewport({ ratio: 1 });
  }
  await expectNoHorizontalScroll(page);
});

async function openProducts(page: Page): Promise<Locator> {
  await page.goto('/staff/shop/products');
  const table = page.getByRole('region', { name: 'Products (scrolls horizontally)' });
  await expect(table).toBeVisible();
  return table;
}

test('S3 F2: the Product column is readable at 360 px', async ({ page }) => {
  const table = await openProducts(page);
  const header = table.getByRole('columnheader', { name: 'Product' });
  expect((await header.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(180);
  await expectNoHorizontalScroll(page);
});

test('S3 F2: the Status column needs no sideways scroll at 1280 px', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const table = await openProducts(page);
  await expect(table.getByRole('columnheader', { name: 'Status' })).toBeInViewport({ ratio: 1 });
  const overflow = await table.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
