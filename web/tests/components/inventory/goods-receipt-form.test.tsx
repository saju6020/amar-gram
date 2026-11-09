import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoodsReceiptForm } from '@/components/inventory/GoodsReceiptForm';
import { ApiValidationError } from '@/lib/api/client';
import { stateFromDraft } from '@/components/inventory/receiptModel';
import { resetInventoryMockData } from '@/mocks/handlers/inventory';
import { db } from '@/mocks/handlers/inventory/store';
import type { GoodsReceiptDraft } from '@/lib/api/inventory-receipts';
import type { SkuLookup, StockLocation } from '@/lib/api/inventory-lookup';
import { renderWithClient } from './testUtils';

vi.mock('next/navigation', async () => {
  const { navigation } = await import('./testUtils');
  return {
    useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
    usePathname: () => navigation.pathname,
    useSearchParams: () => navigation.search,
  };
});

const DRAFT_ID = '22222222-2222-4222-8222-222222222222';
const locations: StockLocation[] = [
  {
    id: 'wh',
    code: 'WH1',
    name: 'Main warehouse',
    kind: 'Warehouse',
    isActive: true,
    permittedMovements: ['Receipt', 'Sale'],
  },
  {
    id: 'qr',
    code: 'QRN',
    name: 'Quarantine shelf',
    kind: 'Quarantine',
    isActive: true,
    permittedMovements: ['Receipt'],
  },
];
const food: SkuLookup = {
  skuId: 'k1',
  productId: 'p1',
  skuCode: 'FD-RCE-5KG',
  displayName: 'Organic rice',
  barcode: '4006381333931',
  stockClass: 'Food',
  expiryRequired: true,
  stockUnit: 'bags',
  allowsFractionalQuantity: false,
  countryOfOriginCode: 'DE',
  isActive: true,
  storage: null,
};
const milk: SkuLookup = {
  skuId: 'k2',
  productId: 'p2',
  skuCode: 'FD-MLK-LSE',
  displayName: 'Fresh cow milk',
  barcode: '5012345678900',
  stockClass: 'Food',
  expiryRequired: true,
  stockUnit: 'ml',
  allowsFractionalQuantity: true,
  countryOfOriginCode: 'US',
  isActive: true,
  storage: {
    condition: 'Refrigerated',
    minTemperatureC: 2,
    maxTemperatureC: 8,
    handlingNotes: null,
  },
};

function setup(overrides: Partial<React.ComponentProps<typeof GoodsReceiptForm>> = {}) {
  const onPost = vi.fn().mockResolvedValue(undefined);
  const onScan = vi.fn(async (barcode: string) =>
    barcode === food.barcode ? food : barcode === milk.barcode ? milk : null,
  );
  const utils = renderWithClient(
    <GoodsReceiptForm
      draftId={DRAFT_ID}
      onDiscardDraft={vi.fn().mockResolvedValue(undefined)}
      locations={locations}
      purchaseOrders={[]}
      consignments={[]}
      purchaseOrderLines={null}
      onPurchaseOrderChange={() => undefined}
      onScan={onScan}
      onPost={onPost}
      isPosting={false}
      timeZoneLabel="Asia/Dhaka"
      {...overrides}
    />,
  );
  return { onPost, onScan, user: userEvent.setup({ delay: 0 }), ...utils };
}

async function scan(user: ReturnType<typeof userEvent.setup>, barcode: string) {
  await user.type(screen.getByLabelText(/scan a barcode/i), `${barcode}{Enter}`);
}

async function addFoodLine(user: ReturnType<typeof userEvent.setup>) {
  await scan(user, food.barcode!);
  await screen.findByRole('listitem', { name: /line 1: organic rice/i });
}

beforeEach(() => {
  window.sessionStorage.clear();
  resetInventoryMockData();
});

describe('U-C — goods receipt', () => {
  it('U-C3: a scan adds a line, announces it, and shows the storage requirement', async () => {
    const { user } = setup();
    await scan(user, milk.barcode!);
    expect(await screen.findByText(/added: fresh cow milk — fd-mlk-lse/i)).toBeInTheDocument();
    const line = await screen.findByRole('listitem', { name: /line 1: fresh cow milk/i });
    expect(within(line).getByText(/store: refrigerated 2–8 °C/i)).toBeInTheDocument();
  });

  it('U-C1: a food line without an expiry is marked required and blocked on that field', async () => {
    const { user, onPost } = setup();
    await addFoodLine(user);
    expect(screen.getByLabelText(/expiry date/i)).toBeRequired();
    await user.type(screen.getByLabelText(/lot number/i), 'L2409E');
    await user.type(screen.getByLabelText(/accepted \(bags\)/i), '20');
    await user.click(screen.getByRole('button', { name: /review and post/i }));
    expect(
      await screen.findAllByText('Food and other perishables must be received with an expiry date.'),
    ).not.toHaveLength(0);
    expect(onPost).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/expiry date/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('U-C2: a rejected quantity asks for a reason, and only then', async () => {
    const { user } = setup();
    await addFoodLine(user);
    expect(screen.queryByLabelText(/why was it rejected/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/rejected \(bags\)/i), '2');
    expect(await screen.findByLabelText(/why was it rejected/i)).toBeRequired();
  });

  it('U-C5: the post confirm names the line count, the quantity with its unit, the location and permanence', async () => {
    const { user, onPost } = setup();
    await addFoodLine(user);
    await user.type(screen.getByLabelText(/lot number/i), 'L2409E');
    await user.type(screen.getByLabelText(/expiry date/i), '2027-01-30');
    await user.type(screen.getByLabelText(/accepted \(bags\)/i), '20');
    await user.selectOptions(screen.getByLabelText(/^location/i), 'wh');
    await user.type(screen.getByLabelText(/^unit cost/i), '450');
    await user.click(screen.getByRole('button', { name: /review and post/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/1 line will be received/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        /20 bags of organic rice — fd-rce-5kg, lot L2409E → main warehouse/i,
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/a posted receipt cannot be edited/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /post receipt/i }));
    await waitFor(() => expect(onPost).toHaveBeenCalledTimes(1));
    expect(onPost.mock.calls[0]![0].lines[0]).toMatchObject({
      skuId: 'k1',
      lotNumber: 'L2409E',
      quantityAccepted: '20',
      expiresOn: '2027-01-30',
      unitCostAmount: '450',
    });
  });

  it('U-C4: the draft is autosaved to the server (not the browser), then Discard confirms and hands over to the screen', async () => {
    const onDiscardDraft = vi.fn().mockResolvedValue(undefined);
    const { user } = setup({ onDiscardDraft });
    await addFoodLine(user);
    await user.type(screen.getByLabelText(/lot number/i), 'L-DRAFT');
    // ADR-FE-190: a whole-form PUT after a quiet moment (or on blur) and "Draft saved at hh:mm" in the polite status.
    await waitFor(
      () =>
        expect(db.receiptDrafts.find((d) => d.draftId === DRAFT_ID)?.lines[0]).toMatchObject({
          skuId: 'k1',
          lotNumber: 'L-DRAFT',
        }),
      { timeout: 5000 },
    );
    expect(screen.getByText(/^Draft saved at \d\d:\d\d/)).toBeInTheDocument();
    expect(screen.getByText(/^Draft saved at/).closest('[role="status"]')).not.toBeNull();
    // Nothing is kept in browser storage any more (ADR-FE-190 supersedes the sessionStorage draft of ADR-FE-043).
    expect(window.sessionStorage.length).toBe(0);
    expect(screen.queryByText('Restore the receipt you were entering?')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /discard draft/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/nothing has been posted/i);
    await user.click(within(dialog).getByRole('button', { name: /discard draft/i }));
    await waitFor(() => expect(onDiscardDraft).toHaveBeenCalledTimes(1));
  }, 15000);

  it('U-C4b: a resumed draft keeps its lines and a line scanned afterwards is added after them', async () => {
    const draft: GoodsReceiptDraft = {
      draftId: DRAFT_ID,
      branchId: 'b1',
      branchName: 'Main',
      supplierId: null,
      purchaseOrderId: null,
      consignmentId: null,
      deliveryReference: 'DRV-7',
      receivedOn: null,
      note: null,
      version: 2,
      updatedOn: '2026-11-02T09:00:00Z',
      lines: [
        {
          skuId: food.skuId,
          skuCode: food.skuCode,
          displayName: food.displayName,
          purchaseOrderLineId: null,
          lotNumber: 'L-RESUMED',
          manufacturedOn: null,
          expiresOn: '2027-01-30',
          quantityAccepted: '20',
          quantityRejected: '0',
          rejectionReason: null,
          rejectionNote: null,
          locationId: 'wh',
          holdForInspection: false,
          unitCostAmount: '450',
          unitCostCurrency: 'BDT',
          exchangeRateToBase: null,
        },
      ],
    };
    const { user } = setup({
      initial: stateFromDraft(draft, { [food.skuCode]: food }),
      initialIsDraft: true,
    });
    const first = await screen.findByRole('listitem', { name: /line 1: organic rice/i });
    expect(within(first).getByLabelText(/lot number/i)).toHaveValue('L-RESUMED');
    expect(within(first).getByLabelText(/^accepted/i)).toHaveValue('20');
    expect(screen.getByLabelText(/delivery reference/i)).toHaveValue('DRV-7');
    await scan(user, milk.barcode!);
    expect(await screen.findByRole('listitem', { name: /line 2: fresh cow milk/i })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: /line 1: organic rice/i })).toBeInTheDocument();
  });

  it('U-C6: a 400 with three line violations lands each on its own field, scrolls to the first, shows no error code', async () => {
    const violation = (propertyName: string, errorCode: string, errorMessage: string) => ({
      propertyName,
      errorCode,
      errorMessage,
      resourceName: 'Inventory',
    });
    const onPost = vi.fn().mockRejectedValue(
      new ApiValidationError({
        isValid: false,
        errors: [
          violation(
            'Lines[0].ExpiresOn',
            'ExpiryDateRequired',
            'Food and other perishables must be received with an expiry date.',
          ),
          violation(
            'Lines[0].LotNumber',
            'LotNumberRequired',
            'A lot number is required for accepted stock.',
          ),
          violation(
            'Lines[1].QuantityAccepted',
            'ReceiptExceedsOutstanding',
            'Only 4 is still outstanding on that order line.',
          ),
        ],
      }),
    );
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      scrolled.push(this.id);
    };
    const { user } = setup({ onPost });
    await addFoodLine(user);
    await scan(user, milk.barcode!);
    await screen.findByRole('listitem', { name: /line 2: fresh cow milk/i });
    for (const [index, qty] of ['20', '5'].entries()) {
      await user.type(screen.getAllByLabelText(/^accepted/i)[index]!, qty);
    }
    await user.type(screen.getAllByLabelText(/lot number/i)[0]!, 'L1');
    await user.type(screen.getAllByLabelText(/lot number/i)[1]!, 'L2');
    await user.type(screen.getAllByLabelText(/expiry date/i)[0]!, '2027-01-30');
    await user.type(screen.getAllByLabelText(/expiry date/i)[1]!, '2027-02-28');
    for (const unitCost of screen.getAllByLabelText(/^unit cost/i)) await user.type(unitCost, '10');
    await user.click(screen.getByRole('button', { name: /review and post/i }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /post receipt/i }),
    );

    expect(
      await screen.findByText('Only 4 is still outstanding on that order line.', { selector: 'p' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Food and other perishables must be received with an expiry date.', {
        selector: 'p',
      }),
    ).not.toHaveLength(0);
    expect(screen.getAllByLabelText(/expiry date/i)[0]).toHaveAttribute('aria-invalid', 'true');
    expect(document.body).not.toHaveTextContent(
      /ExpiryDateRequired|LotNumberRequired|ReceiptExceedsOutstanding/,
    );
    await waitFor(() => expect(scrolled[0]).toBe('receipt-line-0-expiresOn'));
  });
});
