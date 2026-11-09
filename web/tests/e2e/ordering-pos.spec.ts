import { test, expect as baseExpect, signInAsStaff } from './fixtures';
import { control } from './ordering-helpers';
import { orderingIds } from '../../mocks/handlers/ordering/fixtures';

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
  await expect(page.getByRole('heading', { level: 1, name: 'Counter sale' })).toBeVisible();
}

/** HO-P4 S2: the buyer's name and mobile sit behind the ticket's customer chip. */
async function fillCustomer(page: import('@playwright/test').Page, mobile: string) {
  await page.getByRole('button', { name: 'Walk-in (no customer) · Add customer' }).click();
  await page.getByLabel(/Customer name/).fill('Walk-in Buyer');
  await page.getByLabel(/Mobile number/).fill(mobile);
}

async function scan(page: import('@playwright/test').Page, code: string) {
  await page.locator('#pos-scan').focus();
  await page.keyboard.type(code);
  await page.keyboard.press('Enter');
}

test.describe('point of sale (US-ORD-16)', () => {
  test('E-F1: three scanned items, a cash tender, the receipt — keyboard only, under 60 s', async ({ page }) => {
    await start(page);
    await fillCustomer(page, '01711112222');
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

  test('E9: browse a category, add a tile, see the change before completing, and complete a walk-in sale with no customer', async ({ page }) => {
    await start(page);
    // What the sale actually sends is the proof it is anonymous: the receipt cannot tell (it shows a name only for a known customer).
    const saleBodies: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/staff/pos/sales')) saleBodies.push(request.postData() ?? '');
    });
    const tabs = page.getByRole('tablist', { name: 'Item categories' });
    await expect(tabs.getByRole('tab').first()).toHaveText('All');
    await tabs.getByRole('tab', { name: 'Rice & grains' }).click();
    const grid = page.getByRole('list', { name: 'Rice & grains to sell' });
    await expect(grid).toBeVisible();
    await grid.getByRole('button', { name: /^Add Thai Jasmine Rice/ }).click();
    await expect(page.getByRole('list', { name: 'Basket' }).getByRole('listitem')).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Sale total' })).toContainText('780.00');

    // The change is the quote's answer for the cash typed, shown before the sale is completed.
    await page.getByLabel(/handed over/).fill('1000');
    await expect(page.getByRole('status').filter({ hasText: /Change due/ })).toContainText('220.00');
    await page.getByLabel(/handed over/).fill('500');
    await expect(page.getByRole('status').filter({ hasText: /Still to pay/ })).toContainText('280.00');

    // No customer: the chip says walk-in and the sale completes without a name or mobile.
    await expect(page.getByRole('button', { name: 'Walk-in (no customer) · Add customer' })).toBeVisible();
    await page.getByLabel(/handed over/).fill('1000');
    await page.getByRole('button', { name: 'Add payment' }).click();
    const complete = page.getByRole('button', { name: 'Complete sale' });
    await expect(complete).toBeEnabled();
    await complete.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Complete sale' }).click();
    await expect(page.getByRole('heading', { name: /Sale complete/ })).toBeVisible();
    await expect(page.getByText(/Change due:/)).toContainText('220.00');
    await page.getByRole('link', { name: 'Print receipt' }).click();
    const sheet = page.getByRole('article', { name: 'Receipt' });
    await expect(sheet).toContainText('Change');
    expect(saleBodies).toHaveLength(1);
    const sent = JSON.parse(saleBodies[0]!) as Record<string, unknown>;
    expect(Object.keys(sent)).not.toContain('customerName');
    expect(Object.keys(sent)).not.toContain('customerMobile');
  });

  // SECURITY (S2 gate): a sale started from a customer's profile ("New order") presets the buyer once. The real router
  // is the only place Back, a reload and a history entry can be tested.
  test.describe('preset buyer from /staff/pos?customerId= (real router)', () => {
    const PRESET = `/staff/pos?customerId=${orderingIds.customerId}`;
    const chip = (page: import('@playwright/test').Page) => page.getByRole('button', { name: new RegExp(`^${orderingIds.customerName}`) });
    const walkIn = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Walk-in (no customer) · Add customer' });

    function watchSales(page: import('@playwright/test').Page): Array<Record<string, unknown>> {
      const bodies: Array<Record<string, unknown>> = [];
      page.on('request', (request) => {
        if (request.method() === 'POST' && request.url().endsWith('/api/staff/pos/sales')) bodies.push(JSON.parse(request.postData() ?? '{}') as Record<string, unknown>);
      });
      return bodies;
    }
    async function payAndComplete(page: import('@playwright/test').Page) {
      await page.locator('#pos-tender-amount').fill('2000');
      await page.keyboard.press('Enter');
      await page.getByRole('dialog').getByRole('button', { name: 'Complete sale' }).click();
      await expect(page.getByRole('heading', { name: /Sale complete/ })).toBeVisible();
    }

    test('the address loses the customer once the chip shows them; after a sale, Print receipt then Back is a walk-in', async ({ page }) => {
      await start(page);
      const sales = watchSales(page);
      await page.goto(PRESET);
      await expect(chip(page)).toBeVisible();
      await expect(page).toHaveURL(/\/staff\/pos$/); // client state survived the replace: the chip is still there
      await expect(chip(page)).toBeVisible();
      await scan(page, JASMINE_RICE);
      await payAndComplete(page);
      expect(sales[0]).toMatchObject({ customerName: orderingIds.customerName });

      await page.getByRole('link', { name: 'Print receipt' }).click();
      await expect(page.getByRole('article', { name: 'Receipt' })).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(/\/staff\/pos$/);
      await expect(walkIn(page)).toBeVisible();
      await scan(page, OATS_400);
      await payAndComplete(page);
      expect(sales).toHaveLength(2);
      expect(Object.keys(sales[1]!)).not.toContain('customerName');
      expect(Object.keys(sales[1]!)).not.toContain('customerMobile');
    });

    test('a reload after the preset is a walk-in', async ({ page }) => {
      await start(page);
      const sales = watchSales(page);
      await page.goto(PRESET);
      await expect(chip(page)).toBeVisible();
      await expect(page).toHaveURL(/\/staff\/pos$/);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: 'Counter sale' })).toBeVisible();
      await expect(walkIn(page)).toBeVisible();
      await scan(page, OATS_400);
      await payAndComplete(page);
      expect(Object.keys(sales[0]!)).not.toContain('customerName');
      expect(Object.keys(sales[0]!)).not.toContain('customerMobile');
    });

    test('Void basket then the next sale is a walk-in', async ({ page }) => {
      await start(page);
      const sales = watchSales(page);
      await page.goto(PRESET);
      await expect(chip(page)).toBeVisible();
      await scan(page, JASMINE_RICE);
      await expect(page.getByRole('list', { name: 'Basket' }).getByRole('listitem')).toHaveCount(1);
      await page.getByRole('button', { name: 'Void basket' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Void basket' }).click();
      await expect(walkIn(page)).toBeVisible();
      await expect(page).toHaveURL(/\/staff\/pos$/);
      await scan(page, OATS_400);
      await payAndComplete(page);
      expect(Object.keys(sales[0]!)).not.toContain('customerName');
      expect(Object.keys(sales[0]!)).not.toContain('customerMobile');
    });
  });

  test('only a name or only a mobile blocks the sale with the both-or-neither message', async ({ page }) => {
    await start(page);
    await scan(page, JASMINE_RICE);
    await page.getByRole('button', { name: 'Walk-in (no customer) · Add customer' }).click();
    await page.getByLabel(/Customer name/).fill('Rana');
    await page.locator('#pos-tender-amount').fill('1000');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Enter both the name and the mobile number, or neither.')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
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
    await fillCustomer(page, '01711113333');
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
