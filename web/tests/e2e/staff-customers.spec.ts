import { test, expect, signInAsStaff } from './fixtures';
import { accountsFixtureIds } from '../../mocks/handlers/areas/accounts';
import { expectAxeClean, expectNoHorizontalScroll } from './reports-helpers';

/** Walk-in registration and duplicate merge — HO-ACC-002 §16 E-H/E-I series, run against MSW. */

test.beforeEach(async ({ page }) => {
  await signInAsStaff(page);
});

test('E-H1: walk-in with a new number creates Incomplete; an existing number offers the existing record', async ({
  page,
}) => {
  await page.goto('/staff/customers/new');
  await page.getByLabel(/full name/i).fill('Kamal Walk-in');
  await page.getByLabel(/mobile number/i).fill('01766612345');
  await page.getByRole('button', { name: 'Register customer' }).click();

  await expect(page).toHaveURL(/\/staff\/customers\/[^/]+$/);
  await expect(page.getByText('Incomplete')).toBeVisible();

  await page.goto('/staff/customers/new');
  await page.getByLabel(/full name/i).fill('Duplicate Walk-in');
  await page.getByLabel(/mobile number/i).fill(accountsFixtureIds.dupMobileNoEmail);
  await page.getByRole('button', { name: 'Register customer' }).click();

  await expect(page.getByText(/this mobile number is already registered/i)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Existing Customer' })).toBeVisible();
  await expect(page.getByLabel(/full name/i)).toHaveValue('Duplicate Walk-in');
});

test('E-I1: merge a duplicate pair — the chosen record survives', async ({ page }) => {
  await page.goto('/staff/customers/duplicates');
  await expect(page.getByText('Duplicate Alpha')).toBeVisible();

  await page.getByRole('link', { name: 'Review merge' }).click();
  await expect(page).toHaveURL(/\/staff\/customers\/duplicates\/review\?ids=/);

  await page.getByRole('radio', { name: /Duplicate Alpha/ }).check();
  await page.getByLabel(/reason/i).fill('Confirmed the same person by phone.');
  await page.getByRole('button', { name: 'Review merge' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Duplicate Alpha will be kept/i)).toBeVisible();
  await dialog.getByRole('button', { name: 'Merge', exact: true }).click();

  await expect(page.getByText(/the records have been merged/i)).toBeVisible();
  await page.getByRole('link', { name: 'View the surviving record' }).click();
  await expect(page.getByText('Duplicate Alpha').first()).toBeVisible();
});

test('E5: /staff/customers — search by mobile, select, see the profile, "New order" opens the counter for that customer', async ({
  page,
}) => {
  await page.goto('/staff/customers');
  await expect(page.getByRole('heading', { level: 1, name: 'Customers' })).toBeVisible();
  // HO-P5 BG-19: the left column is the browsable list, so everyone is listed before any search.
  await expect(page.getByRole('button', { name: /Sam Rahman/ })).toBeVisible();

  await page.getByLabel('Name, mobile or email').fill(accountsFixtureIds.customerMobile);
  await page.getByLabel('Name, mobile or email').press('Enter');
  await expect(page).toHaveURL(/search=01799999999/);

  await page.getByRole('button', { name: /Sam Rahman/ }).click();
  await expect(page).toHaveURL(new RegExp(`customer=${accountsFixtureIds.customerId}`));
  await expect(page.getByRole('heading', { level: 2, name: 'Sam Rahman' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Orders' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Billing' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Notes/ })).toBeVisible();

  await expectAxeClean(page);
  await expectNoHorizontalScroll(page);

  await page.getByRole('link', { name: 'New order' }).click();
  await expect(page).toHaveURL(/\/staff\/pos\?customerId=/);
});

// HO-P5 §16 E13 (BG-19, US-ACC-10/11): search by name, read the server's summary, add a note, edit the tags, send a password
// reset and see only the masked destination.
test('E13: search by name → lifetime spend; add a note; edit tags; send a password reset → masked destination', async ({
  page,
}) => {
  await page.goto('/staff/customers');
  await page.getByLabel('Name, mobile or email').fill('Rahman');
  await page.getByLabel('Name, mobile or email').press('Enter');
  await expect(page).toHaveURL(/search=Rahman/);
  await page.getByRole('button', { name: /Sam Rahman/ }).click();

  const profile = page.getByRole('region', { name: 'Customer profile' });
  await expect(profile.getByRole('heading', { level: 2, name: 'Sam Rahman' })).toBeVisible();
  await expect(profile.getByRole('heading', { level: 3, name: 'Lifetime spend' })).toBeVisible();
  await expect(profile.getByText('৳4,250.00').first()).toBeVisible();
  await expect(profile.getByRole('heading', { level: 3, name: 'Orders' })).toBeVisible();
  await expect(profile.getByRole('list', { name: 'Tags' })).toContainText('Regular');

  // Notes: the seeded one is there; add another.
  await profile.getByRole('tab', { name: 'Notes (1)' }).click();
  await expect(profile.getByText('Prefers delivery after 5pm. Call the guard at the gate.')).toBeVisible();
  await profile.getByLabel('Add a note').fill('Asked for a Friday delivery <b>not bold</b>');
  await profile.getByRole('button', { name: 'Add note' }).click();
  // Shown as typed: the markup is text.
  await expect(profile.getByText('Asked for a Friday delivery <b>not bold</b>')).toBeVisible();
  await expect(profile.getByRole('tab', { name: 'Notes (2)' })).toBeVisible();

  // Tags: add one; the chips show the set the server stored.
  await profile.getByRole('button', { name: 'Edit tags' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit tags' });
  await dialog.getByLabel('Add a tag').fill('Wholesale');
  await dialog.getByLabel('Add a tag').press('Enter');
  await dialog.getByRole('button', { name: 'Save tags' }).click();
  await expect(dialog).toBeHidden();
  await expect(profile.getByRole('list', { name: 'Tags' })).toContainText('Wholesale');

  // Password reset: a confirm, then the channel and the masked destination only.
  await profile.getByRole('button', { name: 'Send password reset' }).click();
  await expect(page.getByRole('dialog')).toContainText('Send a password reset link to Sam Rahman? It goes to their own mobile or email.');
  await page.getByRole('dialog').getByRole('button', { name: 'Send reset link' }).click();
  await expect(profile.getByText(/Reset link sent by mobile to \*\*\*999\. It expires at/)).toBeVisible();

  await expectAxeClean(page);
  await expectNoHorizontalScroll(page);
});

test('E13: the list filters by tag and sorts by name', async ({ page }) => {
  await page.goto('/staff/customers');
  await page.getByLabel('Tag').selectOption('Regular');
  await expect(page).toHaveURL(/tag=Regular/);
  await expect(page.getByRole('button', { name: /Sam Rahman/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Existing Customer/ })).toHaveCount(0);
  await page.getByLabel('Tag').selectOption('');
  await page.getByLabel('Sort by').selectOption('name');
  await expect(page).toHaveURL(/sort=name/);
});
