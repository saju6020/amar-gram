import { test, expect, signInAsCustomer } from './fixtures';
import { orderingIds } from '../../mocks/handlers/ordering/fixtures';

// HO-P5 Amended (af): the page-overflow checks cannot see labels running into each other inside a
// card that still fits the screen.
test('the five tracker labels stay apart at 360 px', async ({ page }) => {
  await signInAsCustomer(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(`/portal/orders/${orderingIds.orders.dispatchedCod}`);

  const labels = page.getByRole('list', { name: 'Order progress steps' }).locator('strong');
  await expect(labels).toHaveCount(5);

  const boxes = await labels.evaluateAll((elements) =>
    elements.map((element) => {
      const { left, right } = element.getBoundingClientRect();
      return { left, right };
    }),
  );
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index - 1]!.right).toBeLessThanOrEqual(boxes[index]!.left);
  }
});
