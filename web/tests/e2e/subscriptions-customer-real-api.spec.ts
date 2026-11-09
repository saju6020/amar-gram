// Plain Playwright `test`, not ./fixtures: that wrapper waits for MSW's service worker, which never
// exists when NEXT_PUBLIC_USE_MOCKS=false (the whole point of this spec).
import { test, expect, type Page } from '@playwright/test';

/**
 * HO-P6 S1 §16 E18: the customer subscription screens and the wire they read, against the REAL API
 * (`E2E_REAL_API=1`, `NEXT_PUBLIC_USE_MOCKS=false`, a scratch database). Skipped otherwise. It registers its own customer, so
 * it needs no seed data; what it can prove depends on whether the scratch database already has a product with
 * `isSubscribable` set (staff set it in the product editor, or S3's seed). The create, skip and cancel flow runs only then;
 * without one it is recorded "not run" in the slice report.
 *
 * It pins the wire the mocks were written from: the key set of the options read, the `{ error }` 400 for a bad status, the
 * ProblemDetails 404 for an unknown subscription, and the empty paged list. (The 404 was first written here as bodiless; the
 * real API sends ASP.NET's ProblemDetails, so HO-P6 integration part 2 pins that instead, and the mocks send it too.)
 */
test.skip(process.env.E2E_REAL_API !== '1', 'real-API run only (E2E_REAL_API=1)');
test.skip(process.env.NEXT_PUBLIC_USE_MOCKS !== 'false', 'needs NEXT_PUBLIC_USE_MOCKS=false');
test.describe.configure({ timeout: 120_000 });

const CAPTCHA_ANSWER = process.env.E2E_CAPTCHA_ANSWER ?? 'TEST1';
const unique = Date.now().toString().slice(-8);
const GHOST = '5b000000-0000-0000-0000-00000000dead';

async function call(page: Page, path: string): Promise<{ status: number; body: unknown; text: string }> {
  return page.evaluate(async (path) => {
    const base = (window as unknown as { __apiBaseUrl?: string }).__apiBaseUrl ?? '';
    const response = await fetch(`${base}${path}`, { credentials: 'include' });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: response.status, body, text };
  }, path);
}

async function register(page: Page, name: string, mobile: string): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel(/mobile number/i).fill(mobile);
  await page.getByLabel(/^password/i).fill('a-genuinely-long-password-1');
  await expect(page.getByAltText(/security check/i)).toBeVisible();
  await page.getByLabel(/security check/i).fill(CAPTCHA_ANSWER);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/portal\//, { timeout: 15_000 });
  await acceptPendingPolicies(page);
}

/**
 * A new account on a seeded database has a policy to accept (seed-dev publishes Privacy with acceptance required), and the
 * portal's modal "Updated policies" dialog makes the rest of the page inert until it is accepted. The API's pending list
 * decides: when it is non-empty the dialog must appear and close once each is accepted; when empty, there is none.
 * (HO-P6 integration part 2: without this, every case here failed on the seeded scratch database.)
 */
async function acceptPendingPolicies(page: Page): Promise<void> {
  const pending = await call(page, '/api/customers/me/policy-acceptances/pending');
  expect(pending.status).toBe(200);
  const count = (pending.body as unknown[]).length;
  const dialog = page.getByRole('dialog', { name: 'Updated policies' });
  if (count === 0) return;
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  for (let left = count; left > 0; left--) {
    await dialog.getByRole('button', { name: 'Accept' }).first().click();
    await expect(dialog.getByRole('button', { name: 'Accept' })).toHaveCount(left - 1, { timeout: 20_000 });
  }
  await expect(dialog).toBeHidden({ timeout: 20_000 });
}

test('a new customer: the empty list, the menu entry, and the wire the mocks mirror', async ({ page }) => {
  await register(page, 'Subscriptions Real Customer', `017${unique}`);

  await page.goto('/portal/subscriptions');
  await expect(page.getByRole('heading', { level: 1, name: 'My subscriptions' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('No subscriptions yet. Look for Subscribe on a product page.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Subscriptions' }).first()).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('tab', { name: 'Current (0)' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Cancelled (0)' })).toBeVisible();

  // C3: the empty page, and the controller's plain { error } 400 (CustomerSubscriptionsController.cs:56).
  const list = await call(page, '/api/customers/me/subscriptions?status=live');
  expect(list.status).toBe(200);
  expect(list.body).toMatchObject({ items: [], totalCount: 0 });
  const bad = await call(page, '/api/customers/me/subscriptions?status=bogus');
  expect(bad.status).toBe(400);
  expect(bad.body).toEqual({ error: 'status must be live or cancelled.' });

  // C4/C5: an unknown subscription is ASP.NET's plain ProblemDetails 404 (`NotFound()` under [ApiController]), the same as
  // someone else's (ADR-248): no field names the subscription or says whether it exists.
  for (const path of [`/api/customers/me/subscriptions/${GHOST}`, `/api/customers/me/subscriptions/${GHOST}/cycles`]) {
    const missing = await call(page, path);
    expect(missing.status).toBe(404);
    const { traceId, ...problem } = missing.body as Record<string, unknown>;
    expect(typeof traceId).toBe('string');
    expect(problem).toEqual({ type: 'https://tools.ietf.org/html/rfc9110#section-15.5.5', title: 'Not Found', status: 404 });
  }
  await page.goto(`/portal/subscriptions/${GHOST}`);
  await expect(page.getByText("We couldn't find that subscription.")).toBeVisible({ timeout: 20_000 });

  // The shop lists a product; C1 for it answers with the documented key set.
  const catalogue = await call(page, '/api/shop/products');
  const first = (catalogue.body as { items: Array<{ skuId?: string | null; slug: string }> }).items.find((item) => item.skuId);
  test.skip(!first, 'the scratch database has no product with a size to read options for');
  const options = await call(page, `/api/customers/me/subscriptions/options?skuId=${first!.skuId}`);
  expect(options.status).toBe(200);
  expect(Object.keys(options.body as object).sort()).toEqual(
    [
      'allowedIntervalWeeks',
      'changeCutoffDays',
      'commerceTimeZoneId',
      'discountPercent',
      'earliestFirstDeliveryOn',
      'existingSubscriptionId',
      'latestFirstDeliveryOn',
      'maxQuantity',
      'notSubscribableReason',
      'preChargeNoticeDays',
      'sku',
      'subscribable',
      'unitPrice',
    ].sort(),
  );
  // C2 with neither id is the empty list (SubscriptionCustomerQueryHandlers.cs:117).
  const methods = await call(page, `/api/customers/me/subscriptions/payment-methods?skuId=${first!.skuId}`);
  expect(methods.status).toBe(200);
  expect(methods.body).toEqual([]);

  // The Subscribe page tells the truth about this product.
  await page.goto(`/portal/subscriptions/new/${first!.skuId}`);
  const body = options.body as { subscribable: boolean; notSubscribableReason: string | null };
  if (body.subscribable) {
    await expect(page.getByRole('button', { name: 'Start subscription' })).toBeVisible({ timeout: 20_000 });
  } else {
    await expect(page.getByText("This product can't be subscribed to right now.")).toBeVisible({ timeout: 20_000 });
    if (body.notSubscribableReason) await expect(page.getByText(body.notSubscribableReason)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start subscription' })).toHaveCount(0);
  }
});

test('with a product that can be subscribed to: subscribe by pickup, skip a delivery, then cancel', async ({ page }) => {
  await register(page, 'Subscriptions Real Subscriber', `016${unique}`);
  const catalogue = await call(page, '/api/shop/products');
  const items = (catalogue.body as { items: Array<{ skuId?: string | null }> }).items.filter((item) => item.skuId);
  let skuId: string | null = null;
  for (const item of items) {
    const options = await call(page, `/api/customers/me/subscriptions/options?skuId=${item.skuId}`);
    if ((options.body as { subscribable?: boolean }).subscribable) {
      skuId = item.skuId!;
      break;
    }
  }
  test.skip(!skuId, 'no product in the scratch database has isSubscribable set (not run)');

  await page.goto(`/portal/subscriptions/new/${skuId}`);
  await page.getByRole('radio', { name: /^Collect from an outlet/ }).check();
  await page.getByRole('radiogroup', { name: 'Collect from' }).getByRole('radio').first().check();
  await expect(page.getByRole('radio', { name: 'Bank transfer' })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole('radio', { name: 'Bank transfer' }).check();
  await page.getByRole('button', { name: 'Start subscription' }).click();
  await expect(page).toHaveURL(/\/portal\/subscriptions\/[0-9a-f-]{36}/, { timeout: 20_000 });
  await expect(page.getByText(/^Subscribed\. Your first delivery is on /)).toBeVisible();

  await page.getByRole('button', { name: /^Skip the delivery on / }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Skip this delivery' }).click();
  await expect(page.getByRole('status').filter({ hasText: /skip/i })).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Cancel subscription' }).click();
  const dialog = page.getByRole('dialog', { name: /^Cancel / });
  await dialog.getByRole('radio', { name: 'Something else' }).check();
  await dialog.getByRole('button', { name: 'Cancel subscription' }).click();
  await expect(page.getByRole('status').filter({ hasText: /cancel|ends after/i })).toBeVisible({ timeout: 20_000 });
});
