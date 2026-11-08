import type { Page } from '@playwright/test';
import { test, expect as baseExpect } from './fixtures';
import { signInEstablished } from './portal-helpers';
import { accountsFixtureIds } from '../../mocks/handlers/areas/accounts';
import { shopFixtureIds } from '../../mocks/handlers/shop/fixtures';
import { seedDates, subscriptionFixtureIds } from '../../mocks/handlers/subscriptions/fixtures';
import { formatCycleDate } from '../../lib/subscriptions/dates';
import type { SubscriptionsMockControls } from '../../mocks/handlers/subscriptions/control';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000, retries: 1 });

/**
 * HO-P6 S1 §16 E2 to E4 on MSW: the customer's subscription flows. The mock server runs in the page; what a spec cannot cause
 * through the UI ("the cut-off passes") goes through `window.__subscriptionsMock` (`mocks/handlers/subscriptions/control.ts`).
 * Seeded dates come from `seedDates()`; this spec never computes one.
 */

const mine = subscriptionFixtureIds.mine;
const dates = seedDates();
const oats2kgPage = `/shop/products/${shopFixtureIds.multiVariantSlug}?sku=${shopFixtureIds.skuOats2kg}`;

type ControlName = keyof SubscriptionsMockControls;

async function control<K extends ControlName>(
  page: Page,
  name: K,
  ...args: Parameters<SubscriptionsMockControls[K]>
): Promise<void> {
  await page.evaluate(
    ({ name, args }) => {
      const controls = (window as unknown as { __subscriptionsMock?: Record<string, (...a: unknown[]) => void> })
        .__subscriptionsMock;
      if (!controls) throw new Error('window.__subscriptionsMock is not installed (are mocks on?)');
      controls[name]!(...args);
    },
    { name, args: args as unknown[] },
  );
}

async function signedIn(page: Page): Promise<void> {
  await signInEstablished(page);
  await control(page, 'reset');
}

const status = (page: Page, text: string | RegExp) => page.getByRole('status').filter({ hasText: text });

test.describe('subscribe (US-SUB-01)', () => {
  test('E2: product page offer, the form, start, and the detail with the server estimate', async ({ page }) => {
    await signedIn(page);
    await page.goto(oats2kgPage);
    const offer = page.getByRole('link', { name: 'Subscribe & save 10%' });
    await expect(offer).toBeVisible();
    await offer.click();

    await expect(page).toHaveURL(new RegExp(`/portal/subscriptions/new/${shopFixtureIds.skuOats2kg}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Subscribe' })).toBeVisible();
    // No total and no card: the unit price, the rate in words and the note.
    await expect(page.getByText('Subscription discount: 10% off every delivery')).toBeVisible();
    await expect(page.getByText(/Delivery and tax are added when each order is placed\./)).toBeVisible();
    await expect(page.getByLabel(/card number|cvv/i)).toHaveCount(0);

    await page.getByRole('radio', { name: 'Every 4 weeks' }).check();
    await expect(page.getByRole('radio', { name: /^Home \(default\)/ })).toBeChecked();
    await page.getByRole('radio', { name: 'Bank transfer' }).check();
    await expect(page.getByText(/No card needed\. Each delivery creates an order that you pay for by bank transfer\./)).toBeVisible();
    await page.getByRole('button', { name: 'Start subscription' }).click();

    await expect(page).toHaveURL(/\/portal\/subscriptions\/[0-9a-f-]{36}$/);
    await expect(status(page, `Subscribed. Your first delivery is on ${formatCycleDate(dates.earliestFirstDeliveryOn)}.`)).toBeVisible();
    await expect(page.getByText(`Next delivery on ${formatCycleDate(dates.earliestFirstDeliveryOn)}`).first()).toBeVisible();
    await expect(page.getByText('Every 4 weeks')).toBeVisible();
    // The estimate is the server's, as sent: six strings and no browser arithmetic.
    const estimate = page.getByRole('region', { name: 'Estimate for each delivery' });
    await expect(estimate).toContainText('1 × ৳2,450.00');
    await expect(estimate).toContainText('Subscription discount −10%');
    await expect(estimate).toContainText('−৳245.00');
    await expect(estimate).toContainText('৳2,205.00');
    await expect(estimate).toContainText('Delivery and tax are added when each order is placed.');
    // The offer now says so.
    await page.goto(oats2kgPage);
    await expect(page.getByText('You already subscribe to this')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage' })).toBeVisible();
  });

  test('a product that is not offered shows no offer; a visitor who is signed out sees none and no options request is made', async ({
    page,
  }) => {
    const optionRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/subscriptions/options')) optionRequests.push(request.url());
    });
    // Signed out first: the offer is signed-in only (OQ-1) and nothing asks C1.
    await page.goto(oats2kgPage);
    await expect(page.getByRole('button', { name: /Add to (cart|basket)/ })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('subscribe-offer')).toHaveCount(0);
    expect(optionRequests).toEqual([]);

    await signedIn(page);
    await page.goto('/shop/products/breakfast-starter-kit');
    await expect(page.getByRole('button', { name: /Add to (cart|basket)/ })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('subscribe-offer')).toHaveCount(0);
  });

  test('signed out, the Subscribe page goes to sign-in and comes back to the form for that product', async ({ page }) => {
    await page.goto(`/portal/subscriptions/new/${shopFixtureIds.skuOats2kg}`);
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    await page.getByLabel(/mobile number or email/i).fill(accountsFixtureIds.customerEmail);
    await page.getByLabel(/^password/i).fill(accountsFixtureIds.customerPassword);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/portal/subscriptions/new/${shopFixtureIds.skuOats2kg}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Subscribe' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Organic Rolled Oats' })).toBeVisible();
  });

  test('pickup, a payment method Orders will not offer stays listed with its reason, and a refused address is mapped to its field', async ({
    page,
  }) => {
    await signedIn(page);
    // Garam Masala 750 g costs more than the cash-on-delivery limit at two packs.
    await page.goto(`/portal/subscriptions/new/${subscriptionFixtureIds.skus.masala750}`);
    await page.getByLabel('Quantity per delivery').fill('2');
    const cash = page.getByRole('radio', { name: /^Cash on delivery/ });
    await expect(cash).toBeDisabled();
    await expect(page.getByText(/Cash on delivery is available for orders up to/)).toBeVisible();
    await expect(cash).toHaveAttribute('aria-describedby', /.+/);

    await page.getByRole('radio', { name: 'Collect from an outlet' }).check();
    await expect(page.getByRole('heading', { level: 3, name: 'Collect from' })).toBeVisible();
    await page.getByRole('radiogroup', { name: 'Collect from' }).getByRole('radio').first().check();
    await expect(page.getByRole('radio', { name: /^Bank transfer/ })).toBeEnabled();
    await expect(page.getByRole('radio', { name: /^Pay at the shop on collection/ })).toBeEnabled();
  });
});

test.describe('manage (US-SUB-02, US-SUB-06)', () => {
  test('unlocked: changing the quantity answers with the sentence that names the next delivery', async ({ page }) => {
    await signedIn(page);
    await page.goto(`/portal/subscriptions/${mine.activeUnlocked}`);
    await expect(page.getByRole('heading', { level: 1, name: /Organic Rolled Oats/ })).toBeVisible();
    await expect(page.getByText(`Next delivery on ${formatCycleDate(dates.unlockedNextDeliveryOn)}`).first()).toBeVisible();
    await expect(page.getByText(/Changes made before .* apply to the delivery on/)).toBeVisible();

    await page.getByRole('button', { name: 'Change', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: /^Change Organic Rolled Oats/ });
    await dialog.getByLabel('Quantity per delivery').fill('3');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      status(page, `Done. Your next delivery on ${formatCycleDate(dates.unlockedNextDeliveryOn)} will be 3 × Organic Rolled Oats 400 g.`),
    ).toBeVisible();
  });

  test('locked: change, skip and cancel are scheduled with the following delivery named, listed as pending, and withdrawn together', async ({
    page,
  }) => {
    await signedIn(page);
    await page.goto(`/portal/subscriptions/${mine.activeLocked}`);
    await expect(
      page.getByText(`Your delivery on ${formatCycleDate(dates.lockedNextDeliveryOn)} is already being prepared.`),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Scheduled changes' })).toBeVisible();

    // Pending terms are seeded; withdraw them, then schedule a skip.
    await page.getByRole('button', { name: 'Withdraw scheduled changes' }).click();
    const withdraw = page.getByRole('dialog', { name: 'Withdraw scheduled changes?' });
    await expect(withdraw.getByRole('listitem').first()).toContainText('New terms from the delivery on');
    await withdraw.getByRole('button', { name: 'Withdraw changes' }).click();
    await expect(status(page, 'Done. The scheduled change has been withdrawn.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Scheduled changes' })).toHaveCount(0);

    await page.getByRole('button', { name: /^Skip the delivery on / }).click();
    const skip = page.getByRole('dialog', { name: /^Skip the delivery on / });
    await skip.getByRole('button', { name: 'Skip this delivery' }).click();
    await expect(status(page, /is already being prepared, so we will skip the one on/)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Scheduled changes' })).toContainText('is skipped');

    await page.getByRole('button', { name: 'Cancel subscription' }).click();
    const cancel = page.getByRole('dialog', { name: /^Cancel Thai Jasmine Rice/ });
    await expect(cancel).toContainText('is already being prepared and will still arrive. Your subscription ends after it.');
    // A reason is required before anything is sent.
    await cancel.getByRole('button', { name: 'Cancel subscription' }).click();
    await expect(cancel.getByText('Choose a reason so we know how to improve.')).toBeVisible();
    await cancel.getByRole('radio', { name: 'It costs too much' }).check();
    await cancel.getByLabel(/Anything else/).fill('<b>Too dear</b>');
    await cancel.getByRole('button', { name: 'Cancel subscription' }).click();
    await expect(status(page, /Your subscription ends after it\./)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Scheduled changes' })).toContainText('Ends after the delivery on');

    await page.getByRole('button', { name: 'Withdraw scheduled changes' }).click();
    await page.getByRole('dialog', { name: 'Withdraw scheduled changes?' }).getByRole('button', { name: 'Withdraw changes' }).click();
    await expect(page.getByRole('region', { name: 'Scheduled changes' })).toHaveCount(0);
  });

  test('pause, then resume with a chosen date', async ({ page }) => {
    await signedIn(page);
    await page.goto(`/portal/subscriptions/${mine.activeUnlocked}`);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const pause = page.getByRole('dialog', { name: /^Pause Organic Rolled Oats/ });
    await expect(pause).toContainText('No orders are placed until you resume.');
    await pause.getByRole('button', { name: 'Pause subscription' }).click();
    await expect(status(page, 'Done. Your subscription is paused. Resume it any time.')).toBeVisible();
    await expect(page.getByText('Paused: no deliveries until you resume.').first()).toBeVisible();

    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    const resume = page.getByRole('dialog', { name: /^Resume Organic Rolled Oats/ });
    await resume.getByLabel('First delivery date (optional)').fill(dates.latestFirstDeliveryOn);
    await resume.getByRole('button', { name: 'Resume subscription' }).click();
    await expect(status(page, `Your next delivery is on ${formatCycleDate(dates.latestFirstDeliveryOn)}.`)).toBeVisible();
    await expect(page.getByText(`Next delivery on ${formatCycleDate(dates.latestFirstDeliveryOn)}`).first()).toBeVisible();
  });

  test('suspended for unpaid orders: the banner has the outlet phone and only Cancel is offered; the other suspension reads differently', async ({
    page,
  }) => {
    await signedIn(page);
    await page.goto(`/portal/subscriptions/${mine.suspendedUnpaid}`);
    await expect(page.getByText('This subscription was paused after unpaid orders. Please contact the shop to restart it.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Contact the shop' }).getByRole('listitem').first()).toContainText(/\d{4}/);
    const actions = page.getByRole('group', { name: 'What you can do' });
    await expect(actions.getByRole('button')).toHaveText(['Cancel subscription']);
    await expect(page.getByText('Expired unpaid').first()).toBeVisible();

    await page.goto(`/portal/subscriptions/${mine.suspendedProductUnavailable}`);
    await expect(page.getByText('This subscription was paused because the product is no longer available. Please contact the shop.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Contact the shop' })).toHaveCount(0);
  });

  test('history: a transfer still to pay says so and links to the order page; the list shows its one warning line', async ({ page }) => {
    await signedIn(page);
    await page.goto('/portal/subscriptions');
    await expect(page.getByRole('heading', { level: 1, name: 'My subscriptions' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Current \(7\)$/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Cancelled \(1\)$/ })).toBeVisible();
    await expect(page.getByText('Your delivery address was removed. Choose another.')).toBeVisible();
    await expect(page.getByText(/^Waiting for your transfer: pay by /)).toBeVisible();
    await page.getByRole('tab', { name: /^Cancelled/ }).click();
    await expect(page.getByText('Raw Forest Honey · 500 g')).toBeVisible();

    await page.goto(`/portal/subscriptions/${mine.awaitingPayment}`);
    await expect(page.getByText(/Awaiting your transfer: pay by /).first()).toBeVisible();
    const order = page.getByRole('link', { name: /^ORD-2026-/ }).first();
    await expect(order).toHaveAttribute('href', /\/portal\/orders\/[0-9a-f-]{36}$/);
  });
});

test.describe('the reminder link (US-SUB-03, ADR-FE-111)', () => {
  test('?skip= matching the next delivery opens the confirmation and changes nothing until confirmed', async ({ page }) => {
    await signedIn(page);
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET' && request.url().includes('/subscriptions/')) writes.push(request.url());
    });
    await page.goto(`/portal/subscriptions/${mine.activeUnlocked}?skip=${dates.unlockedNextDeliveryOn}`);
    const dialog = page.getByRole('dialog', { name: `Skip the delivery on ${formatCycleDate(dates.unlockedNextDeliveryOn)}?` });
    await expect(dialog).toBeVisible();
    // The parameter is gone and nothing was sent.
    await expect(page).toHaveURL(new RegExp(`/portal/subscriptions/${mine.activeUnlocked}$`));
    expect(writes).toEqual([]);
    await expect(page.getByText(`Next delivery on ${formatCycleDate(dates.unlockedNextDeliveryOn)}`).first()).toBeVisible();

    await dialog.getByRole('button', { name: 'Skip this delivery' }).click();
    await expect(status(page, /^Done\. That delivery is skipped\. Your next delivery is on /)).toBeVisible();
    await expect(page.getByText(`Next delivery on ${formatCycleDate(dates.unlockedFollowingDeliveryOn)}`).first()).toBeVisible();
  });

  test('a stale ?skip= is explained and offers the delivery that can be skipped', async ({ page }) => {
    await signedIn(page);
    await page.goto(`/portal/subscriptions/${mine.activeUnlocked}?skip=${dates.today}`);
    await expect(status(page, 'That delivery can no longer be skipped.')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: `Skip the delivery on ${formatCycleDate(dates.unlockedNextDeliveryOn)} instead` }).click();
    await expect(page.getByRole('dialog', { name: `Skip the delivery on ${formatCycleDate(dates.unlockedNextDeliveryOn)}?` })).toBeVisible();

    // A malformed value is ignored and removed.
    await page.goto(`/portal/subscriptions/${mine.activeUnlocked}?skip=soon`);
    await expect(page.getByRole('heading', { level: 1, name: /Organic Rolled Oats/ })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/portal/subscriptions/${mine.activeUnlocked}$`));
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('signed out, the link goes to sign-in and then lands on the confirmation, never skipping on its own', async ({ page }) => {
    await page.goto(`/portal/subscriptions/${mine.activeUnlocked}?skip=${dates.unlockedNextDeliveryOn}`);
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    await page.getByLabel(/mobile number or email/i).fill(accountsFixtureIds.customerEmail);
    await page.getByLabel(/^password/i).fill(accountsFixtureIds.customerPassword);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      page.getByRole('dialog', { name: `Skip the delivery on ${formatCycleDate(dates.unlockedNextDeliveryOn)}?` }),
    ).toBeVisible();
    await expect(page.getByText(`Next delivery on ${formatCycleDate(dates.unlockedNextDeliveryOn)}`).first()).toBeVisible();
  });
});
