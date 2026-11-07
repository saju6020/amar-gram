// Plain Playwright `test`, not ./fixtures: that wrapper waits for MSW's service worker, which never
// exists when NEXT_PUBLIC_USE_MOCKS=false (the whole point of this spec).
import { test, expect, type Page } from '@playwright/test';

/**
 * HO-POR-002 §16 — the E-A cases re-run against the REAL API (NEXT_PUBLIC_USE_MOCKS=false, API on
 * http://localhost:5014, fresh database amargram_por002e2e). Skipped on mocks. It registers its
 * own customer, so it needs no seed data, and it also pins the dashboard wire contract the mocks
 * were written from (the key set, section states). Re-order and the order/balance tiles with data
 * need orders and invoices that a fresh database does not hold; they are recorded as not run
 * against the real API in TC-HO-POR-002.
 */
const IS_REAL_API = process.env.NEXT_PUBLIC_USE_MOCKS === 'false';
test.skip(!IS_REAL_API, 'real-API run only (NEXT_PUBLIC_USE_MOCKS=false)');
test.describe.configure({ timeout: 90_000 });

const CAPTCHA_ANSWER = process.env.E2E_CAPTCHA_ANSWER ?? 'TEST1';
const unique = Date.now().toString().slice(-8);

async function getJson(page: Page, path: string): Promise<{ status: number; body: unknown }> {
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
    return { status: response.status, body };
  }, path);
}

test('E-A1/E-A2 real: a new customer sees a welcome, an empty orders tile and nothing to pay', async ({
  page,
}) => {
  const mobile = `019${unique}`;
  const password = 'a-genuinely-long-password-1';

  await page.goto('/register');
  await page.getByLabel('Full name').fill('Portal Real Customer');
  await page.getByLabel(/mobile number/i).fill(mobile);
  await page.getByLabel(/^password/i).fill(password);
  await expect(page.getByAltText(/security check/i)).toBeVisible();
  await page.getByLabel(/security check/i).fill(CAPTCHA_ANSWER);
  await page.getByRole('button', { name: 'Create account' }).click();
  // Owner, 2026-10-19: a new customer is signed in straight after registering (no second sign-in).
  await expect(page).toHaveURL(/\/portal\//, { timeout: 15_000 });

  // The wire: exactly the keys HO-POR-001 delivers; no subscriptions.
  await page.goto('/portal');
  await expect(page.getByRole('heading', { name: 'Welcome back, Portal' })).toBeVisible({
    timeout: 20_000,
  });
  const dashboard = await getJson(page, '/api/portal/dashboard');
  expect(dashboard.status).toBe(200);
  const body = dashboard.body as Record<string, { state: string; data: unknown }>;
  expect(Object.keys(body).sort()).toEqual(
    ['balances', 'customer', 'generatedOn', 'orders'].sort(),
  );
  for (const key of ['customer', 'balances', 'orders']) {
    expect(['Ready', 'Unavailable']).toContain(body[key]!.state);
  }

  await expect(page.getByTestId('tile-orders')).toContainText('haven’t placed an order');
  await expect(page.getByTestId('tile-balances')).toContainText('Nothing to pay right now');
  await expect(page.getByRole('button', { name: /\bpay/i })).toHaveCount(0);
});

test('E-B real: Orders’ re-order answers 404 for an order that is not the caller’s, and needs an Idempotency-Key', async ({
  page,
}) => {
  const mobile = `018${unique}`;
  const password = 'a-genuinely-long-password-1';
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Portal Reorder Customer');
  await page.getByLabel(/mobile number/i).fill(mobile);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByLabel(/security check/i).fill(CAPTCHA_ANSWER);
  await page.getByRole('button', { name: 'Create account' }).click();
  // Owner, 2026-10-19: a new customer is signed in straight after registering (no second sign-in).
  await expect(page).toHaveURL(/\/portal\//, { timeout: 15_000 });

  const unknown = '00000000-0000-0000-0000-0000000000aa';
  const withKey = await page.evaluate(async (orderId) => {
    const base = (window as unknown as { __apiBaseUrl?: string }).__apiBaseUrl ?? '';
    const csrf = document.cookie
      .split('; ')
      .find((r) => r.startsWith('pc_csrf='))
      ?.slice(8);
    const call = async (key: string | null) => {
      const response = await fetch(`${base}/api/customers/me/orders/${orderId}/reorder`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}),
          ...(key ? { 'Idempotency-Key': key } : {}),
        },
      });
      return response.status;
    };
    return { withoutKey: await call(null), withKey: await call(crypto.randomUUID()) };
  }, unknown);
  // No key: the contract's 400 IdempotencyKeyRequired. With a key: the order is not theirs: 404.
  expect(withKey).toEqual({ withoutKey: 400, withKey: 404 });
});
