import type { Locator, Page, Request } from '@playwright/test';
import { test, expect as baseExpect, signInAsStaff } from './fixtures';
import { administrationFixtureIds as admin } from '../../mocks/handlers/admin';
import { inventoryFixtureIds as ids } from '../../mocks/handlers/inventory';
import { shopFixtureIds } from '../../mocks/handlers/shop';
import { dateIn, dialog, wedgeScan } from './inventory-helpers';
import { expectNoHorizontalScroll } from './reports-helpers';

/**
 * HO-P5 S3 TEST gate (G1-G9, TC-HO-P5-WIRING-S3). The integrator's required points, measured in a browser:
 * 44 px targets on S3's new controls, a receipt draft across a sidebar branch switch, after a refused post and a
 * refused discard, the history after post -> receipt, and 360 px overflow on the screens S3 changed.
 */
const expect = baseExpect.configure({ timeout: 20_000 });

const NEW_RECEIPT = '/staff/inventory/receipts/new';
const OATS = `/staff/shop/products/${shopFixtureIds.multiVariantProductId}`;

async function expectTarget(locator: Locator, name: string, opts: { width?: boolean } = {}) {
  await expect(locator, name).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${name} has a box`).not.toBeNull();
  expect(box!.height, `${name} is ${box!.height}px tall, below 44px`).toBeGreaterThanOrEqual(43.9);
  if (opts.width) expect(box!.width, `${name} is ${box!.width}px wide, below 44px`).toBeGreaterThanOrEqual(43.9);
}

/** The sidebar's outlet picker: in the aside from `sm` up, in the nav sheet below it (as admin-functional E-B2). */
async function switchOutlet(page: Page, branchId: string) {
  const width = page.viewportSize()?.width ?? 1280;
  if (width < 640) {
    await page.getByRole('button', { name: 'Expand menu' }).click();
    await page.getByRole('dialog').getByRole('combobox', { name: 'Outlet' }).selectOption(branchId);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } else {
    await page.locator('aside').getByRole('combobox', { name: 'Outlet' }).selectOption(branchId);
  }
}

const isDraftPut = (r: Request) => r.method() === 'PUT' && /\/goods-receipt-drafts\/[0-9a-f-]{36}$/.test(r.url());

/** A new direct receipt with one food line, autosaved, with `?draft=` in the address. Returns the address. */
async function startDraft(page: Page, lot: string): Promise<string> {
  await page.goto(NEW_RECEIPT);
  await page.getByLabel(/^direct/i).check();
  await wedgeScan(page, ids.foodBarcode);
  await expect(page.getByRole('listitem', { name: /line 1: organic rice 5 kg/i })).toBeVisible();
  await page.getByLabel(/^lot number/i).fill(lot);
  await page.getByLabel(/^accepted/i).fill('3');
  await expect(page.getByText(/^Draft saved at \d\d:\d\d/)).toBeVisible();
  await expect(page).toHaveURL(/draft=[0-9a-f-]{36}/, { timeout: 15_000 });
  return page.url();
}

test.beforeEach(async ({ page }) => {
  // The unsaved-changes guard may ask before a reload; accept it so a reload is a reload.
  page.on('dialog', (d) => void d.accept());
  await signInAsStaff(page);
});

test.describe('G1-G3: 44 px targets on the S3 controls (§7 UI-6)', () => {
  test('G1 products list: row checkbox area, select all, Publish, Hide from shop, Clear, Dismiss', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/staff/shop/products?status=Active');
    const boxes = page.getByRole('checkbox', { name: /^Select (?!all)/ });
    await expect(boxes.first()).toBeVisible();
    await expectTarget(boxes.first().locator('xpath=ancestor::label[1]'), 'row checkbox label', { width: true });
    await expectTarget(
      page.getByRole('checkbox', { name: /select all/i }).locator('xpath=ancestor::label[1]'),
      'select-all label',
    );
    await boxes.first().check();
    const bar = page.getByRole('region', { name: 'Bulk actions' });
    for (const name of ['Publish', 'Hide from shop', 'Clear']) {
      await expectTarget(bar.getByRole('button', { name, exact: true }), name);
    }
    // Publishing an Active product is refused per product: the result line (with Dismiss) appears, nothing changes.
    await bar.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('0 updated, 1 not updated')).toBeVisible();
    await expectTarget(page.getByRole('button', { name: 'Dismiss' }), 'Dismiss');
  });

  test('G2 product editor: district, Was price, certificate date, Remove file, View certificate', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(OATS);
    await expectTarget(page.getByLabel('District of origin'), 'District of origin');

    await page.goto(`${OATS}/variants`);
    await page.getByRole('button', { name: 'Prices for OAT-400G' }).click();
    await page.getByRole('button', { name: 'Schedule a new price' }).click();
    const schedule = page.getByRole('dialog', { name: 'Schedule a new price' });
    await expectTarget(schedule.getByLabel('Was price (optional)'), 'Was price');
    await page.keyboard.press('Escape');

    await page.goto(`${OATS}/food`);
    await expectTarget(page.getByLabel('Certificate valid until'), 'Certificate valid until');
    await expectTarget(page.getByRole('link', { name: /View certificate/ }), 'View certificate');
    await expectTarget(page.getByRole('button', { name: 'Remove file' }), 'Remove file');
  });

  test('G3 receiving: Receive into, Your drafts Continue and Discard', async ({ page }) => {
    test.setTimeout(120_000);
    await startDraft(page, 'L-G3');
    await page.goto(NEW_RECEIPT);
    await expectTarget(page.getByLabel('Receive into'), 'Receive into');
    const list = page.getByRole('list', { name: 'Your drafts' });
    await expectTarget(list.getByRole('button', { name: /^Continue the draft/ }).first(), 'Continue');
    await expectTarget(list.getByRole('button', { name: /^Discard the draft/ }).first(), 'Discard');
  });
});

test.describe('G4-G8: receipt drafts in a browser (BG-18)', () => {
  test('G4 a resumed draft keeps its field, its text and its own branch across a sidebar Outlet switch', async ({ page }) => {
    test.setTimeout(150_000);
    const draftUrl = await startDraft(page, 'L-G4');
    await page.goto(draftUrl);
    const lot = page.getByLabel(/^lot number/i);
    await expect(lot).toHaveValue('L-G4');
    await lot.evaluate((el) => ((el as unknown as { __gate: number }).__gate = 4));
    await lot.fill('L-G4-X');

    await switchOutlet(page, admin.londonBranchId);
    // Same element (not remounted), same text.
    await expect(page.getByLabel(/^lot number/i)).toHaveValue('L-G4-X');
    expect(await page.getByLabel(/^lot number/i).evaluate((el) => (el as unknown as { __gate?: number }).__gate)).toBe(4);

    const put = page.waitForRequest(isDraftPut, { timeout: 15_000 });
    await page.getByLabel(/^lot number/i).fill('L-G4-Y');
    await page.getByLabel(/^lot number/i).blur();
    const body = (await put).postDataJSON() as { branchId?: string | null; lines: Array<{ lotNumber: string | null }> };
    expect(body.branchId).toBe(admin.mainBranchId);
    await expect(page.getByText(/^Draft saved at \d\d:\d\d/)).toBeVisible();

    await page.goto(draftUrl);
    await expect(page.getByLabel(/^lot number/i)).toHaveValue('L-G4-Y');
  });

  test('G5 a fresh draft keeps the branch of its form across a sidebar Outlet switch', async ({ page }) => {
    test.setTimeout(150_000);
    await startDraft(page, 'L-G5');
    const select = page.getByLabel('Receive into');
    await expect(select).toHaveValue(admin.mainBranchId);
    await switchOutlet(page, admin.londonBranchId);
    await expect(page.getByLabel('Receive into')).toHaveValue(admin.mainBranchId);
    const put = page.waitForRequest(isDraftPut, { timeout: 15_000 });
    await page.getByLabel(/^lot number/i).fill('L-G5-B');
    await page.getByLabel(/^lot number/i).blur();
    expect(((await put).postDataJSON() as { branchId?: string | null }).branchId).toBe(admin.mainBranchId);
  });

  test('G6 after a post the server refuses, an edit is autosaved again and survives a reload', async ({ page }) => {
    test.setTimeout(150_000);
    const draftUrl = await startDraft(page, 'L-G6');
    // Past expiry: the browser does not check it, the server refuses it (BatchAlreadyExpired).
    await page.getByLabel(/^expiry date/i).fill(dateIn(-3));
    await page.getByLabel(/^unit cost/i).fill('450');
    await page.getByRole('button', { name: /review and post/i }).click();
    await (await dialog(page)).getByRole('button', { name: /post receipt/i }).click();
    await expect(page.getByText(/Expired goods cannot be accepted/).first()).toBeVisible();
    await expect(page).toHaveURL(/receipts\/new/);

    const put = page.waitForRequest(isDraftPut, { timeout: 15_000 });
    await page.getByLabel(/^lot number/i).fill('L-G6-AFTER');
    await page.getByLabel(/^lot number/i).blur();
    const body = (await put).postDataJSON() as { lines: Array<{ lotNumber: string | null }> };
    expect(body.lines[0]?.lotNumber).toBe('L-G6-AFTER');
    await expect(page.getByText(/^Draft saved at \d\d:\d\d/)).toBeVisible();

    await page.goto(draftUrl);
    await expect(page.getByLabel(/^lot number/i)).toHaveValue('L-G6-AFTER');
  });

  test('G7 after a discard the server refuses, an edit is autosaved again and survives a reload', async ({ page }) => {
    test.setTimeout(150_000);
    const draftUrl = await startDraft(page, 'L-G7');
    // The mock never refuses a discard of the caller's own open draft, so the browser's fetch answers this one DELETE
    // with a 503, as a server outage would.
    await page.evaluate(() => {
      const original = window.fetch.bind(window);
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (method === 'DELETE' && /goods-receipt-drafts\//.test(url)) {
          return Promise.resolve(
            new Response(JSON.stringify({ title: 'Service unavailable' }), {
              status: 503,
              headers: { 'Content-Type': 'application/problem+json' },
            }),
          );
        }
        return original(input, init);
      };
    });
    await page.getByRole('button', { name: 'Discard draft' }).click();
    const confirm = await dialog(page);
    await confirm.getByRole('button', { name: 'Discard draft' }).click();
    // Refused: the form is still there with its text (it did not start fresh).
    await expect(page.getByLabel(/^lot number/i)).toHaveValue('L-G7');
    if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape');

    const put = page.waitForRequest(isDraftPut, { timeout: 15_000 });
    await page.getByLabel(/^lot number/i).fill('L-G7-AFTER');
    await page.getByLabel(/^lot number/i).blur();
    const body = (await put).postDataJSON() as { lines: Array<{ lotNumber: string | null }> };
    expect(body.lines[0]?.lotNumber).toBe('L-G7-AFTER');

    await page.goto(draftUrl);
    await expect(page.getByLabel(/^lot number/i)).toHaveValue('L-G7-AFTER');
  });

  test('G8 post -> receipt: one Back reaches the receiving address, a second Back leaves the flow', async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto('/staff/inventory');
    await expect(page.getByRole('heading', { name: /inventory & batches/i })).toBeVisible();
    await startDraft(page, 'L-G8');
    await page.getByLabel(/^expiry date/i).fill(dateIn(150));
    await page.getByLabel(/^unit cost/i).fill('450');
    await page.getByRole('button', { name: /review and post/i }).click();
    await (await dialog(page)).getByRole('button', { name: /post receipt/i }).click();
    await expect(page.getByRole('heading', { name: /^GRN-/ })).toBeVisible({ timeout: 45_000 });
    const historyAtReceipt = await page.evaluate(() => history.length);

    await page.goBack();
    await expect(page).toHaveURL(/\/staff\/inventory\/receipts\/new/);
    // Recorded, not asserted: what the first Back shows (the slice report's Round 5 residual).
    const gone = page.getByText('That draft is no longer here');
    const firstBack = await gone
      .waitFor({ timeout: 10_000 })
      .then(() => 'no-longer-here')
      .catch(async () => `form (lot "${await page.getByLabel(/^lot number/i).inputValue().catch(() => 'none')}")`);
    test.info().annotations.push({ type: 'first-back', description: `${page.url()} shows ${firstBack}; history.length at receipt ${historyAtReceipt}` });

    await page.goBack();
    await expect(page).toHaveURL(/\/staff\/inventory$/);
  });
});

test.describe('G9: no sideways page scroll on the S3 screens', () => {
  test('products (bar open), food, variants (dialog open), stock, overview, receiving, filtered consignments', async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto('/staff/shop/products?status=Active');
    await page.getByRole('checkbox', { name: /^Select (?!all)/ }).first().check();
    await expect(page.getByRole('region', { name: 'Bulk actions' })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto(`${OATS}/food`);
    await expect(page.getByLabel('Certificate valid until')).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto(`${OATS}/variants`);
    await page.getByRole('button', { name: 'Prices for OAT-400G' }).click();
    await page.getByRole('button', { name: 'Schedule a new price' }).click();
    await expect(page.getByRole('dialog', { name: 'Schedule a new price' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.keyboard.press('Escape');

    await page.goto('/staff/inventory/stock');
    await expect(page.getByRole('columnheader', { name: 'Reorder at' })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto(`/staff/inventory/stock/${ids.foodSkuId}`);
    await expect(page.getByText('Supplier').first()).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto('/staff/inventory');
    await expect(page.getByRole('link', { name: /arriving in the next 7 days/ })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await startDraft(page, 'L-G9');
    await expectNoHorizontalScroll(page);

    await page.goto('/staff/procurement/consignments?arrivingWithinDays=7');
    await expect(page.getByText(/Showing consignments arriving in the next 7 days/)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
