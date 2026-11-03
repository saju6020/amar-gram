import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewReceiptPage from '@/app/(staff)/staff/inventory/receipts/new/page';
import { GoodsReceiptForm } from '@/components/inventory/GoodsReceiptForm';
import { inventoryFixtureIds as ids, resetInventoryMockData } from '@/mocks/handlers/inventory';
import { db } from '@/mocks/handlers/inventory/store';
import type { SkuLookup, StockLocation } from '@/lib/api/inventory-lookup';
import { navigation, renderWithClient, resetNavigation } from './testUtils';

/** The unsaved-changes guard is replaced by a probe that shows what it was told (`when`). */
vi.mock('@/components/account/UnsavedChangesGuard', () => ({
  UnsavedChangesGuard: ({ when }: { when: boolean }) => <div data-testid="guard" data-when={String(when)} />,
}));
vi.mock('next/navigation', async () => {
  const { navigation: nav } = await import('./testUtils');
  return {
    useRouter: () => ({ push: nav.push, replace: nav.replace }),
    usePathname: () => nav.pathname,
    useSearchParams: () => nav.search,
  };
});

const DRAFT_ID = '44444444-4444-4444-8444-444444444444';
const locations: StockLocation[] = [
  { id: 'wh', code: 'WH1', name: 'Main warehouse', kind: 'Warehouse', isActive: true, permittedMovements: ['Receipt'] },
];
const rice: SkuLookup = {
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
const guardWhen = () => screen.getByTestId('guard').getAttribute('data-when');

function setup(onPost: (request: unknown) => Promise<void>, onDraftSaved = vi.fn()) {
  const utils = renderWithClient(
    <GoodsReceiptForm
      draftId={DRAFT_ID}
      locations={locations}
      purchaseOrders={[]}
      consignments={[]}
      purchaseOrderLines={null}
      onPurchaseOrderChange={() => undefined}
      onScan={async (barcode) => (barcode === rice.barcode ? rice : null)}
      onPost={onPost}
      onDiscardDraft={vi.fn().mockResolvedValue(undefined)}
      onDraftSaved={onDraftSaved}
      isPosting={false}
      timeZoneLabel="Asia/Dhaka"
    />,
  );
  return { user: userEvent.setup({ delay: 0 }), onDraftSaved, ...utils };
}

async function fillAndSave(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/scan a barcode/i), `${rice.barcode}{Enter}`);
  await screen.findByRole('listitem', { name: /line 1: organic rice/i }, { timeout: 8000 });
  await user.type(screen.getByLabelText(/lot number/i), 'L1');
  await user.type(screen.getByLabelText(/expiry date/i), '2027-01-30');
  await user.type(screen.getByLabelText(/accepted \(bags\)/i), '4');
  await user.type(screen.getByLabelText(/^unit cost/i), '10');
  await waitFor(
    () => expect(db.receiptDrafts.find((d) => d.draftId === DRAFT_ID)?.lines[0]?.quantityAccepted).toBe('4'),
    { timeout: 8000 },
  );
}

async function post(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /review and post/i }));
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /post receipt/i }));
}

beforeEach(() => {
  resetInventoryMockData();
  resetNavigation();
});

describe('the unsaved-changes guard around a post', () => {
  it('stays on while the post is in flight, even with nothing unsaved (releasing it walks the page back)', async () => {
    let finish!: () => void;
    const onPost = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { user } = setup(onPost);
    await fillAndSave(user);
    await post(user);
    await waitFor(() => expect(onPost).toHaveBeenCalledTimes(1));
    // Longer than the guard's hold after the last save: only the post itself keeps it on.
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(guardWhen()).toBe('true');
    finish();
  }, 30000);

  it('a refused post with nothing unsaved lets the guard go again', async () => {
    const onPost = vi.fn().mockRejectedValue(new Error('down'));
    const { user } = setup(onPost);
    await fillAndSave(user);
    await post(user);
    await screen.findByText(/nothing was posted/i);
    await waitFor(() => expect(guardWhen()).toBe('false'), { timeout: 6000 });
  }, 30000);
});

describe('the ?draft= address is not written while posting', () => {
  it('control: once the draft has settled it is written (once)', async () => {
    const { user, onDraftSaved } = setup(vi.fn().mockResolvedValue(undefined));
    await fillAndSave(user);
    await waitFor(() => expect(onDraftSaved).toHaveBeenCalledTimes(1), { timeout: 8000 });
    expect(onDraftSaved).toHaveBeenCalledWith(DRAFT_ID);
  }, 30000);

  it('nothing is written while the post is in flight', async () => {
    let finish!: () => void;
    const onPost = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { user, onDraftSaved } = setup(onPost);
    await fillAndSave(user);
    await post(user);
    await waitFor(() => expect(onPost).toHaveBeenCalledTimes(1));
    // Past the guard's hold and the settle delay: without the check it would have been written by now.
    await new Promise((resolve) => setTimeout(resolve, 3500));
    expect(onDraftSaved).not.toHaveBeenCalled();
    finish();
  }, 30000);
});

describe('the page after a successful post', () => {
  it('replaces the address with the receipt (no extra history entry) and never says the draft is gone', async () => {
    await fetch('http://localhost:5005/api/staff/inventory/goods-receipt-drafts/' + DRAFT_ID, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Branch-Id': ids.mainBranchId },
      body: JSON.stringify({
        branchId: ids.mainBranchId,
        supplierId: null,
        deliveryReference: 'DRV',
        lines: [
          {
            skuId: ids.foodSkuId,
            lotNumber: 'L-POST',
            expiresOn: '2099-01-01',
            quantityAccepted: '4',
            quantityRejected: '0',
            locationId: ids.warehouseId,
            holdForInspection: false,
            unitCostAmount: '10',
            unitCostCurrency: 'BDT',
          },
        ],
      }),
    });
    navigation.search = new URLSearchParams(`draft=${DRAFT_ID}`);
    const user = userEvent.setup({ delay: 0 });
    await act(async () => {
      renderWithClient(<NewReceiptPage />);
    });
    await screen.findByLabelText(/lot number/i, {}, { timeout: 8000 });
    await user.click(screen.getByRole('button', { name: /review and post/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /post receipt/i }));
    await waitFor(
      () =>
        expect(navigation.replace).toHaveBeenCalledWith(
          expect.stringMatching(/^\/staff\/inventory\/receipts\/[^/]+$/),
        ),
      { timeout: 8000 },
    );
    expect(navigation.push).not.toHaveBeenCalled();
    // The closed draft's refetch answers 404 a moment later; with the router mocked the page stays, so it must not flip.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(screen.queryByText('That draft is no longer here')).not.toBeInTheDocument();
  }, 30000);
});
