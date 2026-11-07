import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoodsReceiptForm } from '@/components/inventory/GoodsReceiptForm';
import { ApiValidationError } from '@/lib/api/client';
import type { SkuLookup, StockLocation } from '@/lib/api/inventory-lookup';
import { renderWithClient } from '../inventory/testUtils';

// These render whole screens (a form, a customers list with its profile) with MSW and real user-event typing: ~2 s
// alone, but 5 s+ when the machine is loaded (HO-P4 ACCEPTANCE: the customer search case took 24.7 s under load).
// A generous per-test limit keeps load from failing them; it does not slow a passing run.
// Measured 2026-11-07 on an unloaded machine, this file alone: slowest test 2.0 s (the rest well under 1 s), so 30 s is about 15x headroom, not a normal duration.
vi.setConfig({ testTimeout: 30_000 });

vi.mock('next/navigation', async () => {
  const { navigation } = await import('../inventory/testUtils');
  return {
    useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
    usePathname: () => navigation.pathname,
    useSearchParams: () => navigation.search,
  };
});

const locations: StockLocation[] = [
  { id: 'wh', code: 'WH1', name: 'Main warehouse', kind: 'Warehouse', isActive: true, permittedMovements: ['Receipt'] },
];
const sku = (id: string, code: string, name: string, barcode: string): SkuLookup => ({
  skuId: id,
  productId: `p-${id}`,
  skuCode: code,
  displayName: name,
  barcode,
  stockClass: 'Food',
  expiryRequired: true,
  stockUnit: 'bags',
  allowsFractionalQuantity: false,
  countryOfOriginCode: 'DE',
  isActive: true,
  storage: null,
});
const rice = sku('k1', 'FD-RCE-5KG', 'Organic rice', '4006381333931');
const lentils = sku('k2', 'FD-LNT-1KG', 'Red lentils', '5012345678900');

function setup(overrides: Partial<React.ComponentProps<typeof GoodsReceiptForm>> = {}) {
  const onScan = vi.fn(async (barcode: string) => [rice, lentils].find((s) => s.barcode === barcode) ?? null);
  const utils = renderWithClient(
    <GoodsReceiptForm
      draftId="11111111-1111-4111-8111-111111111111"
      onDiscardDraft={vi.fn().mockResolvedValue(undefined)}
      locations={locations}
      purchaseOrders={[]}
      consignments={[{ id: 'cn-1', reference: 'CN-1', shipmentReference: 'SH-9' } as never]}
      purchaseOrderLines={null}
      onPurchaseOrderChange={() => undefined}
      onScan={onScan}
      onPost={vi.fn().mockResolvedValue(undefined)}
      isPosting={false}
      timeZoneLabel="Asia/Dhaka"
      {...overrides}
    />,
  );
  return { user: userEvent.setup({ delay: 0 }), ...utils };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('U32 — goods receipt layout', () => {
  it('has no "Receive into" select for a person in one branch (HO-P5 OQ-13; two or more is in receipt-drafts.test.tsx)', () => {
    setup();
    expect(screen.queryByLabelText(/receive into/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/delivery reference/i)).toBeInTheDocument();
    expect(screen.getByText('Received on')).toBeInTheDocument();
  });

  it('links a consignment receipt to its Documents and Costs tabs', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('radio', { name: /against a consignment/i }));
    await user.selectOptions(screen.getByLabelText(/^consignment/i), 'cn-1');
    expect(screen.getByRole('link', { name: 'Documents' })).toHaveAttribute(
      'href',
      '/staff/procurement/consignments/cn-1/documents',
    );
    expect(screen.getByRole('link', { name: 'Costs' })).toHaveAttribute(
      'href',
      '/staff/procurement/consignments/cn-1/costs',
    );
  });

  it('puts Lines[1].ExpiresOn inline on line 2 with aria-invalid and reports the result in the live message', async () => {
    const onPost = vi.fn().mockRejectedValue(
      new ApiValidationError({
        isValid: false,
        errors: [
          {
            propertyName: 'Lines[1].ExpiresOn',
            errorCode: 'ExpiryDateRequired',
            errorMessage: 'Food and other perishables must be received with an expiry date.',
            resourceName: 'Inventory',
          },
        ],
      }),
    );
    const { user } = setup({ onPost });
    for (const barcode of [rice.barcode!, lentils.barcode!]) {
      await user.type(screen.getByLabelText(/scan a barcode/i), `${barcode}{Enter}`);
    }
    const line2 = await screen.findByRole('listitem', { name: /line 2: red lentils/i });
    await screen.findByRole('listitem', { name: /line 1: organic rice/i });
    const lines = screen.getAllByRole('listitem', { name: /^line \d/i });
    for (const line of lines) {
      await user.type(within(line).getByLabelText(/^accepted/i), '5');
      await user.type(within(line).getByLabelText(/lot number/i), 'L1');
      await user.type(within(line).getByLabelText(/^unit cost/i), '10');
    }
    await user.type(within(lines[0]!).getByLabelText(/expiry date/i), '2027-01-30');
    await user.type(within(line2).getByLabelText(/expiry date/i), '2027-02-28');
    await user.click(screen.getByRole('button', { name: /review and post/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /post receipt/i }));

    expect(await within(line2).findByText('Food and other perishables must be received with an expiry date.', { selector: 'p[role="alert"]' })).toBeInTheDocument();
    expect(within(line2).getByLabelText(/expiry date/i)).toHaveAttribute('aria-invalid', 'true');
    expect(within(lines[0]!).getByLabelText(/expiry date/i)).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/nothing was posted/i).closest('[aria-live="polite"]')).not.toBeNull();
  });
});
