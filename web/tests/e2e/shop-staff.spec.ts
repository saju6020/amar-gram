import AxeBuilder from '@axe-core/playwright';
import { shopFixtureIds } from '../../mocks/handlers/shop';
import { test, expect as baseExpect, signInAsStaff } from './fixtures';

// The first visit to each back-office route compiles it in `next dev`: allow for that.
const expect = baseExpect.configure({ timeout: 20_000 });

/**
 * HO-SHP-002 §16 E-C1, E-C2, E-C3, E-F1 (staff half) — run against MSW. In mock mode the browser
 * worker and the server-rendering `msw/node` hold SEPARATE in-memory databases, so a change staff
 * make in the browser is not visible to a server-rendered storefront page; the "visible in the shop"
 * halves are therefore recorded as real-API cases in TC-HO-SHP-002 (not runnable here).
 */

test.describe('catalogue back office (US-SHP-01…03)', () => {
  test('E-C1: create a food product, add a SKU and price, publish without origin (refused), add origin and labelling, publish', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signInAsStaff(page);
    const stamp = Date.now().toString().slice(-6);
    const name = `E2E Thai Rice ${stamp}`;
    const slug = `e2e-thai-rice-${stamp}`;

    await page.goto('/staff/shop/products/new');
    // A cold dev server can lose the mock worker's start race: the page then offers a retry.
    const heading = page.getByRole('heading', { level: 1, name: 'New product' });
    const retry = page.getByRole('button', { name: 'Try again' });
    await expect(heading.or(retry)).toBeVisible();
    if (await retry.isVisible()) await retry.click();
    await expect(heading).toBeVisible();
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Producer').fill('E2E Brand');
    await page.getByLabel('Category').selectOption('RiceAndGrains');
    await page.getByLabel('Tax class').selectOption({ label: 'Standard' });
    await expect(page.getByLabel(/Web address/)).toHaveValue(slug);
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();

    // A SKU and its price.
    const editorUrl = page.url();
    await page.goto(`${editorUrl}/variants`);
    await page.getByRole('button', { name: 'Add pack size' }).click();
    const addDialog = page.getByRole('dialog', { name: 'Add SKU' });
    await addDialog.getByLabel('SKU code').fill(`E2E-${stamp}`);
    await addDialog.getByLabel('Size or weight').fill('1 kg');
    await addDialog.getByLabel(/Shipping weight/).fill('500');
    await addDialog.getByRole('button', { name: 'Add SKU' }).click();
    await expect(page.getByRole('rowheader', { name: new RegExp(`E2E-${stamp}`) })).toBeVisible();
    // HO-SHP-001-FU3: the weight shows, is prefilled on Edit and survives a save (not cleared).
    await expect(page.getByRole('cell', { name: '500 g' })).toBeVisible();
    await page.getByRole('button', { name: `Edit E2E-${stamp}` }).click();
    const editDialog = page.getByRole('dialog', { name: `Edit SKU E2E-${stamp}` });
    await expect(editDialog.getByLabel(/Shipping weight/)).toHaveValue('500');
    await editDialog.getByRole('button', { name: 'Save SKU' }).click();
    await expect(editDialog).toBeHidden();
    await expect(page.getByRole('cell', { name: '500 g' })).toBeVisible();
    await page.getByRole('button', { name: `Prices for E2E-${stamp}` }).click();
    await page.getByRole('button', { name: 'Schedule a new price' }).click();
    const priceDialog = page.getByRole('dialog', { name: 'Schedule a new price' });
    await priceDialog.getByLabel('Amount (BDT)').fill('1200');
    await priceDialog.getByRole('button', { name: 'Schedule', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Current' })).toContainText('৳1,200.00');

    // Publish without a country of origin: refused, naming it; the checklist takes focus.
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Publish this product?' })
      .getByRole('button', { name: 'Publish' })
      .click();
    await expect(page.getByRole('alert').filter({ hasText: /country of origin/i })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Publish checklist' })).toBeFocused();
    await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();

    // Add the country on the Details section, then publish.
    await page.goto(editorUrl);
    await page.getByLabel('Country of origin').selectOption('TH');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('list', { name: 'Publish checklist' })).toContainText(
      'Done: Country of origin is set.',
    );

    // A food product also needs its labelling before it can be published (HO-P2 §1.3): the
    // checklist still blocks on the ingredient list until the Food & labelling section is saved.
    await expect(page.getByRole('list', { name: 'Publish checklist' })).toContainText('Blocking:');
    await page.goto(`${editorUrl}/food`);
    await page.getByLabel('Ingredient list').fill('Thai jasmine rice');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('list', { name: 'Publish checklist' })).not.toContainText(
      'Blocking:',
    );
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Publish this product?' })
      .getByRole('button', { name: 'Publish' })
      .click();
    await expect(page.getByText('Active (in the shop)')).toBeVisible();

    // The staff list shows it as Active; a draft's public URL is a not-found page.
    await page.goto(`/staff/shop/products?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText('Active');
    // `(shop)/loading.tsx` makes the route stream, and a `notFound()` after the first flush cannot
    // change the HTTP status (it stays 200 for any unknown slug, not only a draft). Next marks such
    // a response `noindex` and renders the shop's not-found page, so that is what is asserted.
    await page.goto(`/shop/products/${shopFixtureIds.draftSlug}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('E-C2: a price scheduled for tomorrow is listed under Scheduled; the storefront still shows today’s', async ({
    page,
  }) => {
    await signInAsStaff(page);
    await page.goto(`/staff/shop/products/${shopFixtureIds.multiVariantProductId}/variants`);
    await page.getByRole('button', { name: 'Prices for OAT-400G' }).click();
    await page.getByRole('button', { name: 'Schedule a new price' }).click();
    const dialog = page.getByRole('dialog', { name: 'Schedule a new price' });
    await dialog.getByLabel('Amount (BDT)').fill('700');
    await dialog.getByRole('radio', { name: /future date/i }).check();
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    await dialog
      .getByLabel('Effective date and time')
      .fill(
        `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T10:00`,
      );
    await dialog.getByRole('button', { name: 'Schedule', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Scheduled' })).toContainText('৳700.00');
    await expect(page.getByRole('region', { name: 'Current' })).toContainText('৳650.00');

    await page.goto(`/shop/products/${shopFixtureIds.multiVariantSlug}`);
    await expect(
      page.getByRole('region', { name: 'Price and availability' }).getByText('৳650.00'),
    ).toBeVisible();
  });

  test('E-C3: moderating a pending review publishes it, and it appears on the product page', async ({
    page,
  }) => {
    await signInAsStaff(page);
    await page.goto('/staff/shop/reviews');
    const card = page.getByRole('article').filter({ hasText: 'Wish the bag was bigger.' });
    await expect(card).toContainText('Awaiting approval');
    await card.getByRole('button', { name: /Publish review of/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(card).toContainText('Published');

    await page.goto(`/shop/products/${shopFixtureIds.multiVariantSlug}`);
    await expect(page.getByText('Wish the bag was bigger.')).toBeVisible();
    // Review text from customers is shown literally (plain text).
    await expect(page.getByText('Good, but pricey')).toBeVisible();
    await expect(page.getByText(/<b>Not<\/b> cheap though \*\*really\*\*/)).toBeVisible();
  });

  test('E-C3: a rejected review needs a reason', async ({ page }) => {
    await signInAsStaff(page);
    await page.goto('/staff/shop/reviews');
    const pending = page.getByRole('article').filter({ hasText: 'Lovely aroma' });
    await pending.getByRole('button', { name: /Reject review of/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Reject this review?' });
    await dialog.getByRole('button', { name: 'Reject review' }).click();
    await expect(dialog.getByText('Choose a reason for rejecting this review.')).toBeVisible();
    await dialog.getByLabel('Reason').selectOption('Spam');
    await dialog.getByRole('button', { name: 'Reject review' }).click();
    await expect(pending).toContainText('Rejected');
  });
});

test.describe('content languages (US-SHP-14)', () => {
  test('E-F1: switch to bn on a product (English fallback where missing); staff edits the bn ingredient list', async ({
    page,
  }) => {
    await page.goto(`/shop/products/${shopFixtureIds.thaiRiceSlug}`);
    await page.getByLabel('Product language').selectOption('bn');
    await expect(page).toHaveURL(/lang=bn/);
    await expect(page.getByRole('heading', { level: 1, name: 'থাই জেসমিন চাল' })).toBeVisible();
    await page.getByRole('tab', { name: 'Ingredients & certification' }).click();
    const ingredients = page.getByRole('tabpanel', { name: 'Ingredients & certification' });
    await expect(ingredients).toContainText('জেসমিন চাল');
    await expect(ingredients.locator('[lang="bn"]')).not.toHaveCount(0);

    await page.goto('/staff/sign-in');
    await signInAsStaff(page);
    await page.goto(`/staff/shop/products/${shopFixtureIds.thaiRiceProductId}/translations`);
    await expect(page.getByRole('heading', { name: /Bangla \(bn\)/ })).toBeVisible();
    await page.getByLabel('Ingredient list', { exact: true }).fill('জেসমিন চাল, লবণ');
    await page.getByRole('button', { name: 'Save Bangla' }).click();
    await page.reload();
    await expect(page.getByLabel('Ingredient list', { exact: true })).toHaveValue(
      /জেসমিন চাল, লবণ/,
    );
  });
});

test.describe('origins (US-SHP-05, staff)', () => {
  test('staff add and edit a sourcing origin', async ({ page }) => {
    await signInAsStaff(page);
    await page.goto('/staff/shop/origins');
    await expect(page.getByRole('heading', { level: 1, name: 'Sourcing origins' })).toBeVisible();
    await page.getByRole('button', { name: 'Add origin' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add an origin' });
    await dialog.getByLabel('Country').selectOption('JP');
    await dialog
      .getByLabel('Sourcing notes', { exact: true })
      .fill('Small-batch **tofu** and miso.');
    await expect(dialog.getByLabel('Sourcing notes preview').locator('strong')).toHaveText('tofu');
    await dialog.getByRole('button', { name: 'Save origin' }).click();
    await expect(page.getByRole('rowheader', { name: 'Japan' })).toBeVisible();
  });
});

/**
 * HO-P5 S3 (E10) -- the products list columns and bulk bar (BG-9, BG-10), the district and "Was" price (BG-12, BG-13) and the
 * organic certificate (BG-14), run against MSW. Staff-only data: nothing here is read by the shop.
 */
test.describe('HO-P5 S3: catalogue back office wiring (E10)', () => {
  test('select two products, Hide from shop, read the server result line; a Draft in the batch is listed as not updated', async ({
    page,
  }) => {
    await signInAsStaff(page);
    await page.goto('/staff/shop/products?status=Active');
    await expect(page.getByRole('columnheader', { name: 'Origin' })).toBeVisible();
    for (const header of ['Pack sizes', 'Price', 'Stock']) {
      await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
    }
    const boxes = page.getByRole('checkbox', { name: /^Select (?!all)/ });
    await expect(boxes.first()).toBeVisible();
    const first = (await boxes.nth(0).getAttribute('aria-label'))!.replace(/^Select /, '');
    const second = (await boxes.nth(1).getAttribute('aria-label'))!.replace(/^Select /, '');
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    const bar = page.getByRole('region', { name: 'Bulk actions' });
    await expect(bar).toContainText('2 selected');

    // 360 px and axe with the bar open: the table scrolls inside its own region, the page does not.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

    await bar.getByRole('button', { name: 'Hide from shop' }).click();
    const confirm = page.getByRole('dialog', { name: 'Hide 2 products from the shop?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Hide from shop' }).click();
    await expect(page.getByText('2 updated, 0 not updated')).toBeVisible();
    await expect(bar).toBeHidden(); // the selection cleared after the action
    // The list refetched: both are Draft now, so they left the Active list.
    await expect(page.getByRole('link', { name: first, exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: second, exact: true })).toHaveCount(0);

    // A Draft cannot be hidden: the server's per-product message is listed with the product's name.
    await page.goto('/staff/shop/products?status=Draft');
    const draftBox = page.getByRole('checkbox', { name: /^Select (?!all)/ }).first();
    const draftName = (await draftBox.getAttribute('aria-label'))!.replace(/^Select /, '');
    await draftBox.check();
    await page
      .getByRole('region', { name: 'Bulk actions' })
      .getByRole('button', { name: 'Hide from shop' })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: 'Hide from shop' }).click();
    await expect(page.getByText('0 updated, 1 not updated')).toBeVisible();
    await expect(page.getByText(`${draftName}: Cannot unpublish from Draft.`)).toBeVisible();
  });

  test('set a district and a "Was" price; a Was price that is not higher is refused under its field', async ({
    page,
  }) => {
    await signInAsStaff(page);
    const base = `/staff/shop/products/${shopFixtureIds.multiVariantProductId}`;
    await page.goto(`${base}/variants`);
    await expect(page.getByRole('columnheader', { name: 'Was' })).toBeVisible();
    // The seed: the 2 kg pack has a Was price of ৳2,800.00 and a scheduled one.
    await expect(page.getByRole('row', { name: /OAT-2KG/ })).toContainText('৳2,800.00');
    await expect(page.getByRole('row', { name: /OAT-2KG/ })).toContainText('then ৳3,000.00');

    await page.getByRole('button', { name: 'Prices for OAT-400G' }).click();
    await page.getByRole('button', { name: 'Schedule a new price' }).click();
    const dialog = page.getByRole('dialog', { name: 'Schedule a new price' });
    await dialog.getByLabel('Amount (BDT)').fill('700');
    await dialog.getByLabel('Was price (optional)').fill('700');
    await dialog.getByRole('button', { name: 'Schedule', exact: true }).click();
    await expect(
      dialog.getByText('The compare-at price must be greater than the price.'),
    ).toBeVisible();
    await expect(dialog.getByLabel('Was price (optional)')).toHaveAttribute('aria-invalid', 'true');
    await dialog.getByLabel('Was price (optional)').fill('800');
    await dialog.getByRole('button', { name: 'Schedule', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Current' })).toContainText('৳700.00');
    await expect(page.getByRole('row', { name: /OAT-400G/ })).toContainText('৳800.00');

    await page.goto(base);
    const district = page.getByLabel('District of origin');
    await expect(district).toHaveValue('Dinajpur');
    await district.fill('Bogura');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
    await page.reload();
    await expect(page.getByLabel('District of origin')).toHaveValue('Bogura');
  });

  test('an expired organic certificate blocks publishing with the message; renewing it lets it through', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signInAsStaff(page);
    await page.goto(`/staff/shop/products?q=${encodeURIComponent('Pure Mustard Oil')}`);
    await page.getByRole('link', { name: 'Pure Mustard Oil', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pure Mustard Oil' })).toBeVisible();
    const editorUrl = page.url();

    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Unpublish this product?' })
      .getByRole('button', { name: 'Unpublish' })
      .click();
    await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Publish this product?' })
      .getByRole('button', { name: 'Publish' })
      .click();
    await expect(
      page.getByRole('alert').filter({
        hasText:
          'The organic certificate has expired. Update it on Food & labelling before publishing.',
      }),
    ).toBeVisible();

    // The server says it has expired: the pill is there, and renewing the date clears it.
    // (Below 768 px the sections are a select, not tabs, so go to the section by its address.)
    await page.goto(`${editorUrl}/food`);
    await expect(page.getByText('Expired', { exact: true })).toBeVisible();
    await page.getByLabel('Certificate valid until').fill('2031-01-01');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Expired', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Publish this product?' })
      .getByRole('button', { name: 'Publish' })
      .click();
    await expect(page.getByText('Active (in the shop)')).toBeVisible();
  });
});
