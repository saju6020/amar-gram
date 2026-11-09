import { test as base, expect, type Page } from '@playwright/test';
import { accountsFixtureIds } from '../../mocks/handlers/areas/accounts';

/**
 * Every e2e spec imports `test`/`expect` from here rather than
 * `@playwright/test` directly, because `page.goto` is wrapped to wait for MSW's browser worker to
 * be registered-and-controlling before returning.
 *
 * `app/providers.tsx`'s own comment already names the race this works around: `worker.start()`
 * is async and its effect fires after first paint, so a request made in the same tick as mount
 * can reach the real network (and fail — nothing listens on `NEXT_PUBLIC_API_BASE_URL` in this
 * dev setup) before MSW is ready to intercept it. TanStack Query's default `retry: 1` papers
 * over this for queries, but mutations (register, add to cart, save profile, …) don't retry
 * by default, so a fast-clicking test can lose the race outright. Documented here as a known
 * MSW/Next.js limitation (§5.1), not worked around by inventing a readiness field in app code —
 * `navigator.serviceWorker.controller` is the browser's own, standard signal for "a service
 * worker now controls this page's requests".
 *
 * ARCH gate MEDIUM (first pass) — this file used to sign in as BOTH a staff administrator and a
 * customer, unconditionally, before every single test. Two problems with that, both from the
 * gate: (1) with both cookies set, the master session middleware resolves the staff cookie first
 * on every request, so a "customer" request would actually run as staff — this file's own
 * mixed-audience specs (e.g. `accounts-a11y-responsive.spec.ts`) were silently
 * exercising the wrong identity for their `/portal/**` cases; (2) it used a RELATIVE `fetch(path)`,
 * which only resolves correctly against the Next.js origin in MSW mode — against the real API
 * (§5.1's own re-run) that relative path hits the wrong origin entirely and 404s, a failure this
 * file used to swallow after one retry.
 *
 * Neither `signInAsStaff` nor `signInAsCustomer` below is called automatically any more — a spec
 * calls whichever one (never both) its own tests actually need, explicitly, in each test's own
 * body or its own `test.beforeEach`. Both throw loudly (not a silently-ignored boolean) on
 * failure, and both build an ABSOLUTE URL from `window.__apiBaseUrl` (`app/providers.tsx`, set
 * from `NEXT_PUBLIC_API_BASE_URL`) rather than a relative path, so the same helper works
 * identically against MSW and against the real API.
 */
async function signInViaPageFetch(
  page: Page,
  path: '/api/auth/sign-in' | '/api/staff/auth/sign-in',
  identifier: string,
  password: string,
): Promise<void> {
  const result = await page.evaluate(
    async ({ path, identifier, password }) => {
      const apiBaseUrl = (window as unknown as { __apiBaseUrl?: string }).__apiBaseUrl ?? '';
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      return { ok: response.ok, status: response.status, statusText: response.statusText };
    },
    { path, identifier, password },
  );
  if (!result.ok) {
    throw new Error(
      `fixtures.ts sign-in fixture failed: POST ${path} for "${identifier}" returned ` +
        `${result.status} ${result.statusText}. This is a fixture failure, not a test failure — ` +
        `fix it before trusting the test it was about to run.`,
    );
  }
}

/**
 * The mock's second, non-administrator staff login (Reception). Its roles give it `Stock.View` and
 * the message log but not receiving, procurement or staff-account management, and the reports specs
 * switch its roles before use. The only place the e2e suite names the underlying mock fixture keys.
 */
export const secondStaff = {
  staffId: accountsFixtureIds.stockStaffId,
  identifier: accountsFixtureIds.stockIdentifier,
  password: accountsFixtureIds.stockPassword,
} as const;

/** A non-administrator staff login with the Inventory role: no notifications permission at all. */
export const inventoryStaff = {
  staffId: accountsFixtureIds.inventoryStaffId,
  identifier: accountsFixtureIds.inventoryIdentifier,
  password: accountsFixtureIds.inventoryPassword,
} as const;

/** Signs in as the seeded staff administrator (`accountsFixtureIds.adminIdentifier`). Call once,
 *  before navigating to the first `/staff/**` route a test needs to already be authenticated for.
 *  Navigates to `/staff/sign-in` first if the page hasn't gone anywhere yet — `page.evaluate`'s
 *  `fetch` needs a real page origin to run against, not Playwright's initial `about:blank`. */
export async function signInAsStaff(page: Page): Promise<void> {
  if (page.url() === 'about:blank') await page.goto('/staff/sign-in');
  await signInViaPageFetch(
    page,
    '/api/staff/auth/sign-in',
    accountsFixtureIds.adminIdentifier,
    accountsFixtureIds.adminPassword,
  );
}

/** Signs in as the seeded customer (`accountsFixtureIds.customerEmail`). Call once, before
 *  navigating to the first `/portal/**` route a test needs to already be authenticated for. Same
 *  `about:blank` note as `signInAsStaff` above. */
export async function signInAsCustomer(page: Page): Promise<void> {
  if (page.url() === 'about:blank') await page.goto('/sign-in');
  await signInViaPageFetch(
    page,
    '/api/auth/sign-in',
    accountsFixtureIds.customerEmail,
    accountsFixtureIds.customerPassword,
  );
}

/**
 * Holds every page `fetch` to `/api/` until MSW's worker reports ready, on every page of this
 * browser context. `app/providers.tsx` starts the worker in an effect AFTER first paint, while
 * children (the session guards, the first queries) fire their first request in their own effects,
 * which run first. The session hook's two 300 ms retries cover that gap only when the worker starts
 * quickly; on a busy machine or a long-running dev server it loses, the session read fails as a
 * network error, and the guard fails closed to sign-in. Reproduced by delaying the worker's
 * registration: 1500 ms bounces every time, 300 ms never does (HO-P5 Amended (ac),
 * `msw-start-race.spec.ts`). The timer is captured here, before any spec's `page.clock` can pause it.
 */
export async function holdApiUntilMswReady(page: Page): Promise<void> {
  await page.context().addInitScript(() => {
    const original = window.fetch.bind(window);
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const input = args[0];
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (/\/api\//.test(url)) {
        // 20 ms x 1500 = 30 s, counted rather than read from a clock a spec may have paused.
        for (
          let waits = 0;
          (window as unknown as { __mswReady?: boolean }).__mswReady !== true && waits < 1500;
          waits += 1
        ) {
          await new Promise((resolve) => nativeSetTimeout(resolve, 20));
        }
      }
      return original(...args);
    };
  });
}

export const test = base.extend({
  page: async ({ page }, runTest) => {
    // A real-API run has no worker, so the flag would never be set.
    if (process.env.NEXT_PUBLIC_USE_MOCKS !== 'false' && process.env.E2E_REAL_API !== '1') {
      await holdApiUntilMswReady(page);
    }

    const originalGoto = page.goto.bind(page);
    page.goto = (async (url: Parameters<Page['goto']>[0], options: Parameters<Page['goto']>[1]) => {
      const response = await originalGoto(url, options);
      await page
        .waitForFunction(() => Boolean(navigator.serviceWorker?.controller), undefined, {
          timeout: 15_000,
        })
        .catch(() => {
          /* best-effort — a route this app doesn't serve (e.g. a 404) never registers a
             controller; let the test's own assertions surface that instead of failing here. */
        });
      // The controller existing is necessary but not sufficient — MSW's own handler list still
      // has to reach the worker via postMessage after `worker.start()` resolves, which can take
      // a moment after the controller is assigned. `window.__mswReady` (set by app/providers.tsx
      // once `worker.start()` itself resolves) is the precise signal for that; best-effort and a
      // no-op in real-API mode (NEXT_PUBLIC_USE_MOCKS=false), where the flag is never set.
      await page
        .waitForFunction(
          () => (window as unknown as { __mswReady?: boolean }).__mswReady === true,
          undefined,
          {
            timeout: 10_000,
          },
        )
        .catch(() => {});
      return response;
    }) as Page['goto'];

    await runTest(page);
  },
});

export { expect };
