import { expect, type Page } from '@playwright/test';
import { holdApiUntilMswReady, signInAsCustomer } from './fixtures';

/**
 * HO-POR-002 e2e helpers (plain functions, not a spec).
 *
 * Diagnosis of the cold-start `/sign-in` redirect and the one `POST /api/auth/sign-in ... 404`: see
 * `holdApiUntilMswReady` in `fixtures.ts`, where the hold moved so every spec gets it. In the
 * fixtures' own sign-in the same gap shows as a request that reaches Next.js instead of MSW (a 404),
 * because `window.__apiBaseUrl` is not set yet and `fixtures.ts` waits for `__mswReady` only
 * best-effort (it swallows its own 10 s timeout). Still exported from here for this file's callers
 * that build a page outside the `test` fixture. No app code is changed and no retry hides a lost
 * session.
 */
export { holdApiUntilMswReady };

/** Signs in and waits until the session endpoint answers 200 for this tab before returning. */
export async function signInEstablished(page: Page): Promise<void> {
  await holdApiUntilMswReady(page);
  if (page.url() === 'about:blank') await page.goto('/sign-in');
  await page.waitForFunction(
    () =>
      Boolean((window as unknown as { __apiBaseUrl?: string }).__apiBaseUrl) &&
      (window as unknown as { __mswReady?: boolean }).__mswReady === true,
    undefined,
    { timeout: 60_000 },
  );
  await signInAsCustomer(page);
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const base = (window as unknown as { __apiBaseUrl?: string }).__apiBaseUrl ?? '';
          const response = await fetch(`${base}/api/auth/session`, { credentials: 'include' });
          return response.status;
        }),
      { message: 'customer session established', timeout: 10_000 },
    )
    .toBe(200);
}

/** Selects the dashboard the mock answers with (the handlers read this cookie in the page). */
export async function selectPortalScenario(page: Page, name: string): Promise<void> {
  await page
    .context()
    .addCookies([{ name: 'pc_mock_portal', value: name, domain: 'localhost', path: '/' }]);
}
