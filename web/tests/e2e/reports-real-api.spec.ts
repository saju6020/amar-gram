import fs from 'node:fs';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
// Plain Playwright `test`, not ./fixtures: that wrapper waits for MSW's service worker, which never
// exists when NEXT_PUBLIC_USE_MOCKS=false (the whole point of this spec).
import { test, expect, type Page } from '@playwright/test';
import { expectAxeClean, expectNoHorizontalScroll } from './reports-helpers';

/**
 * HO-RPT-002 §16 — the E-cases re-run against the REAL API (HO-RPT-001 on master). Manual: needs
 * the API on a scratch database (never amargram_dev), the web app started with `NEXT_PUBLIC_USE_MOCKS=false
 * NEXT_PUBLIC_API_BASE_URL=<that API>`, and `REPORTS_SEED` pointing at the `rpt-seed.json` that
 * `node scripts/seed-e2e-real-api.mjs` writes (an administrator, two accountants "Aisha Accountant" and "Mahmud
 * Accountant", a shop manager and a reception account; sign-in takes an email as well as a mobile). The full recipe is
 * in web/README.md ("Real-API end-to-end runs"). Skipped otherwise. Serial: the cases share one branch and one schedule.
 */
const SEED_PATH = process.env.REPORTS_SEED;
const enabled = process.env.NEXT_PUBLIC_USE_MOCKS === 'false' && !!SEED_PATH;
const seed = enabled
  ? (JSON.parse(fs.readFileSync(SEED_PATH!, 'utf8')) as {
      branchId: string;
      people: Record<string, { mobile: string; password: string; name?: string }>;
    })
  : null;

// A cold `next dev` compiles each route on its first visit, which can outlast the default 5 s.
const slow = expect.configure({ timeout: 30_000 });

test.describe.configure({ mode: 'serial', timeout: 180_000 });
test.skip(!enabled, 'real-API run only (NEXT_PUBLIC_USE_MOCKS=false, REPORTS_SEED=<seed.json>)');

async function signInAs(page: Page, person: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/staff/sign-in');
  await page.waitForFunction(
    () => (window as unknown as { __apiBaseUrl?: string }).__apiBaseUrl !== undefined,
  );
  const { mobile, password } = seed!.people[person]!;
  const status = await page.evaluate(
    async ({ mobile, password }) => {
      const base = (window as unknown as { __apiBaseUrl?: string }).__apiBaseUrl ?? '';
      const response = await fetch(`${base}/api/staff/auth/sign-in`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: mobile, password }),
      });
      return response.status;
    },
    { mobile, password },
  );
  slow(status).toBe(200);
}

const todayDhaka = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });

/** Calls the API from the signed-in page (cookies and CSRF as the app sends them). */
async function api(page: Page, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return page.evaluate(
    async ({ method, path, body, headers, branchId }) => {
      const base = (window as unknown as { __apiBaseUrl?: string }).__apiBaseUrl ?? '';
      const csrf = decodeURIComponent(
        (document.cookie.split('; ').find((c) => c.startsWith('pc_csrf=')) ?? '').slice(8),
      );
      const res = await fetch(`${base}${path}`, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'X-Branch-Id': branchId, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, text, json: text.startsWith('{') || text.startsWith('[') ? JSON.parse(text) : null };
    },
    { method, path, body, headers, branchId: seed!.branchId },
  );
}

/**
 * Issues one invoice dated today, so the revenue report has a row to show. The report's default period is the PREVIOUS
 * month and a fresh database has no invoices at all: without data the page shows only "No results", and the column
 * heading "Margin" exists solely in the loading skeleton, which E-C used to catch by luck.
 */
async function issueOneInvoiceToday(page: Page): Promise<void> {
  const items = (json: unknown): Array<Record<string, string>> =>
    Array.isArray(json) ? json : ((json as { items?: Array<Record<string, string>> } | null)?.items ?? []);
  const mobile = '01911000009';
  const found = items((await api(page, 'GET', `/api/staff/customers?mobile=${mobile}`)).json).find(
    (c) => c.fullName === 'Reports Walkin',
  );
  let customerId = found?.customerId ?? found?.id;
  if (!customerId) {
    const created = await api(page, 'POST', '/api/staff/customers', { fullName: 'Reports Walkin', mobileNumber: mobile });
    expect(created.status, created.text).toBeLessThan(300);
    customerId = created.json.customerId ?? created.json.id;
  }
  const taxClasses = items((await api(page, 'GET', '/api/admin/tax-classes')).json);
  const taxClassId = (taxClasses.find((t) => t.code === 'STANDARD') ?? taxClasses[0])?.id;
  const charge = await api(page, 'POST', '/api/staff/billing/charges', {
    customerId, description: 'Reports E-C charge', unitPrice: '100', taxClassId, quantity: '1',
    serviceDate: todayDhaka(), businessLine: 'Shop',
  });
  expect(charge.status, charge.text).toBe(201);
  const draft = await api(page, 'POST', '/api/staff/billing/invoices', { customerId, chargeIds: [charge.json.chargeId] });
  expect(draft.status, draft.text).toBe(201);
  const detail = await api(page, 'GET', `/api/staff/billing/invoices/${draft.json.invoiceId}`);
  const issued = await api(
    page, 'POST', `/api/staff/billing/invoices/${draft.json.invoiceId}/issue`,
    { expectedVersion: detail.json.version }, { 'Idempotency-Key': crypto.randomUUID() },
  );
  expect(issued.status, issued.text).toBe(200);
}

async function open(page: Page, person: string, path: string): Promise<void> {
  await signInAs(page, person);
  await page.goto(path);
  await slow(page.locator('#main-content')).toBeVisible({ timeout: 60_000 });
}

test('E-A1/E-A2 real: staff land on a dashboard; an accountant sees money', async ({ page }) => {
  await open(page, 'Administrator', '/');
  await slow(page).toHaveURL(/\/staff$/);
  await slow(page.getByRole('heading', { level: 1, name: /^Today — / })).toBeVisible();
  await slow(page.getByText(/Updated \d\d:\d\d/)).toBeVisible();
  await slow(page.getByRole('heading', { level: 2 }).first()).toBeVisible();

  await open(page, 'Accountant', '/staff');
  await slow(page.getByRole('heading', { level: 2, name: 'Payments today' })).toBeVisible();
  await slow(page.getByRole('heading', { level: 2, name: 'Receivables' })).toBeVisible();
});

test('E-A4 real: the dashboard refreshes by itself past the interval (the dialog case is U-A5)', async ({
  page,
}) => {
  await open(page, 'Administrator', '/staff');
  const updated = page.getByText(/Updated \d\d:\d\d/);
  await slow(updated).toBeVisible();
  const before = await updated.textContent();
  // The server default is 60 s (Reporting:DashboardRefreshSeconds); wait one interval and a bit.
  await page.waitForTimeout(65_000);
  await slow(updated).not.toHaveText(before ?? '');
});

test('E-B real: the catalogue, a report, a range limit, and CSV + PDF downloads', async ({
  page,
}) => {
  await open(page, 'Administrator', '/staff/reports');
  await slow(page.getByRole('heading', { level: 2, name: 'Financial' })).toBeVisible();
  const link = page.getByRole('link', { name: /Payment reconciliation/ });
  await link.click();
  await slow(page.getByRole('heading', { level: 1, name: 'Payment reconciliation' })).toBeVisible();
  await slow(page.getByLabel(/^From/)).toHaveValue(/^\d{4}-\d\d-\d\d$/);
  const body = page
    .getByRole('table')
    .or(page.getByRole('list', { name: / · / }))
    .or(page.getByText(/^No results for Payment reconciliation/));
  await slow(body.first()).toBeVisible({ timeout: 30_000 });

  await page.getByLabel(/^From/).fill('2020-01-01');
  await page.getByLabel(/^To/).fill('2026-12-31');
  await page.getByRole('button', { name: 'Apply' }).click();
  await slow(page.getByText(/covers at most \d+ days/)).toBeVisible();

  await page.getByRole('button', { name: 'Reset' }).click();
  await slow(body.first()).toBeVisible({ timeout: 30_000 });
  for (const [button, extension] of [
    ['Export CSV', 'csv'],
    ['Export PDF', 'pdf'],
  ] as const) {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: button }).click(),
    ]);
    slow(download.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`));
    slow(readFileSync((await download.path())!).length).toBeGreaterThan(0);
  }
});

test('E-C real: stock, revenue and growth reports open; margin is for the accountant only', async ({
  page,
}) => {
  for (const key of ['stock-position', 'stock-near-expiry', 'stock-low-reorder']) {
    await open(page, 'Administrator', `/staff/reports/${key}`);
    await slow(page.getByRole('heading', { level: 1 })).toBeVisible();
    await slow(page.locator('#main-content').getByRole('alert')).toHaveCount(0);
  }
  // The Margin column is only drawn when the report has rows: give it one (an invoice dated today) and ask for today.
  await open(page, 'Administrator', '/staff/reports/stock-position');
  await issueOneInvoiceToday(page);
  await open(page, 'Accountant', `/staff/reports/revenue-by-business-line?from=${todayDhaka()}&to=${todayDhaka()}`);
  await slow(
    page.getByRole('heading', { level: 1, name: 'Revenue by sales channel' }),
  ).toBeVisible();
  // The rows come from the reporting views, which can trail the invoice by a moment: reload until the result has rows.
  await expect(async () => {
    await page.reload();
    const result = page.getByLabel(/^Revenue by sales channel · /);
    await expect(result).toBeVisible({ timeout: 15_000 });
    await expect(result.getByText('Margin', { exact: true }).first()).toBeVisible();
  }).toPass({ timeout: 60_000 });
  await open(page, 'ShopManager', '/staff/reports/revenue-by-business-line');
  await slow(page.getByText(/have permission/i)).toBeVisible();
  await open(page, 'Accountant', '/staff/reports/payment-reconciliation');
  await slow(page.getByRole('heading', { level: 1, name: /Payment reconciliation/ })).toBeVisible();
  await open(page, 'Administrator', '/staff/reports/customers-new-vs-returning');
  await slow(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('E-D real: create a schedule, run it now, see the run and its deliveries, then pause, resume and cancel', async ({
  page,
}) => {
  await open(
    page,
    'Administrator',
    '/staff/admin/report-schedules/new?reportKey=revenue-by-business-line',
  );
  await page.getByLabel('Name').fill('E2E revenue');
  await slow(page.getByText(/The next one covers/)).toBeVisible({ timeout: 30_000 });
  await page.getByLabel(/Aisha Accountant/).check();
  await page.getByLabel(/Mahmud Accountant/).check();
  await page.getByRole('button', { name: 'Create schedule' }).click();
  await slow(page.getByRole('heading', { level: 1, name: 'E2E revenue' })).toBeVisible({
    timeout: 60_000,
  });

  await page.getByRole('button', { name: /Run now/ }).click();
  await slow(page.getByRole('dialog')).toContainText('emails it to 2 people now');
  await page.getByRole('dialog').getByRole('button', { name: 'Run now' }).click();
  await slow(page.getByText(/^Generated — \d+ rows$/).first()).toBeVisible({ timeout: 90_000 });
  await slow(page.getByRole('heading', { level: 2, name: 'Run history' })).toBeVisible();
  await slow(page.getByText('Generated', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: /Pause/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Pause' }).click();
  await slow(page.getByText('Paused').first()).toBeVisible();
  await page.getByRole('button', { name: /Resume/ }).click();
  await slow(page.getByText('Active').first()).toBeVisible();
  await page.getByRole('button', { name: /Cancel schedule/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel schedule' }).click();
  await slow(page.getByText(/was cancelled and cannot be changed/)).toBeVisible();
  await slow(page.getByRole('heading', { level: 2, name: 'Run history' })).toBeVisible();
});

test('E-D4 real: a shop manager who opens the schedules directly is refused', async ({ page }) => {
  await open(page, 'ShopManager', '/staff/admin/report-schedules');
  await slow(page.getByText(/have permission/i)).toBeVisible();
});

test('E-X real: the real pages are axe-clean and never scroll sideways', async ({ page }) => {
  let signedInAs = '';
  for (const [person, path] of [
    ['Administrator', '/staff'],
    ['Administrator', '/staff/admin/report-schedules'],
    ['Administrator', '/staff/reports'],
    ['Accountant', '/staff/reports/revenue-by-business-line'],
    ['Accountant', '/staff/reports/payment-reconciliation'],
  ] as const) {
    // Sign in once per person: the sign-in endpoint is rate limited.
    if (person !== signedInAs) {
      await signInAs(page, person);
      signedInAs = person;
    }
    await page.goto(path);
    await slow(page.locator('#main-content')).toBeVisible({ timeout: 60_000 });
    await slow(page.getByRole('heading').first()).toBeVisible();
    await page.waitForTimeout(1500);
    await expectAxeClean(page);
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(page);
    }
  }
});
