import { test, expect as baseExpect, signInAsCustomer } from './fixtures';
import { addAddress, control, ids } from './ordering-helpers';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000, retries: 1 });

/**
 * HO-ORD-002 §16 customer E-series on MSW: the cart (E-A), checkout (E-B), bank transfer (E-C) and
 * cancel (E-D1). E-A2 and E-B7 need server state shared between browser contexts, which a
 * per-tab mock cannot provide — they are recorded NOT RUN (TC-HO-ORD-002). Staff-side flows are in
 * `ordering-staff.spec.ts`.
 */

const oats = `/shop/products/${ids.multiVariantSlug}?sku=${ids.skuOats2kg}`;
const rice = `/shop/products/${ids.thaiRiceSlug}`;

async function resetMock(page: import('@playwright/test').Page) {
  await page.goto('/sign-in');
  await control(page, 'reset');
}

async function addFromProduct(page: import('@playwright/test').Page, path: string, name: RegExp) {
  await page.goto(path);
  await page.getByRole('button', { name: /Add to (cart|basket)/ }).click();
  await expect(page.getByRole('status').filter({ hasText: name })).toBeVisible();
}

async function startCheckoutDelivery(page: import('@playwright/test').Page) {
  await addAddress(page);
  await page.goto('/checkout');
  await expect(
    page.getByRole('heading', { level: 1, name: /^Checkout$/ }),
  ).toBeVisible();
}

test.describe('cart (US-ORD-01)', () => {
  test('E-A1: a guest adds two items, signs in and finds them merged with a notice, no duplicates', async ({
    page,
  }) => {
    await resetMock(page);
    await addFromProduct(page, oats, /Added 1 × 2 kg to your basket/);
    await addFromProduct(page, rice, /Added 1 ×/);

    await signInAsCustomer(page);
    await page.goto('/cart');
    await expect(page.getByRole('heading', { level: 1, name: 'Your basket' })).toBeVisible();
    await expect(
      page.getByText(/We.ve added the items from your basket before you signed in./),
    ).toBeVisible();
    const items = page.getByRole('region', { name: 'Items in your basket' }).getByRole('listitem');
    await expect(items).toHaveCount(2);

    // Adding the same item again raises its quantity; it does not create a second line.
    await page.goto(oats);
    await page.getByRole('button', { name: /Add to (cart|basket)/ }).click();
    await expect(
      page.getByRole('status').filter({ hasText: /Added 1 × 2 kg to your basket/ }),
    ).toBeVisible();
    await page.goto('/cart');
    await expect(items).toHaveCount(2);
    await expect(
      page.getByRole('spinbutton', { name: /Quantity of Organic Rolled Oats/ }),
    ).toHaveValue('2');
  });

  test('basket: remove offers an Undo, and Checkout while signed out goes to sign-in with ?next', async ({
    page,
  }) => {
    await resetMock(page);
    await addFromProduct(page, oats, /Added 1 × 2 kg to your basket/);
    await page.goto('/cart');
    await page
      .getByRole('button', { name: /Remove Organic Rolled Oats/ })
      .first()
      .click();
    await expect(
      page.getByText(/Removed Organic Rolled Oats .* from your basket./).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(
      page.getByRole('spinbutton', { name: /Quantity of Organic Rolled Oats/ }),
    ).toHaveValue('1');
    await page.getByRole('link', { name: /Sign in to check out/ }).click();
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fcheckout/);
  });
});

test.describe('checkout (US-ORD-02 to US-ORD-08)', () => {
  test('E-B1/E-B8: COD delivery order is placed once, even on a double click', async ({ page }) => {
    await resetMock(page);
    await signInAsCustomer(page);
    await addFromProduct(page, oats, /Added 1 × 2 kg to your basket/);
    await startCheckoutDelivery(page);

    // Section 1: delivery to the saved address.
    await expect(page.getByLabel('Home')).toBeChecked();
    // Section 2: service level and a time window, in branch time.
    await expect(page.getByRole('radio', { name: /Standard delivery/ })).toBeChecked();
    await page.getByRole('radiogroup', { name: 'Time window' }).getByRole('radio').first().click();
    // Section 3: payment — three options, no card.
    await page.getByRole('radio', { name: /Cash on delivery/ }).click();
    await expect(page.getByRole('radio', { name: /Pay when you collect/ })).toBeDisabled();
    await expect(page.locator('input[autocomplete^="cc-"]')).toHaveCount(0);
    // Aside: the six server rows, then place with a double click.
    const summary = page.getByRole('region', { name: 'Order summary' });
    for (const row of [
      'Items subtotal',
      'Item discounts',
      'Order discount',
      'Delivery (Standard)',
      'Tax',
      'Total',
    ]) {
      await expect(summary.getByText(row, { exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Place order' }).dblclick();
    await expect(page).toHaveURL(/\/portal\/orders\/[0-9a-f-]{36}\?placed=1/);

    await page.goto('/portal/orders');
    // Seeded orders are Sam's too; exactly one new order was created (numbers from ORD-2026-000200).
    await expect(page.getByRole('link', { name: /ORD-2026-000200/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /ORD-2026-000201/ })).toHaveCount(0);
  });

  test('E-B2: a price change is listed and must be acknowledged before placing', async ({
    page,
  }) => {
    await resetMock(page);
    await signInAsCustomer(page);
    await addFromProduct(page, oats, /Added 1 × 2 kg to your basket/);
    await control(page, 'setPrice', ids.skuOats2kg, '3000.00');
    await startCheckoutDelivery(page);
    await page.getByRole('radiogroup', { name: 'Time window' }).getByRole('radio').first().click();
    await page.getByRole('radio', { name: /Cash on delivery/ }).click();

    const panel = page.getByRole('region', { name: 'What changed since you added these items' });
    await expect(panel.getByText(/The price of 'Organic Rolled Oats' has increased/)).toBeVisible();
    const place = page.getByRole('button', { name: 'Place order' });
    await expect(place).toBeDisabled();
    await panel.getByLabel(/I.ve reviewed these changes./).click();
    await expect(place).toBeEnabled();
    await place.click();
    await expect(page).toHaveURL(/\/portal\/orders\/[0-9a-f-]{36}\?placed=1/);
  });

  test('E-B3: an address outside every zone offers collection instead, and pickup completes', async ({
    page,
  }) => {
    await resetMock(page);
    await signInAsCustomer(page);
    await addFromProduct(page, oats, /Added 1 × 2 kg to your basket/);
    await addAddress(page, { label: 'Gazipur home', district: 'Gazipur', postalCode: '1700' });
    await page.goto('/checkout');
    await expect(
      page.getByText(/We don.t deliver to Gazipur yet. You can collect your order instead./),
    ).toBeVisible();
    await expect(page.getByRole('radio', { name: /Collect from a branch/ })).toBeChecked();
    await expect(page.getByRole('radio', { name: /Amar Gram Dhanmondi/ })).toBeChecked();
    // Delivery time is not needed for collection.
    await page.getByRole('radio', { name: /Pay when you collect/ }).click();
    await expect(page.getByRole('radio', { name: /Cash on delivery/ })).toBeDisabled();
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page).toHaveURL(/\/portal\/orders\/[0-9a-f-]{36}\?placed=1/);
  });

  // HO-P5 S1 (E5): the optional note for the rider.
  test('G4: a delivery COD order with a rider note shows it on the order; Pickup hides the field and keeps the note out of the URL', async ({
    page,
  }) => {
    await resetMock(page);
    await signInAsCustomer(page);
    await addFromProduct(page, oats, /Added 1 × 2 kg to your basket/);
    await startCheckoutDelivery(page);

    const note = page.getByLabel('Note for the rider (optional)');
    await expect(note).toHaveAttribute('maxlength', '300');
    await note.fill('Please call before you come up <b>twice</b>');
    await expect(page.getByText('43 of 300')).toBeVisible();
    // Free text a customer may fill with personal details: never in the address bar.
    expect(page.url()).not.toContain('call');

    // Collecting instead: the field goes away.
    await page.getByRole('radio', { name: /Collect from a branch/ }).click();
    await expect(note).toHaveCount(0);
    await page.getByRole('radio', { name: /Delivery/ }).first().click();
    await expect(note).toBeVisible();

    await page.getByRole('radiogroup', { name: 'Time window' }).getByRole('radio').first().click();
    await page.getByRole('radio', { name: /Cash on delivery/ }).click();
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page).toHaveURL(/\/portal\/orders\/[0-9a-f-]{36}\?placed=1/);

    const delivering = page.getByRole('region', { name: 'Delivering to' });
    await expect(delivering.getByText('Note for the rider')).toBeVisible();
    // Plain text: the markup is shown, not applied.
    await expect(delivering).toContainText('Please call before you come up <b>twice</b>');
    expect(page.url()).not.toContain('call');
  });

  test('E-B4/E-C1: COD is disabled above the ceiling with its reason; bank transfer shows instructions', async ({
    page,
  }) => {
    await resetMock(page);
    await signInAsCustomer(page);
    // 4 × BDT 2,450 is above the BDT 5,000 COD ceiling.
    await page.goto(oats);
    await page.getByLabel('Quantity').fill('4');
    await page.getByRole('button', { name: /Add to (cart|basket)/ }).click();
    await expect(page.getByRole('status').filter({ hasText: /Added 4 ×/ })).toBeVisible();
    await startCheckoutDelivery(page);
    await page.getByRole('radiogroup', { name: 'Time window' }).getByRole('radio').first().click();
    const cod = page.getByRole('radio', { name: /Cash on delivery/ });
    await expect(cod).toBeDisabled();
    await expect(
      page.getByText(/Cash on delivery is available for orders up to BDT 5,000\.00/),
    ).toBeVisible();
    await page.getByRole('radio', { name: /Bank transfer/ }).click();
    await page.getByRole('button', { name: 'Place order' }).click();

    await expect(page.getByRole('heading', { name: 'Pay by bank transfer' })).toBeVisible();
    await expect(page.getByText(/^ORD-2026-\d+$/).first()).toBeVisible();
    await expect(page.getByRole('timer')).toContainText('Time left');
    await expect(page.getByRole('button', { name: 'Copy account number' })).toBeVisible();
    await page.getByRole('button', { name: 'I’ve made the transfer' }).click();
    await page.getByLabel('Your bank’s reference').fill('TRF-77-A');
    await page.getByRole('button', { name: 'Send reference' }).click();
    await expect(page.getByText(/we.ll confirm within one working day/i)).toBeVisible();
  });

  test('E-B5: an unknown discount code shows the specific reason; a valid code shows the order discount', async ({
    page,
  }) => {
    await resetMock(page);
    await signInAsCustomer(page);
    await addFromProduct(page, oats, /Added 1 × 2 kg to your basket/);
    await startCheckoutDelivery(page);
    await page.getByRole('radiogroup', { name: 'Time window' }).getByRole('radio').first().click();
    await page.getByRole('radio', { name: /Cash on delivery/ }).click();

    await page.getByLabel('Discount code', { exact: true }).fill('NOPE');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText(/We don.t recognise that code./)).toBeVisible();
    await page.getByRole('button', { name: /Remove discount code NOPE/ }).click();

    await page.getByLabel('Discount code', { exact: true }).fill('SAVE100');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText(/Spend BDT 5,000\.00 or more to use SAVE100\./)).toBeVisible();
    await page.getByRole('button', { name: /Remove discount code SAVE100/ }).click();

    await page.getByLabel('Discount code', { exact: true }).fill('WELCOME10');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('Order discount (WELCOME10)')).toBeVisible();
  });
});
