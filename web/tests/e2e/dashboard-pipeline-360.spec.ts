import { test, expect, signInAsStaff } from './fixtures';

// HO-P5 Amended (ah): the page-overflow checks cannot see a pipeline bar squeezed to a few pixels
// inside a panel that still fits the screen.
test('the pipeline bars keep a readable length at 360 px', async ({ page }) => {
  await signInAsStaff(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/staff');

  const list = page.getByRole('list', { name: 'Orders in progress by status' });
  const tracks = list.locator('li > a > span[aria-hidden="true"]');
  await expect(tracks).toHaveCount(4);

  const widths = await tracks.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  const listWidth = await list.evaluate((element) => element.getBoundingClientRect().width);
  for (const width of widths) expect(width).toBeGreaterThanOrEqual(listWidth * 0.8);
});
