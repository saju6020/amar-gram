import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { act, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReceiptDraft } from '@/lib/hooks/useInventory';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import NewReceiptPage from '@/app/(staff)/staff/inventory/receipts/new/page';
import { GoodsReceiptForm } from '@/components/inventory/GoodsReceiptForm';
import { ACTIVE_BRANCH_KEY } from '@/lib/hooks/useActiveBranch';
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
  await screen.findByRole('listitem', { name: /line 1: organic rice/i }, { timeout: 8000 });
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

  it('posting sends the draft id (so the server closes the draft) and the own branch of the form even with one branch', async () => {
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
    expect(onPost.mock.calls[0]![0]).toMatchObject({ branchId: BRANCHES[0]!.id });
  });
});

describe('the draft detail read does not depend on the active branch', () => {
  it('a branch switch does not refetch it (the server filters by id and owner only)', async () => {
    await fetch('http://localhost:5005/api/staff/inventory/goods-receipt-drafts/' + DRAFT_ID, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Branch-Id': ids.mainBranchId },
      body: JSON.stringify({ branchId: ids.mainBranchId, supplierId: null, lines: [] }),
    });
    const reads: string[] = [];
    const listener = ({ request }: { request: Request }) => {
      if (request.method === 'GET' && new URL(request.url).pathname.endsWith('/goods-receipt-drafts/' + DRAFT_ID))
        reads.push(request.url);
    };
    server.events.on('request:start', listener);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(ACTIVE_BRANCH_KEY, ids.mainBranchId);
    const { result } = renderHook(() => useReceiptDraft(DRAFT_ID), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await waitFor(() => expect(result.current.data).toBeDefined(), { timeout: 5000 });
    act(() => {
      client.setQueryData(ACTIVE_BRANCH_KEY, ids.londonBranchId);
    });
    await new Promise((resolve) => setTimeout(resolve, 600));
    server.events.removeListener('request:start', listener);
    expect(reads).toHaveLength(1);
    expect(result.current.data?.branchId).toBe(ids.mainBranchId);
  });
});

describe('autosave resumes after a refused post or discard (the draft is still open)', () => {
  async function typeAndExpectSaved(user: ReturnType<typeof userEvent.setup>, text: string) {
    await user.type(screen.getByLabelText(/lot number/i), text);
    await waitFor(
      () => expect(db.receiptDrafts.find((d) => d.draftId === DRAFT_ID)?.lines[0]?.lotNumber).toContain(text),
      { timeout: 6000 },
    );
  }

  it('after a refused post, an edit is saved again and the status updates', async () => {
    const onPost = vi.fn().mockRejectedValue(new Error('down'));
    const { user } = setup({ onPost });
    await addLine(user);
    await user.type(screen.getByLabelText(/lot number/i), 'A');
    await user.type(screen.getByLabelText(/expiry date/i), '2027-01-30');
    await user.type(screen.getByLabelText(/accepted \(bags\)/i), '4');
    await user.type(screen.getByLabelText(/^unit cost/i), '10');
    await user.click(screen.getByRole('button', { name: /review and post/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /post receipt/i }));
    await waitFor(() => expect(onPost).toHaveBeenCalledTimes(1));
    await screen.findByText(/nothing was posted/i);
    await typeAndExpectSaved(user, 'ZZ');
    expect(screen.getByText(/^Draft saved at \d\d:\d\d/)).toBeInTheDocument();
  }, 30000);

  it('after a refused discard, an edit is saved again', async () => {
    const onDiscardDraft = vi.fn().mockRejectedValue(new Error('down'));
    const { user } = setup({ onDiscardDraft });
    await addLine(user);
    await user.type(screen.getByLabelText(/lot number/i), 'A');
    await user.click(screen.getByRole('button', { name: /discard draft/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /discard draft/i }));
    await waitFor(() => expect(onDiscardDraft).toHaveBeenCalledTimes(1));
    // The refusal is shown in the dialog; leave it and carry on typing.
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /cancel/i }));
    await typeAndExpectSaved(user, 'QQ');
  }, 30000);
});

describe('a person in one branch resuming the draft of another branch', () => {
  it('keeps the own branch of that draft in the save and in the post', async () => {
    const { user, onPost } = setup({ branchId: ids.londonBranchId });
    await addLine(user);
    await user.type(screen.getByLabelText(/lot number/i), 'L1');
    await waitFor(() => expect(db.receiptDrafts.find((d) => d.draftId === DRAFT_ID)?.branchId).toBe(ids.londonBranchId), {
      timeout: 6000,
    });
    await user.type(screen.getByLabelText(/expiry date/i), '2027-01-30');
    await user.type(screen.getByLabelText(/accepted \(bags\)/i), '4');
    await user.type(screen.getByLabelText(/^unit cost/i), '10');
    await user.click(screen.getByRole('button', { name: /review and post/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /post receipt/i }));
    await waitFor(() => expect(onPost).toHaveBeenCalledTimes(1));
    expect(onPost.mock.calls[0]![0]).toMatchObject({ branchId: ids.londonBranchId });
  }, 30000);
});

describe('discard and post wait for the save in flight (no orphan draft)', () => {
  function gatedPut() {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = 0;
    server.use(
      http.put('*/api/staff/inventory/goods-receipt-drafts/:id', async ({ params }) => {
        started += 1;
        await gate;
        return HttpResponse.json({ draftId: String(params.id), version: 1, branchId: ids.mainBranchId });
      }),
    );
    return { release, started: () => started };
  }

  it('Discard does not delete until the creating save has landed', async () => {
    const { release, started } = gatedPut();
    const onDiscardDraft = vi.fn().mockResolvedValue(undefined);
    const { user } = setup({ onDiscardDraft });
    await addLine(user);
    await user.type(screen.getByLabelText(/lot number/i), 'L1');
    await waitFor(() => expect(started()).toBeGreaterThan(0), { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: /discard draft/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /discard draft/i }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(onDiscardDraft).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(onDiscardDraft).toHaveBeenCalledTimes(1));
  }, 20000);

  it('Post does not go until the save in flight has landed', async () => {
    const { release, started } = gatedPut();
    const { user, onPost } = setup();
    await addLine(user);
    await user.type(screen.getByLabelText(/lot number/i), 'L1');
    await user.type(screen.getByLabelText(/expiry date/i), '2027-01-30');
    await user.type(screen.getByLabelText(/accepted \(bags\)/i), '4');
    await user.type(screen.getByLabelText(/^unit cost/i), '10');
    await waitFor(() => expect(started()).toBeGreaterThan(0), { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: /review and post/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /post receipt/i }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(onPost).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(onPost).toHaveBeenCalledTimes(1));
  }, 20000);
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

  it('Continue and Discard are 44 px targets (§7 UI-6)', () => {
    renderWithClient(<ReceiptDraftList drafts={drafts} timeZoneLabel="Asia/Dhaka" onContinue={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^Continue the draft/ })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /^Discard the draft/ })).toHaveClass('min-h-11');
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

  it('changing the branch keeps the form mounted: the lines typed so far stay, with their locations cleared', async () => {
    const user = userEvent.setup({ delay: 0 });
    await renderPage();
    await screen.findByLabelText('Receive into', {}, { timeout: 8000 });
    await user.click(screen.getByLabelText(/^direct/i));
    await user.type(screen.getByLabelText(/scan a barcode/i), `${ids.foodBarcode}{Enter}`);
    await screen.findByRole('listitem', { name: /^line 1:/i }, { timeout: 8000 });
    await user.type(screen.getByLabelText(/lot number/i), 'KEEP-ME');
    await user.selectOptions(screen.getByLabelText('Receive into'), ids.londonBranchId);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Change branch' }));
    // The new branch's locations load in the background; the form is not replaced by a loading state.
    await waitFor(() => expect(screen.getByLabelText(/^location/i)).toHaveValue(''), { timeout: 8000 });
    expect(screen.getByLabelText(/lot number/i)).toHaveValue('KEEP-ME');
    expect(screen.getByLabelText('Receive into')).toHaveValue(ids.londonBranchId);
  }, 20000);

  it('a branch switch in the sidebar mid-draft changes neither the branch of the form nor the form', async () => {
    const urls: string[] = [];
    const listener = ({ request }: { request: Request }) => urls.push(request.url);
    const user = userEvent.setup({ delay: 0 });
    let client!: ReturnType<typeof renderWithClient>['queryClient'];
    await act(async () => {
      client = renderWithClient(<NewReceiptPage />).queryClient;
    });
    const select = await screen.findByLabelText('Receive into', {}, { timeout: 8000 });
    await waitFor(() => expect(select).toHaveValue(ids.mainBranchId), { timeout: 8000 });
    await user.click(screen.getByLabelText(/^direct/i));
    await user.type(screen.getByLabelText(/scan a barcode/i), `${ids.foodBarcode}{Enter}`);
    await screen.findByRole('listitem', { name: /^line 1:/i }, { timeout: 8000 });
    await user.type(screen.getByLabelText(/lot number/i), 'STAY');

    server.events.on('request:start', listener);
    act(() => {
      client.setQueryData(ACTIVE_BRANCH_KEY, ids.londonBranchId); // the sidebar picker
    });
    await new Promise((resolve) => setTimeout(resolve, 800));
    server.events.removeListener('request:start', listener);
    expect(screen.getByLabelText('Receive into')).toHaveValue(ids.mainBranchId);
    expect(screen.getByLabelText(/lot number/i)).toHaveValue('STAY');
    // The lists the form reads stay the form's branch (explicitly named), not the sidebar's.
    const locationReads = urls.filter((u) => u.includes('/inventory/locations'));
    expect(locationReads.length).toBeGreaterThan(0);
    for (const u of locationReads) expect(u).toContain(`branchId=${ids.mainBranchId}`);
  }, 30000);

  it('a resumed draft stays mounted, with its typed text, when the branch is switched in the sidebar', async () => {
    await fetch('http://localhost:5005/api/staff/inventory/goods-receipt-drafts/' + DRAFT_ID, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Branch-Id': ids.mainBranchId },
      body: JSON.stringify({
        branchId: ids.mainBranchId,
        supplierId: null,
        deliveryReference: 'KEEP',
        lines: [
          {
            skuId: ids.foodSkuId,
            lotNumber: 'L-A',
            quantityAccepted: '1',
            quantityRejected: '0',
            locationId: ids.warehouseId,
            holdForInspection: false,
          },
        ],
      }),
    });
    navigation.search = new URLSearchParams(`draft=${DRAFT_ID}`);
    const user = userEvent.setup({ delay: 0 });
    let client!: ReturnType<typeof renderWithClient>['queryClient'];
    await act(async () => {
      client = renderWithClient(<NewReceiptPage />).queryClient;
    });
    const lot = await screen.findByLabelText(/lot number/i, {}, { timeout: 8000 });
    await user.type(lot, 'X');
    act(() => {
      client.setQueryData(ACTIVE_BRANCH_KEY, ids.londonBranchId); // the sidebar picker
    });
    // Every save after the switch, with the branch it names.
    const savedBranches: unknown[] = [];
    const listener = async ({ request }: { request: Request }) => {
      if (request.method === 'PUT' && request.url.includes('/goods-receipt-drafts/'))
        savedBranches.push(((await request.clone().json()) as { branchId?: string }).branchId);
    };
    server.events.on('request:start', listener);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // The very same input element, not a remounted copy, and the text is still in it.
    expect(screen.getByLabelText(/lot number/i)).toBe(lot);
    expect(lot).toHaveValue('L-AX');
    await user.type(lot, 'Y');
    await waitFor(() => expect(db.receiptDrafts.find((d) => d.draftId === DRAFT_ID)?.lines[0]?.lotNumber).toBe('L-AXY'), {
      timeout: 8000,
    });
    server.events.removeListener('request:start', listener);
    // The draft is the main outlet's, and the sidebar's London never leaks into a save (not even while the draft reloads).
    expect(savedBranches.length).toBeGreaterThan(0);
    expect(savedBranches.every((b) => b === ids.mainBranchId)).toBe(true);
    expect(db.receiptDrafts.find((d) => d.draftId === DRAFT_ID)?.branchId).toBe(ids.mainBranchId);
  }, 30000);

  it('a resumed draft keeps its own saved branch, not the one in the sidebar', async () => {
    await fetch('http://localhost:5005/api/staff/inventory/goods-receipt-drafts/' + DRAFT_ID, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Branch-Id': ids.mainBranchId },
      body: JSON.stringify({ branchId: ids.londonBranchId, supplierId: null, deliveryReference: 'LDN', lines: [] }),
    });
    navigation.search = new URLSearchParams(`draft=${DRAFT_ID}`);
    await renderPage();
    const select = await screen.findByLabelText('Receive into', {}, { timeout: 8000 });
    expect(select).toHaveValue(ids.londonBranchId);
    expect(screen.getByLabelText(/delivery reference/i)).toHaveValue('LDN');
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
