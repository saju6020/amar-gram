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
  // The label is visually hidden, so the placeholder is the only visible prompt: it must fit whole.
  const fit = await field.evaluate((input: HTMLInputElement) => {
    const style = getComputedStyle(input);
    const context = document.createElement('canvas').getContext('2d')!;
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const inner = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    // A search input keeps room for the browser's clear (x) button even while empty, which cut the placeholder
    // in acceptance run 2; that button must be gone while the field is empty for the padding box to be the text's.
    // getComputedStyle does not apply :placeholder-shown to this pseudo-element, so look for an author rule that
    // hides the button and whose element part matches this (empty) input.
    const pseudo = '::-webkit-search-cancel-button';
    const hidesCancel = Array.from(document.styleSheets).some((sheet) => {
      const visit = (rules: CSSRuleList): boolean =>
        Array.from(rules).some((rule) => {
          if ('cssRules' in rule && !(rule instanceof CSSStyleRule)) return visit((rule as CSSGroupingRule).cssRules);
          if (!(rule instanceof CSSStyleRule) || rule.style.display !== 'none') return false;
          return rule.selectorText
            .split(',')
            .map((selector) => selector.trim())
            .some((selector) => selector.endsWith(pseudo) && input.matches(selector.slice(0, -pseudo.length)));
        });
      try {
        return visit(sheet.cssRules);
      } catch {
        return false;
      }
    });
    return { text: context.measureText(input.placeholder).width, inner, hidesCancel, empty: input.value === '' };
  });
  expect(fit.empty).toBe(true);
  expect(fit.hidesCancel).toBe(true);
  expect(fit.text, JSON.stringify(fit)).toBeLessThanOrEqual(fit.inner);
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
    // Count the text's line boxes (distinct line tops of a Range over it), not the span's own boxes:
    // the span is a flex item, so it always reports a single box however its text wraps.
    const lineCounts = await figures.evaluateAll((elements) =>
      elements.map((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size;
      }),
    );
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

// ---- TEST gate additions (closing the ARCHITECTURE / CODE_REVIEW LOW notes) ----

const SHOTS = 'docs/gates/screenshots/p5-followup-layout';

test('S4 F4: the customer search field stays one input tall at 360 px', async ({ page }) => {
  await page.goto('/staff/customers');
  const field = page.getByRole('searchbox', { name: 'Name, mobile or email' });
  await expect(field).toBeVisible();
  const height = (await field.boundingBox())?.height ?? 0;
  // A single text input is 44 px with its padding; a field that grew with its column would be far taller.
  expect(height).toBeGreaterThan(30);
  expect(height).toBeLessThanOrEqual(56);
});

for (const width of [360, 768, 1024, 1280, 1440]) {
  test(`S2: dashboard figures stay in their tile and clear each other at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/staff');
    const figures = page.locator('section[aria-labelledby^="tile-"] dd > span:first-child');
    await expect(figures.first()).toBeVisible();
    // The rider-cash tile carries the longest money figure; it must be one of the figures measured.
    await expect(page.locator('section[aria-labelledby^="tile-"]').filter({ hasText: /rider/i }).first()).toBeVisible();
    const report = await figures.evaluateAll((elements) => {
      const rects = elements.map((element) => ({
        text: element.textContent ?? '',
        tile: element.closest('section')!,
        rect: element.getBoundingClientRect(),
      }));
      const outside = rects.filter((r) => r.rect.right > r.tile.getBoundingClientRect().right + 1).map((r) => r.text);
      const overlaps: string[] = [];
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          const a = rects[i]!.rect;
          const b = rects[j]!.rect;
          if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) {
            overlaps.push(`${rects[i]!.text} / ${rects[j]!.text}`);
          }
        }
      }
      return { count: rects.length, outside, overlaps };
    });
    expect(report.count).toBeGreaterThan(5);
    expect(report.outside).toEqual([]);
    expect(report.overlaps).toEqual([]);
    await expectNoHorizontalScroll(page);
    if (width === 768 || width === 1024 || width === 1440) {
      await page.screenshot({ path: `../${SHOTS}/dashboard-${width}.png`, fullPage: true });
    }
  });
}

test('S2: at 360 px the pick list shows "Expires" inline under the batch and hides the Expires column', async ({ page }) => {
  await page.goto('/staff/fulfilment/pick-list');
  const region = page.getByRole('region', { name: /^Batches to pick from/ }).first();
  await expect(region).toBeVisible();
  await expect(region.getByText(/^Expires /).first()).toBeVisible();
  await expect(region.getByRole('columnheader', { name: 'Expires' })).toBeHidden();
  // The inline label and date must not split a word (acceptance found "Expire / s").
  expect(await splitWords(region.locator('tbody td'))).toEqual([]);
});

test('S2: the printed pick list still shows the Expires column', async ({ page }) => {
  await page.setViewportSize({ width: 794, height: 1123 }); // A4 at 96 dpi
  await page.goto('/staff/fulfilment/pick-list');
  const region = page.getByRole('region', { name: /^Batches to pick from/ }).first();
  await expect(region).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(region.getByRole('columnheader', { name: 'Expires' })).toBeVisible();
  const dateCell = region.locator('tbody tr').first().locator('td').nth(2);
  expect(await dateCell.evaluate((el) => getComputedStyle(el).display)).toBe('table-cell');
  expect((await dateCell.innerText()).trim().length).toBeGreaterThan(0);
  // The inline mobile copy is not printed on top of the column.
  expect(await region.getByText(/^Expires /).first().isHidden()).toBe(true);
});

test('S2: pick list at 1280 px (screenshot for acceptance)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/staff/fulfilment/pick-list');
  await expect(page.getByRole('region', { name: /^Batches to pick from/ }).first()).toBeVisible();
  await page.screenshot({ path: `../${SHOTS}/pick-list-1280.png`, fullPage: true });
});
