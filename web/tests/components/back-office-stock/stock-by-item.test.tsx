import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/mocks/server';
import { StockTable } from '@/components/stock/StockTable';
import { SectionNav } from '@/components/inventory/SectionNav';
import { inventoryNavItems } from '@/components/inventory/inventoryNavItems';
import { inventoryFixtureIds as ids, resetInventoryMockData } from '@/mocks/handlers/inventory';
import type { StockSummary } from '@/lib/api/inventory-stock';
import { navigation, renderWithClient, resetNavigation } from '../inventory/testUtils';

vi.mock('next/navigation', async () => {
  const { navigation: nav } = await import('../inventory/testUtils');
  return {
    useRouter: () => ({ push: nav.push, replace: nav.replace }),
    usePathname: () => nav.pathname,
    useSearchParams: () => nav.search,
  };
});

const row: StockSummary = {
  skuId: ids.foodSkuId,
  skuCode: 'FD-RCE-5KG',
  displayName: 'Organic rice 5 kg',
  stockUnit: 'bags',
  stockClass: 'Food',
  onHand: '37',
  reserved: '2',
  usable: '30',
  sellable: '24',
  expiredQuantity: '4',
  heldQuantity: '5',
  nextExpiresOn: '2026-11-21',
  storage: null,
};

function renderTable() {
  return renderWithClient(
    <StockTable rows={[row]} totalCount={1} pageSize={25} isLoading={false} isError={false} onRetry={() => undefined} />,
  );
}

beforeEach(() => {
  resetInventoryMockData();
  resetNavigation();
});

describe('U30 — stock row expand', () => {
  it('toggles aria-expanded and loads the batch matrix only on the first expand', async () => {
    const matrixUrls: string[] = [];
    const listener = ({ request }: { request: Request }) => {
      if (new URL(request.url).pathname.endsWith(`/api/staff/inventory/stock/${ids.foodSkuId}`)) matrixUrls.push(request.url);
    };
    server.events.on('request:start', listener);
    const user = userEvent.setup();
    renderTable();
    const toggle = screen.getByRole('button', { name: /batches of organic rice 5 kg/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(matrixUrls).toHaveLength(0);

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // The existing matrix draws the item's lots.
    expect(await screen.findByText(/lot L2409E/i)).toBeInTheDocument();
    expect(matrixUrls).toHaveLength(1);

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(matrixUrls).toHaveLength(1);
    server.events.removeListener('request:start', listener);
  });

  it('shows each figure with its unit, Available as the server sellable, and no Reorder at column', () => {
    renderTable();
    const table = screen.getByRole('table', { name: /stock by item/i });
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(expect.arrayContaining(['Item', 'On hand', 'Reserved', 'Available', 'Next expiry']));
    expect(headers.join(' ')).not.toMatch(/reorder at/i);
    expect(table).toHaveTextContent('37 bags');
    expect(table).toHaveTextContent('24 bags');
  });
});

describe('U31 — Adjust from a row', () => {
  it('opens the adjustment dialog with that item already on its first line, and no approval claim before the server speaks', async () => {
    const user = userEvent.setup();
    renderTable();
    await user.click(screen.getByRole('button', { name: /^adjust organic rice 5 kg$/i }));
    const dialog = await screen.findByRole('dialog', { name: /adjust stock · organic rice 5 kg/i });
    // Reasons are pressable chips, not radios.
    const theft = await within(dialog).findByRole('button', { name: /^theft or loss$/i });
    expect(theft).toHaveAttribute('aria-pressed', 'false');
    await user.click(theft);
    expect(theft).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).queryAllByRole('radio')).toHaveLength(0);
    // The preselected item is on line 1.
    expect(await within(dialog).findByRole('listitem', { name: /line 1: organic rice 5 kg/i })).toBeInTheDocument();
    // Approval is the server's answer after the request, never a pre-claim.
    expect(within(dialog).queryByText(/needs approval|must approve/i)).not.toBeInTheDocument();
  });
});

describe('U33 — inventory section nav', () => {
  it('is a link nav with the alert badge as text, current page marked, and no role=tab', () => {
    navigation.pathname = '/staff/inventory/alerts';
    const items = inventoryNavItems.map((item) =>
      item.label === 'Alerts' ? { ...item, badge: '3 open' } : item,
    );
    renderWithClient(<SectionNav label="Inventory" items={items} roleIds={['Administrator']} />);
    const nav = screen.getByRole('navigation', { name: 'Inventory' });
    const alerts = within(nav).getByRole('link', { name: 'Alerts 3 open' });
    expect(alerts).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Stock' })).not.toHaveAttribute('aria-current');
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});
