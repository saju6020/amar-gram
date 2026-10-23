import { test, expect, signInAsStaff } from './fixtures';

// ARCH gate MEDIUM (first pass) — signs in as staff only (never both cookies at
// once, tests/e2e/fixtures.ts); every route this file visits is staff-audience.
test.beforeEach(async ({ page }) => {
  await signInAsStaff(page);
});

/**
 * Staff shell TEST gate, sixth pass — MEDIUM, now fixed by the 7th pass's Radix-`Dialog` rebuild.
 *
 * Original finding: `bb24673`'s fix made the header/`<main>` column `inert` while the hand-rolled
 * drawer was open, but `<Toaster />` (`app/providers.tsx`) is rendered once at the root layout, a
 * sibling of `StaffShell`'s entire tree, and its portalled `ToastViewport` sat entirely outside the
 * subtree that fix could reach — so a live toast's real `<button aria-label="Dismiss">` stayed
 * fully Tab-reachable while the drawer was open. Exactly the risk of an `inert`-on-specific-siblings
 * approach: it only protects whatever it explicitly wraps.
 *
 * The 7th pass's Radix `Dialog` doesn't have this gap, structurally: its `FocusScope` traps
 * Tab/Shift+Tab by intercepting the keydown at the document level, not by walking the DOM to find
 * and mark every sibling `inert` — it doesn't matter that `ToastViewport` portals to `document.body`
 * outside `StaffShell`'s own render tree, because the trap isn't scoped to that tree either. This
 * file is kept, unchanged in what it exercises, as the permanent regression test for this — it now
 * watches the fix hold rather than watching the bug fail.
 *
 * The toast's Dismiss button is located by its `aria-label` attribute, not `getByRole`, for the
 * same reason `staff-shell-sheet-helpers.ts` resolves the sheet's own trigger that way: once the
 * sheet is open, Radix's `modal` behaviour marks the toast (everything outside the sheet's own
 * portal) `aria-hidden="true"`, which a role query would correctly refuse to find — this is the fix
 * being verified, not a reason the setup check should time out.
 */
test('a live toast is not reachable by Tab while the StaffShell nav sheet is open (staff shell TEST gate, 6th pass, fixed 7th pass)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto('/staff/admin/retention');
  await page.waitForLoadState('networkidle');

  // Any action that raises a toast will do; requesting a retention run is a one-click one.
  await page.getByRole('button', { name: 'Run retention now' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Run retention' }).click();
  await expect(page.getByText('Retention run requested').first()).toBeVisible();

  const trigger = page.getByRole('button', { name: 'Expand menu' });
  await trigger.focus();
  await trigger.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();

  const dismissButton = page.locator('[aria-label="Dismiss"]');
  await expect(
    dismissButton,
    'setup: the toast must still be visible when the sheet opens',
  ).toBeVisible();

  let reachedDismiss = false;
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    reachedDismiss = await page.evaluate(
      () => document.activeElement?.getAttribute('aria-label') === 'Dismiss',
    );
    if (reachedDismiss) break;
  }

  expect(
    reachedDismiss,
    '§8.5: nothing outside the sheet should be Tab-reachable while it is open, including a live toast',
  ).toBe(false);
});
