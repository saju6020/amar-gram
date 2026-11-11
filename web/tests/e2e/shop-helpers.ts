import { expect, type Locator, type Page } from '@playwright/test';

/** Below 768 px the filter panel is a sheet (UI-1). */
export function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) < 768;
}

/**
 * Applies filters in whichever form the viewport shows: inline checkboxes on desktop (applied on
 * change), or the **Filters (n)** sheet with **Show results** on a 360 px phone. `act` receives the
 * locator that scopes the filter groups.
 */
export async function withFilters(
  page: Page,
  act: (scope: Locator) => Promise<void>,
): Promise<void> {
  if (isMobile(page)) {
    await page.getByRole('button', { name: /^Filters \(\d+\)$/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Filters' });
    await act(dialog);
    await dialog.getByRole('button', { name: 'Show results' }).click();
    await dialog.waitFor({ state: 'hidden' });
  } else {
    await act(page.getByRole('complementary', { name: 'Filters' }));
  }
}

/** Signs the storefront in/out of maintenance mode through the (mock) admin endpoint. */
export async function setMaintenance(page: Page, on: boolean, message = ''): Promise<void> {
  await page.evaluate(
    async ({ on, message }) => {
      const base = (window as unknown as { __apiBaseUrl?: string }).__apiBaseUrl ?? '';
      const response = await fetch(`${base}/api/admin/system/maintenance`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenanceMode: on, message: message || null }),
      });
      if (!response.ok) throw new Error(`maintenance toggle failed: ${response.status}`);
    },
    { on, message },
  );
}

/**
 * Real-API runs only. A new account (and a seeded customer after a policy is republished) has policies to accept, and the
 * portal's modal "Updated policies" dialog makes the rest of the page inert until each is accepted. The API's pending list
 * decides: when it is non-empty the dialog must appear and close once each is accepted; when empty, there is none.
 * Used by `subscriptions-customer-real-api` and `journey-real-api` (they each had a copy).
 */
export async function acceptPendingPolicies(page: Page): Promise<void> {
  // Right after a navigation the app may not have mounted yet; without its API base the fetch would go to the web server (404).
  await page.waitForFunction(() => (window as unknown as { __apiBaseUrl?: string }).__apiBaseUrl !== undefined);
  const pending = await page.evaluate(async () => {
    const base = (window as unknown as { __apiBaseUrl?: string }).__apiBaseUrl ?? '';
    const response = await fetch(`${base}/api/customers/me/policy-acceptances/pending`, { credentials: 'include' });
    const body: unknown = response.ok ? await response.json() : null;
    return { status: response.status, count: Array.isArray(body) ? body.length : -1 };
  });
  expect(pending.status).toBe(200);
  expect(pending.count, 'the pending-policies body must be an array').toBeGreaterThanOrEqual(0);
  if (pending.count === 0) return;
  const dialog = page.getByRole('dialog', { name: 'Updated policies' });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  for (let left = pending.count; left > 0; left--) {
    await dialog.getByRole('button', { name: 'Accept' }).first().click();
    await expect(dialog.getByRole('button', { name: 'Accept' })).toHaveCount(left - 1, { timeout: 20_000 });
  }
  await expect(dialog).toBeHidden({ timeout: 20_000 });
}
