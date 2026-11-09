import { test, expect, signInAsStaff } from './fixtures';
import { shopFixtureIds } from '../../mocks/handlers/shop';
import { expectNoHorizontalScroll } from './reports-helpers';

// HO-P5 Amended (ap): S3 ACCEPTANCE F1. An uploaded certificate's file name never wraps, and the
// fieldset's default min-width let it widen the Food & labelling page by 155 px at 360.
test.beforeEach(async ({ page }) => {
  await signInAsStaff(page);
  await page.setViewportSize({ width: 360, height: 780 });
});

test('an uploaded certificate file does not scroll the food page sideways', async ({ page }) => {
  test.setTimeout(90_000);
  const name = 'organic-certificate-scan-bangladesh-standards-2026-final.pdf';
  await page.goto(`/staff/shop/products/${shopFixtureIds.multiVariantProductId}/food`);
  await page.getByRole('button', { name: 'Remove file' }).click();
  await page.locator('input#fd-cert-file').setInputFiles({
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
  });
  await expect(page.getByRole('button', { name: `Remove ${name}` })).toBeVisible({ timeout: 20_000 });
  await expectNoHorizontalScroll(page);
});
