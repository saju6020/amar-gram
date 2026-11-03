import * as React from 'react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { resetShopMockData, shopFixtureIds } from '@/mocks/handlers/shop';
import StaffProductsPage from '@/app/(staff)/staff/shop/products/page';
import ProductFoodPage from '@/app/(staff)/staff/shop/products/[productId]/food/page';
import ConsignmentsPage from '@/app/(staff)/staff/procurement/consignments/page';
import { StaffProductTable } from '@/components/staff-shop/StaffProductTable';
import { FoodDetailsForm } from '@/components/staff-shop/FoodDetailsForm';
import { VariantsTable } from '@/components/staff-shop/VariantsTable';
import { administrationFixtureIds } from '@/mocks/handlers/admin/fixtures';
import { ACTIVE_BRANCH_KEY } from '@/lib/hooks/useActiveBranch';
import { useStaffProducts } from '@/lib/hooks/useStaffShop';
import type { StaffProductDetail, StaffProductSummary, StaffSku } from '@/lib/api/staff-shop';
import { renderWithClient } from '../product/test-utils';

let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/staff/shop/products',
  useSearchParams: () => search,
}));

beforeEach(() => {
  resetShopMockData();
  search = new URLSearchParams();
});

const session = (roleIds: string[]) => ({
  staffAccountId: 'staff-1',
  fullName: 'Amina Hossain',
  roleIds,
  issuedOn: '2026-10-14T00:00:00Z',
  lastActivityOn: '2026-10-14T00:00:00Z',
  idleExpiresOn: '2026-10-14T01:00:00Z',
  absoluteExpiresOn: '2026-10-14T09:00:00Z',
  idleTimeoutMinutes: 30,
  serverTime: '2026-10-14T00:00:00Z',
});
const asRoles = (roleIds: string[]) =>
  server.use(http.get('*/api/staff/session', () => HttpResponse.json(session(roleIds))));

async function page(element: React.ReactElement) {
  let view!: ReturnType<typeof renderWithClient>;
  await act(async () => {
    view = renderWithClient(<Suspense fallback={null}>{element}</Suspense>);
  });
  return view;
}

const row = (over: Partial<StaffProductSummary> = {}): StaffProductSummary => ({
  productId: 'p1',
  name: 'Organic Rolled Oats',
  brand: 'Amar Gram Farms',
  category: 'RiceAndGrains',
  status: 'Active',
  kind: 'Standard',
  skuCount: 1,
  listedOnStorefront: true,
  lastUpdatedOn: '2026-10-01T00:00:00Z',
  ...over,
});
const FILTERS = { q: '', status: '', category: '', brand: '', kind: '', listed: '', barcode: '', sort: '' };

describe('44 px targets (§7 UI-6) on the S3 controls', () => {
  it('the bulk bar buttons, the row checkbox hit area and the select-all label', async () => {
    const user = userEvent.setup();
    render(
      <StaffProductTable
        items={[row()]}
        totalCount={1}
        pageSize={25}
        isLoading={false}
        isError={false}
        onRetry={() => {}}
        filters={FILTERS}
        onFilter={vi.fn()}
        onFlush={vi.fn()}
        exportHref="/x"
        onBulkStatus={vi.fn().mockResolvedValue({ action: 'Publish', succeededCount: 1, failedCount: 0, items: [] })}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Select all on this page' }).closest('label')).toHaveClass('min-h-11');
    const rowBox = screen.getByRole('checkbox', { name: 'Select Organic Rolled Oats' });
    expect(rowBox.closest('label')).toHaveClass('min-h-11', 'min-w-11');
    await user.click(rowBox);
    const bar = screen.getByRole('region', { name: 'Bulk actions' });
    for (const name of ['Publish', 'Hide from shop', 'Clear']) {
      expect(within(bar).getByRole('button', { name })).toHaveClass('min-h-11');
    }
    await user.click(within(bar).getByRole('button', { name: 'Publish' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publish' }));
    expect(await screen.findByRole('button', { name: 'Dismiss' })).toHaveClass('min-h-11');
  });

  const sku: StaffSku = {
    skuId: 's1',
    code: 'OAT-2KG',
    barcode: null,
    sizeOrWeight: '2 kg',
    flavour: null,
    colour: null,
    packQuantity: null,
    shippingWeightGrams: null,
    label: '2 kg',
    status: 'Active',
    currentPrice: { amount: '2450.00', currencyCode: 'BDT' },
    scheduledPrice: null,
  };
  const productWith = (skus: StaffSku[]) =>
    ({ productId: 'p1', version: 3, kind: 'Standard', name: 'Oats', category: 'RiceAndGrains', skus, certifications: [], food: null }) as unknown as StaffProductDetail;

  it('the Was price input, the certificate controls and the district input', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <VariantsTable
        product={productWith([sku])}
        onAddSku={vi.fn()}
        onUpdateSku={vi.fn()}
        onSetStatus={vi.fn()}
        priceSkuId="s1"
        onSelectPrices={() => {}}
        priceHistory={{ current: null, scheduled: [], past: [] }}
        onSchedulePrice={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Schedule a new price' }));
    expect(await screen.findByLabelText('Was price (optional)')).toHaveClass('min-h-11');
    unmount();
    render(
      <FoodDetailsForm
        product={{ ...productWith([]), food: { organicCertificateFileId: 'f1', organicCertificateUrl: '/api/files/f1/content?exp=1&disp=inline&sig=x' } } as unknown as StaffProductDetail}
        onSave={vi.fn()}
        onReload={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Remove file' })).toHaveClass('min-h-11');
    expect(screen.getByLabelText('Certificate valid until')).toHaveClass('min-h-11');
  });
});

describe('the products list reads the stock of the ACTIVE branch (BG-9)', () => {
  it('a branch switch refetches the list instead of reusing the other branch\'s rows', async () => {
    const urls: string[] = [];
    const listener = ({ request }: { request: Request }) => {
      if (new URL(request.url).pathname.endsWith('/api/staff/shop/products')) urls.push(request.url);
    };
    server.events.on('request:start', listener);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(ACTIVE_BRANCH_KEY, administrationFixtureIds.mainBranchId);
    const { result } = renderHook(() => useStaffProducts({ pageNumber: 1, pageSize: 25 }), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await waitFor(() => expect(result.current.data).toBeDefined(), { timeout: 5000 });
    expect(urls).toHaveLength(1);
    act(() => {
      client.setQueryData(ACTIVE_BRANCH_KEY, administrationFixtureIds.londonBranchId);
    });
    await waitFor(() => expect(urls).toHaveLength(2), { timeout: 5000 });
    server.events.removeListener('request:start', listener);
  });
});

describe('Shop.ProductsManage is presentation-gated (the server still decides)', () => {
  it('the bulk bar and its select boxes are there for ShopManager and Administrator, not for Reception or Inventory', async () => {
    for (const [roles, shown] of [
      [['ShopManager'], true],
      [['Administrator'], true],
      [['Reception'], false],
      [['Inventory'], false],
    ] as const) {
      asRoles([...roles]);
      const { unmount } = await page(<StaffProductsPage />);
      await screen.findByRole('table', {}, { timeout: 8000 });
      if (shown) {
        expect(await screen.findByRole('checkbox', { name: 'Select all on this page' })).toBeInTheDocument();
      } else {
        // the session has had time to answer by the time the rows are drawn; give it a beat to be sure
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(screen.queryByRole('checkbox', { name: 'Select all on this page' })).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox', { name: /^Select / })).not.toBeInTheDocument();
      }
      unmount();
      server.resetHandlers();
    }
  }, 40000);

  it('the certificate file can be removed or replaced by a manager; a viewer can only open it', async () => {
    for (const [roles, manager] of [
      [['ShopManager'], true],
      [['Reception'], false],
    ] as const) {
      asRoles([...roles]);
      const { unmount } = await page(
        <ProductFoodPage params={Promise.resolve({ productId: shopFixtureIds.multiVariantProductId })} />,
      );
      await screen.findByLabelText('Certificate valid until', {}, { timeout: 8000 });
      expect(screen.getByRole('link', { name: /View certificate/ })).toBeInTheDocument();
      if (manager) {
        expect(await screen.findByRole('button', { name: 'Remove file' })).toBeInTheDocument();
      } else {
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(screen.queryByRole('button', { name: 'Remove file' })).not.toBeInTheDocument();
        expect(document.getElementById('fd-cert-file')).toBeNull();
      }
      unmount();
      server.resetHandlers();
    }
  }, 40000);
});

describe('the consignments page shows the arrivals sentence only for 1 to 90', () => {
  it.each([
    ['7', true],
    ['90', true],
    ['1', true],
    ['0', false],
    ['91', false],
    ['999', false],
    ['abc', false],
    ['7.5', false],
  ])('arrivingWithinDays=%s -> %s', async (value, shown) => {
    search = new URLSearchParams(`arrivingWithinDays=${value}`);
    await page(<ConsignmentsPage />);
    await screen.findByRole('heading', { name: /import consignments/i }, { timeout: 8000 });
    if (shown) expect(screen.getByText(/Showing consignments arriving in the next/)).toBeInTheDocument();
    else expect(screen.queryByText(/Showing consignments arriving in the next/)).not.toBeInTheDocument();
  }, 20000);
});

describe('the schedule dialog is keyed by SKU', () => {
  const mk = (code: string, id: string): StaffSku => ({
    skuId: id,
    code,
    barcode: null,
    sizeOrWeight: code,
    flavour: null,
    colour: null,
    packQuantity: null,
    shippingWeightGrams: null,
    label: code,
    status: 'Active',
    currentPrice: { amount: '100.00', currencyCode: 'BDT' },
    scheduledPrice: null,
  });
  const product = {
    productId: 'p1',
    version: 1,
    kind: 'Standard',
    name: 'Oats',
    category: 'RiceAndGrains',
    certifications: [],
    food: null,
    skus: [mk('A-1KG', 's1'), mk('B-2KG', 's2')],
  } as unknown as StaffProductDetail;

  it('the Was text typed for one SKU does not carry to the next', async () => {
    const user = userEvent.setup();
    const props = {
      product,
      onAddSku: vi.fn(),
      onUpdateSku: vi.fn(),
      onSetStatus: vi.fn(),
      onSelectPrices: () => {},
      priceHistory: { current: null, scheduled: [], past: [] },
      onSchedulePrice: vi.fn(),
    };
    const { rerender } = render(<VariantsTable {...props} priceSkuId="s1" />);
    await user.click(screen.getByRole('button', { name: 'Schedule a new price' }));
    await user.type(await screen.findByLabelText('Was price (optional)'), '999');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    rerender(<VariantsTable {...props} priceSkuId="s2" />);
    await user.click(screen.getByRole('button', { name: 'Schedule a new price' }));
    expect(await screen.findByLabelText('Was price (optional)')).toHaveValue('');
  });
});
