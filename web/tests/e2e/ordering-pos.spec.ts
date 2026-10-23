import { test, expect as baseExpect, signInAsStaff } from './fixtures';
import { control } from './ordering-helpers';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000, retries: 1 });

/**
 * HO-ORD-002 §16 point-of-sale E-series on MSW. E-F1 measures the time of a counter sale driven from the
 * keyboard (NFR-USA-2 spirit: under 60 s). Barcodes are the shop mock's (`89` + the SKU's number,
 * 11 digits).
 */
const OATS_400 = '8900000000101';
const OATS_2KG = '8900000000102';
const JASMINE_RICE = '8900000000201';

async function start(page: import('@playwright/test').Page) {
  await page.goto('/staff/sign-in');
  await control(page, 'reset');
  await signInAsStaff(page);
  await page.goto('/staff/pos');
  await expect(page.getByRole('heading', { level: 1, name: 'Point of sale' })).toBeVisible();
}

async function scan(page: import('@playwright/test').Page, code: string) {
  await page.locator('#pos-scan').focus();
  await page.keyboard.type(code);
  await page.keyboard.press('Enter');
}

test.describe('point of sale (US-ORD-16)', () => {
  test('E-F1: three scanned items, a cash tender, the receipt — keyboard only, under 60 s', async ({ page }) => {
    await start(page);
    await page.getByLabel(/Customer name/).fill('Walk-in Buyer');
    await page.getByLabel(/Mobile number/).fill('01711112222');
    const began = Date.now();

    for (const code of [OATS_400, OATS_2KG, JASMINE_RICE]) await scan(page, code);
    const basket = page.getByRole('list', { name: 'Basket' });
    await expect(basket.getByRole('listitem')).toHaveCount(3);
    await expect(page.locator('#pos-scan-live')).toContainText(/Added .*quantity 1/);
    await expect(page.getByRole('region', { name: 'Sale total' })).toContainText('Total');

    await page.keyboard.press('F2');
    await expect(page.locator('#pos-tender-amount')).toBeFocused();
    await page.keyboard.type('5000');
    await page.keyboard.press('Enter');
    const review = page.getByRole('dialog');
    await expect(review.getByRole('button', { name: 'Complete sale' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: /Sale complete/ })).toBeVisible();
    await expect(page.getByText(/Change due:/)).toBeVisible();
    const printLink = page.getByRole('link', { name: 'Print receipt' });
    await expect(printLink).toBeFocused();
    await page.keyboard.press('Enter');
    const sheet = page.getByRole('article', { name: 'Receipt' });
    await expect(sheet).toContainText('Change');
    await expect(sheet.getByRole('row')).not.toHaveCount(0);
    expect(Date.now() - began).toBeLessThan(60_000);

    await page.getByRole('button', { name: 'Plain text' }).click();
    await expect(page.getByLabel('Receipt as plain text')).toBeVisible();
  });

  test('an unknown barcode is announced, the text stays in the field and a name search is offered', async ({ page }) => {
    await start(page);
    await scan(page, '1234567890123');
    await expect(page.locator('#pos-scan-live')).toContainText('No product has barcode 1234567890123');
    await expect(page.locator('#pos-scan')).toHaveValue('1234567890123');
    await expect(page.getByLabel('Product name or code')).toBeVisible();
  });

  test('typing slowly never looks anything up until Enter', async ({ page }) => {
    await start(page);
    await page.locator('#pos-scan').focus();
    let lookups = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/staff/pos/sku?')) lookups += 1;
    });
    await page.keyboard.type(OATS_400, { delay: 80 });
    await page.waitForTimeout(500);
    expect(lookups).toBe(0);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('list', { name: 'Basket' }).getByRole('listitem')).toHaveCount(1);
  });

  test('a double Enter on the review records one sale', async ({ page }) => {
    await start(page);
    await page.getByLabel(/Customer name/).fill('Walk-in Buyer');
    await page.getByLabel(/Mobile number/).fill('01711113333');
    await scan(page, JASMINE_RICE);
    await page.locator('#pos-tender-amount').fill('2000');
    await page.keyboard.press('Enter');
    let sales = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/staff/pos/sales')) sales += 1;
    });
    await page.getByRole('dialog').getByRole('button', { name: 'Complete sale' }).dblclick();
    await expect(page.getByRole('heading', { name: /Sale complete/ })).toBeVisible();
    expect(sales).toBe(1);
  });
});
