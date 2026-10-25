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
  await expect(page.getByText('Search by mobile number or email.')).toBeVisible();

  await page.getByLabel('Mobile number or email').fill(accountsFixtureIds.customerMobile);
  await page.getByLabel('Mobile number or email').press('Enter');
  await expect(page).toHaveURL(/q=01799999999/);

  await page.getByRole('button', { name: /Sam Rahman/ }).click();
  await expect(page).toHaveURL(new RegExp(`customer=${accountsFixtureIds.customerId}`));
  await expect(page.getByRole('heading', { level: 2, name: 'Sam Rahman' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Orders' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Billing' })).toBeVisible();

  await expectAxeClean(page);
  await expectNoHorizontalScroll(page);

  await page.getByRole('link', { name: 'New order' }).click();
  await expect(page).toHaveURL(/\/staff\/pos\?customerId=/);
});
