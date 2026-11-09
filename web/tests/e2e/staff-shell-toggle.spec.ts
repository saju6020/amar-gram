import { test, expect, signInAsStaff } from './fixtures';
import { administrationFixtureIds } from '../../mocks/handlers/admin';

// ARCH gate MEDIUM (first pass) — signs in as staff only (never both cookies at
// once, tests/e2e/fixtures.ts); every route this file visits is staff-audience.
test.beforeEach(async ({ page }) => {
  await signInAsStaff(page);
});

/**
 * Staff shell TEST gate, second pass, updated for the 7th pass's Radix-`Dialog` rebuild of the
 * below-`sm` drawer.
 *
 * Original finding (`dbba453` era): the toggle's first click unmounted a two-button `<Fragment>`
 * and mounted a single `<Button>` in its place, so the browser dropped keyboard focus to `<body>`.
 * Fixed by making both per-viewport controls always-mounted, CSS-hidden rather than swapped —
 * unchanged by the 7th pass's rebuild, and still the reason this file exists.
 *
 * What each control *does* on click did change in the 7th pass: below `sm`, `StaffShell`'s
 * `<aside>` can no longer widen at all (it's always the w-16 rail — see `staff-shell.tsx`'s own
 * top comment), so the below-`sm` control now opens a full Radix `Dialog` sheet instead of
 * expanding the aside in place. At `sm` and up, the control is exactly what it always was: the
 * in-flow collapse/expand toggle. The contract this file checks — first activation must not drop
 * keyboard focus to `<body>` — holds, and is if anything strengthened at 360px: Radix moves focus
 * into the sheet's own content rather than leaving it on the toggle or losing it altogether.
 */
test.describe('StaffShell sidebar toggle — keyboard focus (staff shell TEST gate, 2nd pass)', () => {
  for (const width of [360, 1440]) {
    test(`first activation of the toggle keeps keyboard focus @ ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/staff/orders');
      await page.waitForLoadState('networkidle');

      // Tab until focus reaches whichever toggle is visible/focusable at this width — CSS hides
      // its sibling (`display: none`), which also removes it from the tab order.
      let reachedToggle = false;
      for (let i = 0; i < 15 && !reachedToggle; i++) {
        await page.keyboard.press('Tab');
        const label = await page.evaluate(
          () => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? null,
        );
        reachedToggle = label === 'Expand menu' || label === 'Collapse menu';
      }
      expect(reachedToggle).toBe(true);

      await page.keyboard.press('Enter');

      // This is the assertion that failed before `7304f85`: focus should still be on *some*
      // element that is part of the page's normal interactive flow (at minimum, not <body> — the
      // browser's "nothing is focused" fallback), so a keyboard/screen-reader user doesn't lose
      // their place. Below sm this is now Radix moving focus into the opened sheet; at sm+ it's
      // still the same toggle button, unmoved.
      const activeIsBody = await page.evaluate(() => document.activeElement === document.body);
      expect(activeIsBody, "focus fell back to <body> after the toggle's first activation").toBe(
        false,
      );

      if (width < 640) {
        await expect(page.getByRole('dialog')).toBeVisible();
      } else {
        // Its accessible name just flipped ("Collapse menu" -> "Expand menu"), so re-querying by
        // the pre-click name would find nothing — check the live focused element directly instead.
        const stillOnToggle = await page.evaluate(() => {
          const active = document.activeElement;
          return active instanceof HTMLElement && active.hasAttribute('aria-expanded');
        });
        expect(stillOnToggle, 'focus should stay on the toggle itself, not move elsewhere').toBe(
          true,
        );
      }
    });
  }
});

/**
 * HO-P4 E2 (§8.2, ADR-FE-182): at 360px the page does not scroll sideways, "Sign out" is on the slim top bar,
 * and the sheet opens with the outlet picker on top when the member of staff has 2+ branches. At
 * desktop width the same picker and "Sign out" live in the sidebar.
 */
test.describe('StaffShell — back-office sidebar (HO-P4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/staff/branches/mine', async (route) => {
      await route.fulfill({
        json: {
          branchIds: [
            administrationFixtureIds.mainBranchId,
            administrationFixtureIds.londonBranchId,
          ],
          primaryBranchId: administrationFixtureIds.mainBranchId,
          activeBranchId: administrationFixtureIds.mainBranchId,
          activeBranchRefusal: null,
        },
      });
    });
  });

  test('@360px: no horizontal scroll, Sign out visible, the sheet has the outlet picker on top', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto('/staff/orders');
    await page.waitForLoadState('networkidle');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

    await page.getByRole('button', { name: 'Expand menu' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    const picker = sheet.getByRole('combobox', { name: 'Outlet' });
    await expect(picker).toBeVisible();
    // On top: nothing of the nav sits above it inside the sheet.
    const pickerTop = (await picker.boundingBox())!.y;
    const firstLinkTop = (await sheet.getByRole('button', { name: 'Overview' }).boundingBox())!.y;
    expect(pickerTop).toBeLessThan(firstLinkTop);
  });

  test('@1440px: the outlet picker and Sign out are in the sidebar, with the design groups', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/staff/orders');
    await page.waitForLoadState('networkidle');

    const aside = page.locator('aside');
    await expect(aside.getByRole('combobox', { name: 'Outlet' })).toBeVisible();
    await expect(aside.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(1);
    await expect(aside.getByRole('button', { name: 'Sales' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(aside.getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
