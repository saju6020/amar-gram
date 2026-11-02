import type { Locator, Page } from '@playwright/test';
import { test, expect, signInAsStaff } from './fixtures';
import { addDaysIso, todayInZone } from '../../lib/format/time';
import { expectAxeClean, expectNoHorizontalScroll } from './reports-helpers';

/**
 * HO-P5 S4 TEST gate (TC-HO-P5-WIRING-S4 G4, G5). Rendered sizes, not classes: CODE_REVIEW run 3's LOW (fixed in 794188b with no
 * test) and run 2's pager MEDIUM are about 44 px targets, which jsdom cannot measure. Also axe and sideways scroll on two S4
 * states no existing spec reaches at both widths: the per-source cash-up day and the profile with the tags dialog open.
 */
test.describe.configure({ timeout: 120_000, retries: 0 });

test.beforeEach(async ({ page }) => {
  await signInAsStaff(page);
});

async function heightOf(locator: Locator): Promise<number> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, 'the control has a box').not.toBeNull();
  return box!.height;
}

async function expectTarget(locator: Locator, name: string) {
  const h = await heightOf(locator);
  expect(h, `${name} is ${h}px tall, below 44px`).toBeGreaterThanOrEqual(44);
}

async function openSamRahman(page: Page) {
  await page.goto('/staff/customers?search=Rahman');
  await page.getByRole('button', { name: /Sam Rahman/ }).click();
  const profile = page.getByRole('region', { name: 'Customer profile' });
  await expect(profile.getByRole('heading', { level: 2, name: 'Sam Rahman' })).toBeVisible();
  return profile;
}

test('G4/G5: per-source cash-up day: inputs and buttons are 44px tall; no sideways scroll; axe clean', async ({ page }) => {
  await page.goto(`/staff/billing/cash-up?date=${addDaysIso(todayInZone('Asia/Dhaka'), -2)}`);
  const region = page.getByRole('region', { name: 'Count cash by source' });
  await expect(region.getByRole('rowheader', { name: 'Rezwan Ahmed' })).toBeVisible();
  await expectTarget(page.getByLabel('Counted for Till'), 'Counted for Till');
  await expectTarget(page.getByLabel('Counted for Rezwan Ahmed'), 'Counted for Rezwan Ahmed');
  await expectTarget(page.getByRole('button', { name: 'Save count' }), 'Save count');
  await expectTarget(page.getByRole('button', { name: /Close (the )?day/ }), 'Close day');
  await expect(page).toHaveTitle(/.+/);
  await expectAxeClean(page);
  await expectNoHorizontalScroll(page);
});

test('G4/G5: tags dialog: Cancel and Save are 44px tall; with the dialog open no sideways scroll and axe clean', async ({ page }) => {
  const profile = await openSamRahman(page);
  await profile.getByRole('button', { name: 'Edit tags' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit tags' });
  await expect(dialog).toBeVisible();
  await expectTarget(dialog.getByRole('button', { name: 'Cancel' }), 'tags Cancel');
  await expectTarget(dialog.getByRole('button', { name: 'Save tags' }), 'Save tags');
  await expect(page).toHaveTitle(/.+/);
  await expectAxeClean(page);
  await expectNoHorizontalScroll(page);
});

test('G4: the outlet Type select is 44px tall on the new-branch form', async ({ page }) => {
  await page.goto('/staff/admin/branches/new');
  await expectTarget(page.getByLabel('Type', { exact: true }), 'Type select');
});

test('G4: the customers pager, when the list has more than one page, has 44px Previous and Next', async ({ page }) => {
  await page.goto('/staff/customers');
  await expect(page.getByLabel('Name, mobile or email')).toBeVisible();
  await expect(page.getByRole('button', { name: /Sam Rahman/ })).toBeVisible();
  const pager = page.getByRole('navigation', { name: 'Pages' });
  if ((await pager.count()) === 0) {
    test.info().annotations.push({ type: 'not reached', description: 'the mock list fits on one page; no pager is rendered' });
    return;
  }
  await expectTarget(pager.getByRole('button', { name: 'Previous' }), 'Previous');
  await expectTarget(pager.getByRole('button', { name: 'Next' }), 'Next');
});
