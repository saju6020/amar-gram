import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import NewReceiptPage from '@/app/(staff)/staff/inventory/receipts/new/page';
import { GoodsReceiptForm } from '@/components/inventory/GoodsReceiptForm';
import { ReceiptDraftList } from '@/components/inventory/ReceiptDraftList';
import { ApiForbiddenError } from '@/lib/api/client';
import { inventoryFixtureIds as ids, resetInventoryMockData } from '@/mocks/handlers/inventory';
import { db } from '@/mocks/handlers/inventory/store';
import type { SkuLookup, StockLocation } from '@/lib/api/inventory-lookup';
import { navigation, renderWithClient, resetNavigation } from './testUtils';

vi.mock('next/navigation', async () => {
  const { navigation: nav } = await import('./testUtils');
  return {
    useRouter: () => ({ push: nav.push, replace: nav.replace }),
    usePathname: () => nav.pathname,
    useSearchParams: () => nav.search,
  };
});

const DRAFT_ID = '33333333-3333-4333-8333-333333333333';
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
const BRANCHES = [
  { id: ids.mainBranchId, name: 'Dhanmondi outlet' },
  { id: ids.londonBranchId, name: 'London outlet' },
];

function setup(overrides: Partial<React.ComponentProps<typeof GoodsReceiptForm>> = {}) {
  const onPost = vi.fn().mockResolvedValue(undefined);
  const onBranchChange = vi.fn();
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
      onBranchChange={onBranchChange}
      isPosting={false}
      timeZoneLabel="Asia/Dhaka"
      {...overrides}
    />,
  );
  return { onPost, onBranchChange, user: userEvent.setup({ delay: 0 }), ...utils };
}

async function addLine(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/scan a barcode/i), `${rice.barcode}{Enter}`);
  await screen.findByRole('listitem', { name: /line 1: organic rice/i });
}

beforeEach(() => {
  resetInventoryMockData();
  resetNavigation();
});

describe('U35 — autosave status and the server refusals, on the form', () => {
  it('a 404 on save stops autosaving and says so in the status line', async () => {
    server.use(
      http.put('*/api/staff/inventory/goods-receipt-drafts/:id', () => new HttpResponse(null, { status: 404 })),
    );
    const { user } = setup();
    await addLine(user);
    await user.type(screen.getByLabelText(/lot number/i), 'L1');
    const status = await screen.findByText(/closed somewhere else/i, {}, { timeout: 5000 });
    expect(status.closest('[role="status"]')).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/GoodsReceiptDraftNotFound/);
  }, 15000);

  it('GoodsReceiptDraftLimitReached is plain text under the heading and the form stays usable', async () => {
    server.use(
      http.put('*/api/staff/inventory/goods-receipt-drafts/:id', () =>
        HttpResponse.json(
          {
            isValid: false,
            errors: [
              {
                propertyName: 'DraftId',
                errorCode: 'GoodsReceiptDraftLimitReached',
                errorMessage: 'You already have 20 open drafts. Post or discard one first.',
                resourceName: 'Inventory',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    );
    const { user } = setup();
    await addLine(user);
    await user.type(screen.getByLabelText(/lot number/i), 'L1');
    expect(await screen.findByText(/20 open drafts/i, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByLabelText(/lot number/i)).toHaveValue('L1');
    expect(screen.getByRole('button', { name: /review and post/i })).toBeEnabled();
  }, 15000);

  it('posting sends the draft id (so the server closes the draft) and no branch with one branch', async () => {
    const { user, onPost } = setup({ branches: [BRANCHES[0]!], branchId: BRANCHES[0]!.id });
    await addLine(user);
    await user.type(screen.getByLabelText(/lot number/i), 'L1');
    await user.type(screen.getByLabelText(/expiry date/i), '2027-01-30');
    await user.type(screen.getByLabelText(/accepted \(bags\)/i), '4');
    await user.type(screen.getByLabelText(/^unit cost/i), '10');
    await user.click(screen.getByRole('button', { name: /review and post/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /post receipt/i }));
    await waitFor(() => expect(onPost).toHaveBeenCalledTimes(1));
    expect(onPost.mock.calls[0]![0]).toMatchObject({ draftId: DRAFT_ID });
    expect(onPost.mock.calls[0]![0]).not.toHaveProperty('branchId');
  });
});

describe('U35 — Your drafts', () => {
  const drafts = [
    {
      draftId: 'd1',
      branchId: ids.mainBranchId,
      branchName: 'Dhanmondi outlet',
      supplierId: 's1',
      supplierName: 'Padma Traders <b>bold</b>',
      purchaseOrderId: null,
      consignmentId: null,
      deliveryReference: null,
      lineCount: 3,
      version: 4,
      updatedOn: '2026-11-02T09:05:00Z',
    },
  ];

  it('lists supplier, lines, branch and last saved; supplier text is shown literally', () => {
    renderWithClient(<ReceiptDraftList drafts={drafts} timeZoneLabel="Asia/Dhaka" onContinue={vi.fn()} onDiscard={vi.fn()} />);
    const list = screen.getByRole('list', { name: 'Your drafts' });
    expect(within(list).getByText('Padma Traders <b>bold</b>')).toBeInTheDocument();
    expect(list).toHaveTextContent('3 lines');
    expect(list).toHaveTextContent('Dhanmondi outlet');
    expect(list).toHaveTextContent(/Last saved/);
    expect(list.querySelector('b')).toBeNull();
  });

  it('Continue opens that draft; Discard confirms, then deletes it', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const onDiscard = vi.fn().mockResolvedValue(undefined);
    renderWithClient(<ReceiptDraftList drafts={drafts} timeZoneLabel="Asia/Dhaka" onContinue={onContinue} onDiscard={onDiscard} />);
    await user.click(screen.getByRole('button', { name: /^Continue the draft/ }));
    expect(onContinue).toHaveBeenCalledWith('d1');
    await user.click(screen.getByRole('button', { name: /^Discard the draft/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/3 lines/);
    expect(onDiscard).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Discard draft' }));
    await waitFor(() => expect(onDiscard).toHaveBeenCalledWith('d1'));
  });
});

describe('U36 — Receive into', () => {
  it('is not shown with one branch, and with none given', () => {
    const { unmount } = setup({ branches: [BRANCHES[0]!], branchId: BRANCHES[0]!.id });
    expect(screen.queryByLabelText('Receive into')).not.toBeInTheDocument();
    unmount();
    setup();
    expect(screen.queryByLabelText('Receive into')).not.toBeInTheDocument();
  });

  it('with two branches is a labelled select defaulting to the active branch; changing it without lines is immediate', async () => {
    const { user, onBranchChange } = setup({ branches: BRANCHES, branchId: ids.mainBranchId });
    const select = screen.getByLabelText('Receive into');
    expect(select).toHaveValue(ids.mainBranchId);
    await user.selectOptions(select, ids.londonBranchId);
    expect(onBranchChange).toHaveBeenCalledWith(ids.londonBranchId);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks before clearing line locations when lines exist; Cancel keeps everything; Confirm clears the location and reloads for that branch', async () => {
    const { user, onBranchChange } = setup({ branches: BRANCHES, branchId: ids.mainBranchId });
    await addLine(user);
    expect(screen.getByLabelText(/^location/i)).toHaveValue('wh');

    await user.selectOptions(screen.getByLabelText('Receive into'), ids.londonBranchId);
    let dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Receive into London outlet?');
    expect(dialog).toHaveTextContent(/location on every line is cleared/i);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onBranchChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^location/i)).toHaveValue('wh');

    await user.selectOptions(screen.getByLabelText('Receive into'), ids.londonBranchId);
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Change branch' }));
    expect(onBranchChange).toHaveBeenCalledWith(ids.londonBranchId);
    expect(screen.getByLabelText(/^location/i)).toHaveValue('');
  });

  it('the post carries branchId and draftId; BranchNotAssigned is mapped to plain language', async () => {
    const onPost = vi.fn().mockRejectedValue(new ApiForbiddenError({ error: 'BranchNotAssigned' } as never));
    const { user } = setup({ branches: BRANCHES, branchId: ids.londonBranchId, onPost });
    await addLine(user);
    await user.type(screen.getByLabelText(/lot number/i), 'L1');
    await user.type(screen.getByLabelText(/expiry date/i), '2027-01-30');
    await user.type(screen.getByLabelText(/accepted \(bags\)/i), '4');
    await user.type(screen.getByLabelText(/^unit cost/i), '10');
    await user.click(screen.getByRole('button', { name: /review and post/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /post receipt/i }));
    await waitFor(() => expect(onPost).toHaveBeenCalledTimes(1));
    expect(onPost.mock.calls[0]![0]).toMatchObject({ branchId: ids.londonBranchId, draftId: DRAFT_ID });
    expect(await screen.findByText("You aren't assigned to that branch. Choose one of your branches.")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('BranchNotAssigned');
  });
});

describe('U35/U36 — the page', () => {
  async function renderPage() {
    await act(async () => {
      renderWithClient(<NewReceiptPage />);
    });
  }

  it('reloading with ?draft= restores the saved form (lines, lot, delivery reference)', async () => {
    // Saved earlier by this staff member through the same endpoint the autosave uses.
    const saved = await fetch('http://localhost:5005/api/staff/inventory/goods-receipt-drafts/' + DRAFT_ID, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Branch-Id': ids.mainBranchId },
      body: JSON.stringify({
        supplierId: null,
        purchaseOrderId: null,
        consignmentId: null,
        deliveryReference: 'DRV-9',
        lines: [
          {
            skuId: ids.foodSkuId,
            purchaseOrderLineId: null,
            lotNumber: 'L-RESTORED',
            manufacturedOn: null,
            expiresOn: '2027-01-30',
            quantityAccepted: '4',
            quantityRejected: '0',
            rejectionReason: null,
            rejectionNote: null,
            locationId: ids.warehouseId,
            holdForInspection: false,
            unitCostAmount: '10',
            unitCostCurrency: 'BDT',
            exchangeRateToBase: null,
          },
        ],
      }),
    });
    expect(saved.status).toBe(200);
    navigation.search = new URLSearchParams(`draft=${DRAFT_ID}`);
    await renderPage();
    expect(await screen.findByLabelText(/lot number/i, {}, { timeout: 8000 })).toHaveValue('L-RESTORED');
    expect(screen.getByLabelText(/delivery reference/i)).toHaveValue('DRV-9');
    expect(screen.getByLabelText(/^accepted/i)).toHaveValue('4');
  }, 20000);

  it('a ?draft= that is gone (another member\'s, or closed) says so and offers a new receipt', async () => {
    navigation.search = new URLSearchParams(`draft=${ids.otherStaffDraftId}`);
    await renderPage();
    expect(await screen.findByText('That draft is no longer here', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start a new receipt' })).toBeInTheDocument();
  }, 20000);

  it('lists the caller\'s own drafts without ?draft= (never another member\'s)', async () => {
    await fetch('http://localhost:5005/api/staff/inventory/goods-receipt-drafts/' + DRAFT_ID, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Branch-Id': ids.mainBranchId },
      body: JSON.stringify({ supplierId: ids.supplierId, deliveryReference: 'MINE', lines: [] }),
    });
    await renderPage();
    const list = await screen.findByRole('list', { name: 'Your drafts' }, { timeout: 8000 });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(list).not.toHaveTextContent('NADIA-DRAFT');
    expect(db.receiptDrafts.some((d) => d.draftId === ids.otherStaffDraftId)).toBe(true);
  }, 20000);

  it('choosing another branch reads the orders, consignments and locations for THAT branch', async () => {
    const urls: string[] = [];
    const listener = ({ request }: { request: Request }) => urls.push(request.url);
    server.events.on('request:start', listener);
    const user = userEvent.setup({ delay: 0 });
    await renderPage();
    const select = await screen.findByLabelText('Receive into', {}, { timeout: 8000 });
    await user.selectOptions(select, ids.londonBranchId);
    await waitFor(
      () => {
        const forLondon = (path: string) =>
          urls.some((u) => u.includes(path) && u.includes(`branchId=${ids.londonBranchId}`));
        expect(forLondon('/procurement/purchase-orders')).toBe(true);
        expect(forLondon('/procurement/consignments')).toBe(true);
        expect(forLondon('/inventory/locations')).toBe(true);
      },
      { timeout: 8000 },
    );
    server.events.removeListener('request:start', listener);
  }, 20000);
});
