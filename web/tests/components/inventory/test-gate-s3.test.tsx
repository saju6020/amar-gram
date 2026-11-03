import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import NewReceiptPage from '@/app/(staff)/staff/inventory/receipts/new/page';
import { GoodsReceiptForm } from '@/components/inventory/GoodsReceiptForm';
import { inventoryFixtureIds as ids, resetInventoryMockData } from '@/mocks/handlers/inventory';
import { renderWithClient, resetNavigation } from './testUtils';

vi.mock('next/navigation', async () => {
  const { navigation: nav } = await import('./testUtils');
  return {
    useRouter: () => ({ push: nav.push, replace: nav.replace }),
    usePathname: () => nav.pathname,
    useSearchParams: () => nav.search,
  };
});

beforeEach(() => {
  resetInventoryMockData();
  resetNavigation();
});

/**
 * HO-P5 S3 TEST gate, M18 (TC-HO-P5-WIRING-S3). The slice report lists the "Receive into" select among the
 * controls raised to 44 px (CODE_REVIEW run 1 M1). This pins the class on the select itself; the rendered size is
 * measured in the browser by the gate e2e G3.
 */
describe('the "Receive into" select is a 44 px target (§7 UI-6)', () => {
  it('carries min-h-11', () => {
    renderWithClient(
      <GoodsReceiptForm
        draftId="33333333-3333-4333-8333-333333333333"
        branches={[
          { id: ids.mainBranchId, name: 'Dhanmondi outlet' },
          { id: ids.londonBranchId, name: 'London outlet' },
        ]}
        branchId={ids.mainBranchId}
        onBranchChange={vi.fn()}
        locations={[]}
        purchaseOrders={[]}
        consignments={[]}
        purchaseOrderLines={null}
        onPurchaseOrderChange={() => undefined}
        onScan={async () => null}
        onPost={vi.fn().mockResolvedValue(undefined)}
        onDiscardDraft={vi.fn().mockResolvedValue(undefined)}
        isPosting={false}
        timeZoneLabel="Asia/Dhaka"
      />,
    );
    expect(screen.getByLabelText('Receive into')).toHaveClass('min-h-11');
  });
});

/**
 * HO-P5 S3 TEST gate, G10 (TC-HO-P5-WIRING-S3). ARCHITECTURE run 1 asked TEST to check what "Receive into" shows
 * when the admin branches read is refused for a receiving role: the page joins `useMyBranches().branchIds` with
 * `useAdminBranches()` names, falling back to the id. The form must still be drawn and every option must be there.
 */
describe('Receive into when the admin branches read is refused (403)', () => {
  it('still draws the form, with one option per assigned branch, each named by its id', async () => {
    server.use(
      http.get('*/api/admin/branches', () =>
        HttpResponse.json({ title: 'Forbidden', status: 403 }, { status: 403, headers: { 'Content-Type': 'application/problem+json' } }),
      ),
    );
    await act(async () => {
      renderWithClient(<NewReceiptPage />);
    });
    const select = await screen.findByLabelText('Receive into', {}, { timeout: 8000 });
    const options = within(select).getAllByRole('option');
    expect(options.map((o) => (o as HTMLOptionElement).value).sort()).toEqual([ids.mainBranchId, ids.londonBranchId].sort());
    for (const o of options) expect(o.textContent?.trim()).toBe((o as HTMLOptionElement).value);
    expect(select).toHaveValue(ids.mainBranchId);
    expect(screen.queryByText(/couldn.t load/i)).toBeNull();
  }, 20000);
});
