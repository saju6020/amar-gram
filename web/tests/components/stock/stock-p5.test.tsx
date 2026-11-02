import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StockTable, reorderLevelText } from '@/components/stock/StockTable';
import { SkuStockMatrix } from '@/components/stock/SkuStockMatrix';
import { InventoryOverview } from '@/components/inventory/InventoryOverview';
import { resetInventoryMockData } from '@/mocks/handlers/inventory';
import type { SkuStockMatrix as Matrix, StockSummary } from '@/lib/api/inventory-stock';
import { renderWithClient } from '../inventory/testUtils';

vi.mock('next/navigation', async () => {
  const { navigation } = await import('../inventory/testUtils');
  return {
    useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
    usePathname: () => navigation.pathname,
    useSearchParams: () => navigation.search,
  };
});

beforeEach(() => resetInventoryMockData());

const base = (over: Partial<StockSummary>): StockSummary => ({
  skuId: 'sku-1',
  skuCode: 'FD-RCE-5KG',
  displayName: 'Organic rice 5 kg',
  stockUnit: 'bags',
  stockClass: 'Food',
  onHand: '37',
  reserved: '2',
  usable: '30',
  sellable: '24',
  expiredQuantity: '0',
  heldQuantity: '0',
  nextExpiresOn: '2026-11-21',
  storage: null,
  ...over,
});

function renderRows(rows: StockSummary[]) {
  return renderWithClient(
    <StockTable rows={rows} totalCount={rows.length} pageSize={25} isLoading={false} isError={false} onRetry={() => undefined} />,
  );
}

describe('U33 — stock list: Reorder at and the Below reorder level pill (BG-16)', () => {
  it('says "(branch default)" for a default level, "Off" for 0, the plain level for an explicit one, and flags only what the server flags', () => {
    renderRows([
      base({ skuId: 'a', displayName: 'Rice', reorderLevel: '20', reorderLevelIsDefault: true, belowReorderLevel: true }),
      base({ skuId: 'b', displayName: 'Lentils', reorderLevel: '10', reorderLevelIsDefault: false, belowReorderLevel: false }),
      base({ skuId: 'c', displayName: 'Salt', reorderLevel: '0', reorderLevelIsDefault: true, belowReorderLevel: false }),
      base({ skuId: 'd', displayName: 'Old', stockUnit: 'bags' }),
    ]);
    const rice = screen.getByRole('row', { name: /Rice/ });
    expect(within(rice).getByText('20 bags (branch default)')).toBeInTheDocument();
    expect(within(rice).getByText('Below reorder level')).toBeInTheDocument();
    const lentils = screen.getByRole('row', { name: /Lentils/ });
    expect(within(lentils).getByText('10 bags')).toBeInTheDocument();
    expect(within(lentils).queryByText('Below reorder level')).not.toBeInTheDocument();
    const salt = screen.getByRole('row', { name: /Salt/ });
    expect(within(salt).getByText('Off')).toBeInTheDocument();
    // A row the server sent no level for says nothing invented.
    const old = screen.getByRole('row', { name: /Old/ });
    expect(within(old).queryByText(/branch default|Off|Below/)).not.toBeInTheDocument();
    expect(within(old).getByText('—')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Reorder at' })).toBeInTheDocument();
  });

  it('does not decide "below" from the figures: usable above the level with the server flag set still shows the pill', () => {
    renderRows([base({ usable: '500', reorderLevel: '3', reorderLevelIsDefault: false, belowReorderLevel: true })]);
    expect(screen.getByText('Below reorder level')).toBeInTheDocument();
    expect(reorderLevelText(base({ reorderLevel: '0.000' }))).toBe('Off');
  });
});

const matrix = (): Matrix => ({
  skuId: 'sku-1',
  skuCode: 'FD-RCE-5KG',
  displayName: 'Organic rice 5 kg',
  stockUnit: 'bags',
  storage: null,
  branchTimeZoneId: 'Asia/Dhaka',
  batches: [
    {
      batchId: 'b1',
      lotNumber: 'L1',
      expiresOn: '2027-01-30',
      isExpired: false,
      daysToExpiry: 90,
      status: 'Available',
      receivedOn: '2026-10-14T20:30:00Z', // 15 Oct in Dhaka (UTC+6)
      supplierId: 's1',
      supplierName: 'Padma Traders',
      locations: [{ locationId: 'l1', locationCode: 'WH1', locationKind: 'Warehouse', onHand: '10', reserved: '0' }],
    },
    {
      batchId: 'b2',
      lotNumber: 'L2',
      expiresOn: null,
      isExpired: false,
      daysToExpiry: null,
      status: 'Available',
      receivedOn: null,
      supplierId: null,
      supplierName: null,
      locations: [{ locationId: 'l1', locationCode: 'WH1', locationKind: 'Warehouse', onHand: '4', reserved: '0' }],
    },
  ],
});

describe('U33 — batch matrix: Received and Supplier (BG-16)', () => {
  it('has Received and Supplier columns: the branch-local date, the supplier name, "—" without either', () => {
    render(<SkuStockMatrix matrix={matrix()} />);
    expect(screen.getByRole('columnheader', { name: 'Received' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Supplier' })).toBeInTheDocument();
    const first = screen.getByRole('row', { name: /Lot L1/ });
    expect(within(first).getByText('Padma Traders')).toBeInTheDocument();
    expect(within(first).getByText('15 Oct 2026')).toBeInTheDocument();
    const second = screen.getByRole('row', { name: /Lot L2/ });
    expect(within(second).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});

describe('U34 — Inventory overview: consignments arriving (BG-17)', () => {
  const alerts = { open: { total: 0, byKind: {} } };

  it('shows "{count} consignments arriving in the next {withinDays} days" linking with arrivingWithinDays', () => {
    render(
      <InventoryOverview
        alerts={{ ...alerts, consignmentsArriving: { withinDays: 7, count: 3 } }}
        nearExpiry={undefined}
        activeRecalls={undefined}
      />,
    );
    const row = screen.getByRole('link', { name: '3 consignments arriving in the next 7 days' });
    expect(row).toHaveAttribute('href', '/staff/procurement/consignments?arrivingWithinDays=7');
  });

  it('uses the singular for one consignment and a wider window as the server sent it', () => {
    render(
      <InventoryOverview
        alerts={{ ...alerts, consignmentsArriving: { withinDays: 30, count: 1 } }}
        nearExpiry={undefined}
        activeRecalls={undefined}
      />,
    );
    const row = screen.getByRole('link', { name: '1 consignment arriving in the next 30 days' });
    expect(row).toHaveAttribute('href', '/staff/procurement/consignments?arrivingWithinDays=30');
  });

  it('leaves the row out when the server sent no consignmentsArriving', () => {
    render(<InventoryOverview alerts={alerts} nearExpiry={undefined} activeRecalls={undefined} />);
    expect(screen.queryByRole('link', { name: /arriving/ })).not.toBeInTheDocument();
  });
});
