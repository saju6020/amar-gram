import { test, expect, signInAsCustomer } from './fixtures';

// HO-P5 Amended (ac): a slow MSW start must not read as a lost session. Without the fixture's hold,
// this delay sends the customer to /sign-in every time.
test('a signed-in customer stays signed in when the mock worker starts slowly', async ({ page }) => {
  await signInAsCustomer(page);
  await page.addInitScript(() => {
    const original = ServiceWorkerContainer.prototype.register;
    ServiceWorkerContainer.prototype.register = function (...args) {
      return new Promise((resolve) => setTimeout(resolve, 3000)).then(() =>
        original.apply(this, args),
      ) as ReturnType<typeof original>;
    };
  });

  await page.goto('/portal/account/profile');

  await expect(page.getByLabel('Full name')).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/portal\/account\/profile$/);
});
