import { test, expect as baseExpect, signInAsCustomer, signInAsStaff } from './fixtures';
import { control } from './ordering-helpers';
import { orderingIds as ids } from '../../mocks/handlers/ordering/fixtures';

const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ timeout: 120_000 });

/**
 * HO-P5 integration (E18): the customer-side `Packed` state reached through a REAL staff
 * transition, not a seeded or hand-edited order. S1's ACCEPTANCE could only see it by editing the
 * persisted mock database (no Packed transition existed before S2); S2's ACCEPTANCE moved the order
 * on the staff side but opened no customer page. Here staff press Start packing then Mark packed on
 * ORD-2026-000104 (the seeded customer's order), and the same browser then signs in as that customer
 * and opens the order: the headline is S1's "Your order is packed" (Amended (q)), and at 360 px the
 * page does not scroll sideways.
 */
test('a Packed order, packed by staff, reads "Your order is packed" on the customer order page', async ({
  page,
}) => {
  const orderId = ids.orders.confirmedCod;
  await page.goto('/staff/sign-in');
  await control(page, 'reset');
  await signInAsStaff(page);

  await page.goto(`/staff/orders/${orderId}`);
  await page.getByRole('button', { name: 'Start packing' }).click();
  const actions = page.getByRole('group', { name: 'Order actions' });
  await actions.getByRole('button', { name: 'Mark packed' }).click();
  await expect(actions.getByRole('button', { name: 'Mark packed' })).toHaveCount(0);
  await expect(actions.getByRole('button', { name: 'Dispatch' })).toBeVisible();

  await signInAsCustomer(page);
  await page.goto(`/portal/orders/${orderId}`);
  await expect(page.getByText('Your order is packed').first()).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'customer order page scrolls sideways').toBeLessThanOrEqual(0);
});
