import { test, expect as baseExpect, signInAsCustomer } from './fixtures';
import { addAddress, control, ids } from './ordering-helpers';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000, retries: 1 });

/**
 * HO-ORD-002 §16 customer E-series on MSW: bank transfer expiry (E-C2) and cancel (E-D1). Split out of
 * `ordering-customer.spec.ts` (HO-P3 §17.1, item 8); the helpers below are copies of that file's.
 */

const oats = `/shop/products/${ids.multiVariantSlug}?sku=${ids.skuOats2kg}`;

async function resetMock(page: import('@playwright/test').Page) {
  await page.goto('/sign-in');
  await control(page, 'reset');
}

async function addFromProduct(page: import('@playwright/test').Page, path: string, name: RegExp) {
  await page.goto(path);
  // D-1: "basket" (S2 renames the button); both words are accepted while the slices land.
  await page.getByRole('button', { name: /Add to (cart|basket)/ }).click();
  await expect(page.getByRole('status').filter({ hasText: name })).toBeVisible();
}

async function startCheckoutDelivery(page: import('@playwright/test').Page) {
  await addAddress(page);
  await page.goto('/checkout');
  await expect(
    page.getByRole('heading', { level: 1, name: /How should we get it to you/ }),
  ).toBeVisible();
}

test.describe('bank transfer expiry and cancel (US-ORD-12, US-ORD-19)', () => {
  test('E-C2: an unconfirmed transfer expires; the order explains it and Order again fills the cart', async ({
    page,
  }) => {
    await resetMock(page);
    await signInAsCustomer(page);
    await control(page, 'setTransferWindowSeconds', 3);
    await addFromProduct(page, oats, /Added 1 × Organic Rolled Oats/);
    await startCheckoutDelivery(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('radiogroup', { name: 'Time window' }).getByRole('radio').first().click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('radio', { name: /Bank transfer/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Pay by bank transfer' })).toBeVisible();
    // D-3 (owner, 2026-10-19): placing lands on the order page itself, so there is no "View your order" link; the
    // countdown keeps asking the server after the deadline and the page turns into the expired card on its own.
    await page.waitForTimeout(3500);
    await expect(page.getByRole('heading', { name: 'This order has expired' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByText(/We couldn.t confirm your transfer in time, so the items were released./),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Order again' }).click();
    await expect(page.getByText(/1 item was added to your basket\./)).toBeVisible();
    await page.getByRole('link', { name: 'Go to your basket' }).click();
    // S3 renames the heading "Your cart" to "Your basket" (D-1).
    await expect(
      page.getByRole('heading', { level: 1, name: /Your (cart|basket)/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('spinbutton', { name: /Quantity of Organic Rolled Oats/ }),
    ).toBeVisible();
  });

  test('E-D1: cancel before packing asks to confirm; a packed order offers the contact card instead', async ({
    page,
  }) => {
    await resetMock(page);
    await signInAsCustomer(page);
    await page.goto('/portal/orders');
    await page.getByRole('link', { name: /ORD-2026-000104/ }).click();
    await page.getByRole('button', { name: 'Cancel order' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cancel order ORD-2026-000104?' });
    await expect(dialog.getByText(/Your reserved items are released\./)).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel order' }).click();
    await expect(page.getByText('Cancelled').first()).toBeVisible();

    await page.goto('/portal/orders');
    await page.getByRole('link', { name: /ORD-2026-000106/ }).click();
    // Cancel stays on the page, disabled, with the reason and the branch contact beside it.
    await expect(page.getByRole('button', { name: 'Cancel order' })).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Contact the shop' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Track on the courier’s site' })).toBeVisible();
    await expect(page.getByText('PC-88213004').first()).toBeVisible();
  });
});
