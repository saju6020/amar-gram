import { test, expect, signInAsStaff, secondStaff } from './fixtures';
import { accountsFixtureIds } from '../../mocks/handlers/areas/accounts';
import { expectAxeClean } from './reports-helpers';

/**
 * `tests/e2e/staff-auth.spec.ts` — US-ACC-08/US-ACC-14, HO-ACC-002 §16. §13 names this file. The
 * unit tests (`tests/components/staff/idle-lock.test.tsx`, "ARCH gate HIGH 1"/"ARCH gate HIGH
 * (second pass)") isolate the same bugs at the component level with a directly-seeded query cache
 * and a simulated `refetchQueries` call; these are the real-browser, end-to-end counterparts,
 * against real cookies and a real MSW-backed session lifecycle (idle-timeout detection, then the
 * session actually ending). `__invalidateQueries` (`app/providers.tsx`'s own test-only hook) is
 * what triggers `useStaffSession()`'s refetch deterministically — a real tab-refocus's own
 * `visibilitychange` event fires the identical `refetchOnWindowFocus` code path, just later and
 * non-deterministically; only the trigger differs, not what is being exercised.
 */

test('ARCH gate HIGH 1 (first pass): a window-refocus-triggered session_idle_timeout locks in place, in a real browser, without redirecting or losing unsaved input', async ({
  page,
}) => {
  test.setTimeout(45_000);

  await signInAsStaff(page);
  await page.goto('/staff/customers/new');

  const fullNameField = page.getByLabel(/full name/i);
  await fullNameField.fill('Unsaved draft customer');

  const cookies = await page.context().cookies();
  const staffSessionCookie = cookies.find((c) => c.name === 'pc_staff_session');
  expect(
    staffSessionCookie,
    'pc_staff_session cookie must exist after signing in as staff',
  ).toBeTruthy();
  const token = staffSessionCookie!.value;

  // mocks/handlers/areas/accounts.ts's own test-only escape hatch (its own comment names this
  // spec) — forces the NEXT `GET /api/staff/session` read to report `session_idle_timeout`,
  // without needing to fast-forward a real 30-minute idle window.
  await page.evaluate((forcedToken) => {
    (
      window as unknown as { __forceStaffIdleExpired?: (t: string) => void }
    ).__forceStaffIdleExpired?.(forcedToken);
  }, token);

  // CODE_REVIEW suggestion (second pass) — this used to wait out `useStaffSession()`'s real 10s
  // `staleTime` with `page.waitForTimeout(11_000)` before dispatching a real tab-refocus
  // `visibilitychange` event (`@tanstack/query-core`'s own `FocusManager` listens for that
  // specifically, on `window`, not `document`, and not a `focus` event — confirmed by reading
  // `node_modules/@tanstack/query-core/build/modern/focusManager.js` directly). `__invalidateQueries`
  // (`app/providers.tsx`'s own test-only hook, gated the same way `__apiBaseUrl` is) marks the
  // query stale and refetches it immediately instead — deterministic, no real wait needed. Still
  // exercises the exact same `useStaffSession()`/`refetchOnWindowFocus` code path, not a shortcut
  // around it — only the trigger that makes the data "stale enough to refetch" is different.
  await page.evaluate(() => {
    (
      window as unknown as { __invalidateQueries?: (queryKey: readonly unknown[]) => void }
    ).__invalidateQueries?.(['session', 'staff']);
  });

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading')).toContainText(/signed out after/i);

  // Never redirected to /staff/sign-in — StaffSessionGuard kept the page (and IdleLock, and this
  // form) mounted throughout, per ARCH gate HIGH 1's own fix.
  await expect(page).toHaveURL(/\/staff\/customers\/new/);
  await expect(fullNameField).toHaveValue('Unsaved draft customer');

  // Re-authenticate as the SAME staff member — the dialog closes and the draft is still there.
  await dialog.getByLabel(/mobile number or email/i).fill(accountsFixtureIds.adminIdentifier);
  await dialog.getByLabel(/^password/i).fill(accountsFixtureIds.adminPassword);
  await dialog.getByRole('button', { name: /^sign in$/i }).click();

  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/staff\/customers\/new/);
  await expect(fullNameField).toHaveValue('Unsaved draft customer');
});

test('ARCH gate HIGH (second pass): once locked, a later session_invalid (the real API behaviour after it ends the idle session) still never redirects or unmounts the form — in a real browser', async ({
  page,
}) => {
  test.setTimeout(45_000);

  await signInAsStaff(page);
  await page.goto('/staff/customers/new');

  const fullNameField = page.getByLabel(/full name/i);
  await fullNameField.fill('Unsaved across the whole cycle');

  const cookies = await page.context().cookies();
  const staffSessionCookie = cookies.find((c) => c.name === 'pc_staff_session');
  expect(staffSessionCookie).toBeTruthy();
  const token = staffSessionCookie!.value;

  // Step 1: lock, the same way as the ARCH gate HIGH 1 (first pass) test above. The mock now ends
  // the session on THIS detection (mirroring SessionAuthenticationMiddleware's
  // EndForIdleTimeout + ExpireStaffSession) — every later call reports session_invalid, not
  // session_idle_timeout again.
  await page.evaluate((forcedToken) => {
    (
      window as unknown as { __forceStaffIdleExpired?: (t: string) => void }
    ).__forceStaffIdleExpired?.(forcedToken);
  }, token);
  // CODE_REVIEW suggestion (second pass) — `__invalidateQueries` (`app/providers.tsx`'s own
  // test-only hook) replaces the real `page.waitForTimeout(11_000)` + `visibilitychange` pair the
  // ARCH gate HIGH 1 (first pass) test above still explains in full; see that test's own comment.
  await page.evaluate(() => {
    (
      window as unknown as { __invalidateQueries?: (queryKey: readonly unknown[]) => void }
    ).__invalidateQueries?.(['session', 'staff']);
  });

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading')).toContainText(/signed out after/i);

  // Step 2: "tab away, then back" a second time — another focus-triggered refetch of the SAME
  // ['session','staff'] query, now resolving to session_invalid (the mock already deleted the
  // session and expired the cookie on step 1's response). Must not redirect or unmount.
  await page.evaluate(() => {
    (
      window as unknown as { __invalidateQueries?: (queryKey: readonly unknown[]) => void }
    ).__invalidateQueries?.(['session', 'staff']);
  });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/staff\/customers\/new/);
  await expect(fullNameField).toHaveValue('Unsaved across the whole cycle');

  // Step 3: a real activity heartbeat (POST /api/staff/session/activity) is the OTHER path into
  // IdleLock's own client.ts handler — it too now 401s session_invalid, since the session is gone.
  // Must also stay locked. Dispatched directly on the still-mounted, still-locked-behind field
  // (rather than a Locator interaction, which Playwright's own actionability check would refuse —
  // the lock overlay sits on top of it, `fixed inset-0 z-50`) — the listener only cares that an
  // `input`/`keydown`/`pointerdown` event reached `document`, not how it got there.
  await page.evaluate(() => {
    document.getElementById('fullName')?.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/staff\/customers\/new/);
  await expect(fullNameField).toHaveValue('Unsaved across the whole cycle');

  // Step 4: only re-authenticating as the SAME staff member unlocks it — the draft is still there.
  await dialog.getByLabel(/mobile number or email/i).fill(accountsFixtureIds.adminIdentifier);
  await dialog.getByLabel(/^password/i).fill(accountsFixtureIds.adminPassword);
  await dialog.getByRole('button', { name: /^sign in$/i }).click();

  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/staff\/customers\/new/);
  await expect(fullNameField).toHaveValue('Unsaved across the whole cycle');
});

test('ARCHITECTURE gate third pass, HIGH: on a page WITH its own page query (staff account detail), lock -> refocus -> that page query 401s too -> the changed-role draft survives -> unlock -> draft intact — in a real browser', async ({
  page,
}) => {
  test.setTimeout(45_000);

  await signInAsStaff(page);
  await page.goto(`/staff/admin/staff-accounts/${secondStaff.staffId}`);

  // A changed role selection — the unsaved draft this test protects. Another staff member's detail
  // page (not the signed-in administrator's own account) so nothing about "editing your own roles" is
  // special-cased into this assertion.
  const administratorRole = page.getByRole('checkbox', { name: 'Administrator' });
  await administratorRole.check();
  await expect(administratorRole).toBeChecked();

  const cookies = await page.context().cookies();
  const staffSessionCookie = cookies.find((c) => c.name === 'pc_staff_session');
  expect(staffSessionCookie).toBeTruthy();
  const token = staffSessionCookie!.value;

  // Forces the session to end (mirroring the real API's own EndForIdleTimeout on first detection —
  // every later call, including this page's own GET /api/staff-accounts/:id, 401s session_invalid
  // from here on, through the exact same `requireAction` check every staff-audience endpoint uses).
  await page.evaluate((forcedToken) => {
    (
      window as unknown as { __forceStaffIdleExpired?: (t: string) => void }
    ).__forceStaffIdleExpired?.(forcedToken);
  }, token);

  // A real window-focus event refetches every stale active query at once — the session query AND
  // this page's own `['staff-admin','staff-account',id]` query. `__invalidateQueries` triggers both
  // deterministically, the same way the tests above trigger the session query alone.
  await page.evaluate(() => {
    const invalidate = (
      window as unknown as { __invalidateQueries?: (queryKey: readonly unknown[]) => void }
    ).__invalidateQueries;
    invalidate?.(['session', 'staff']);
    invalidate?.(['staff-admin', 'staff-account']);
  });

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading')).toContainText(/signed out after/i);

  // The page never swapped to ErrorState — `getByRole` (unlike `getByLabel`) respects
  // `aria-hidden`, which Radix's own modal Dialog correctly applies to the rest of the page while
  // open, so the checkbox's checked state is read directly rather than through a role query here.
  await expect(page.getByLabel('Administrator')).toBeChecked();
  await expect(page.getByText(/couldn't load this account/i)).not.toBeVisible();

  // Unlock via re-authentication as the same person — the draft is still there.
  await dialog.getByLabel(/mobile number or email/i).fill(accountsFixtureIds.adminIdentifier);
  await dialog.getByLabel(/^password/i).fill(accountsFixtureIds.adminPassword);
  await dialog.getByRole('button', { name: /^sign in$/i }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('checkbox', { name: 'Administrator' })).toBeChecked();
});

test('ARCHITECTURE gate fifth pass, MEDIUM: locking while genuinely offline does not deadlock re-sign-in, in a real browser', async ({
  page,
}) => {
  test.setTimeout(45_000);

  // Real-browser counterpart to `idle-lock.test.tsx`'s "locking while already offline does not
  // deadlock the re-sign-in mutation" (jsdom-level, `onlineManager.setOnline(false)` directly).
  // `context.setOffline(true)` fires a REAL `offline` event on `window` and flips
  // `navigator.onLine` in this actual browser — the exact signal `onlineManager`'s own default
  // listener reads, not a simulated one — closing the ARCHITECTURE gate fifth pass's own request
  // for this variant.
  await signInAsStaff(page);
  await page.goto('/staff/customers/new');

  const fullNameField = page.getByLabel(/full name/i);
  await fullNameField.fill('Unsaved draft while offline');

  const cookies = await page.context().cookies();
  const staffSessionCookie = cookies.find((c) => c.name === 'pc_staff_session');
  expect(staffSessionCookie).toBeTruthy();
  const token = staffSessionCookie!.value;

  // Offline BEFORE the lock engages — the terminal was already disconnected the instant idle
  // detection fired (Wi-Fi dropped, lid closed), the scenario the fifth-pass fix targets.
  await page.context().setOffline(true);

  await page.evaluate((forcedToken) => {
    (
      window as unknown as { __forceStaffIdleExpired?: (t: string) => void }
    ).__forceStaffIdleExpired?.(forcedToken);
  }, token);
  // NOT `__invalidateQueries` (used by every OTHER lock test in this file): that drives
  // `useStaffSession()`'s own refetch, a `useQuery` observer with the default
  // `networkMode: 'online'` — correctly paused while `onlineManager` reports offline (the real
  // `offline` event above already flipped it), so it would never even attempt the request and
  // this test would hang waiting for a dialog that never appears, regardless of the fix under
  // test. `__apiFetch` (`app/providers.tsx`) is a raw call, bypassing that gate entirely, the
  // same way the local idle-countdown timer (also network-independent) reaches `lockNow()` in
  // production — see that hook's own comment. `/api/staff-roles` is an arbitrary
  // already-idle-checked staff endpoint, standing in for "any staff-audience call", exactly like
  // `idle-lock.test.tsx`'s own `/api/some-unrelated-staff-endpoint`.
  await page.evaluate(() => {
    (window as unknown as { __apiFetch?: (path: string) => Promise<unknown> })
      .__apiFetch?.('/api/staff-roles')
      .catch(() => {});
  });

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(fullNameField).toHaveValue('Unsaved draft while offline');

  // Reconnect, then re-authenticate — without `networkMode: 'always'` on the re-sign-in mutation
  // and the resync this round added, `onlineManager.isOnline()` would stay frozen `false` for the
  // whole lock and this mutation would never even start (a genuine deadlock).
  await page.context().setOffline(false);

  await dialog.getByLabel(/mobile number or email/i).fill(accountsFixtureIds.adminIdentifier);
  await dialog.getByLabel(/^password/i).fill(accountsFixtureIds.adminPassword);
  await dialog.getByRole('button', { name: /^sign in$/i }).click();

  await expect(dialog).toBeHidden();
  await expect(fullNameField).toHaveValue('Unsaved draft while offline');
});

test('E6: the staff sign-in page is the leaf full-bleed frame with the h1 "Staff sign in"', async ({
  page,
}) => {
  await page.goto('/staff/sign-in');
  await expect(page.getByRole('heading', { level: 1, name: 'Staff sign in' })).toBeVisible();
  await expect(page.getByTestId('staff-auth-frame')).toHaveClass(/bg-leaf-ink/);
  await expect(page.getByText(/Staff and customer accounts are separate/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expectAxeClean(page);
});
