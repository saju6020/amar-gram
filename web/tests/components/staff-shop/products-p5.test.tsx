import * as React from 'react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { resetShopMockData, shopFixtureIds } from '@/mocks/handlers/shop';
import { db } from '@/mocks/handlers/shop/store';
import ProductDetailsPage from '@/app/(staff)/staff/shop/products/[productId]/page';
import ProductFoodPage from '@/app/(staff)/staff/shop/products/[productId]/food/page';
import { StaffProductTable } from '@/components/staff-shop/StaffProductTable';
import { FoodDetailsForm } from '@/components/staff-shop/FoodDetailsForm';
import { VariantsTable } from '@/components/staff-shop/VariantsTable';
import { ApiValidationError } from '@/lib/api/client';
import { formatMoney } from '@/lib/format/money';
import { scheduleSkuPrice, type StaffProductDetail, type StaffSku, type StaffProductSummary } from '@/lib/api/staff-shop';
import { renderWithClient } from '../product/test-utils';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/staff/shop/products',
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => resetShopMockData());

const FILTERS = { q: '', status: '', category: '', brand: '', kind: '', listed: '', barcode: '', sort: '' };

const oats: StaffProductSummary = {
  productId: 'p1',
  name: 'Organic Rolled Oats',
  brand: 'Amar Gram Farms',
  category: 'RiceAndGrains',
  status: 'Active',
  kind: 'Standard',
  skuCount: 3,
  listedOnStorefront: true,
  lastUpdatedOn: '2026-10-01T00:00:00Z',
  countryOfOrigin: { code: 'BD', name: 'Bangladesh' },
  packSizes: ['400 g', '2 kg'],
  priceRange: {
    min: { amount: '650.00', currencyCode: 'BDT' },
    max: { amount: '4400.00', currencyCode: 'BDT' },
  },
  availableStock: 12,
  primaryImage: {
    url: '/api/files/aaaa/content?exp=9999999999&disp=inline&sig=x',
    altText: 'A pack of rolled oats',
    isPrimary: true,
    skuId: null,
  },
  isOrganic: true,
};
const jar: StaffProductSummary = {
  productId: 'p2',
  name: 'Mustard Jar',
  brand: 'Padma',
  category: 'OilsAndGhee',
  status: 'Draft',
  kind: 'Standard',
  skuCount: 1,
  listedOnStorefront: false,
  lastUpdatedOn: '2026-10-02T00:00:00Z',
  countryOfOrigin: null,
  packSizes: [],
  priceRange: {
    min: { amount: '380.00', currencyCode: 'BDT' },
    max: { amount: '380.00', currencyCode: 'BDT' },
  },
  availableStock: null,
  primaryImage: null,
  isOrganic: false,
};

function table(over: Partial<React.ComponentProps<typeof StaffProductTable>> = {}) {
  return render(
    <StaffProductTable
      items={[oats, jar]}
      totalCount={2}
      pageSize={25}
      isLoading={false}
      isError={false}
      onRetry={() => {}}
      filters={FILTERS}
      onFilter={vi.fn()}
      onFlush={vi.fn()}
      exportHref="/api/staff/shop/products/export.csv"
      {...over}
    />,
  );
}

const rowOf = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

describe('U28 — Products table BG-9', () => {
  it('shows the thumbnail with the server alt text, origin, sizes, price range, stock and the Organic pill', () => {
    table();
    const first = rowOf('Organic Rolled Oats');
    const image = within(first).getByRole('img', { name: 'A pack of rolled oats' });
    expect(image.getAttribute('src')).toContain('/api/files/aaaa/content');
    expect(within(first).getByText('Bangladesh')).toBeInTheDocument();
    expect(within(first).getByText('400 g, 2 kg')).toBeInTheDocument();
    // "{min} – {max}" because the two strings differ; each end is the server's string through formatMoney.
    expect(
      within(first).getByText(
        `${formatMoney({ amount: '650.00', currencyCode: 'BDT' })} – ${formatMoney({ amount: '4400.00', currencyCode: 'BDT' })}`,
      ),
    ).toBeInTheDocument();
    expect(within(first).getByText('12 available')).toBeInTheDocument();
    expect(within(first).getByText('Organic')).toBeInTheDocument();
  });

  it('shows one price when min equals max, "—" for unknown stock and origin, the placeholder for no image, no pill', () => {
    table();
    const second = rowOf('Mustard Jar');
    expect(within(second).getByText(formatMoney({ amount: '380.00', currencyCode: 'BDT' }))).toBeInTheDocument();
    expect(within(second).queryByText(/–/)).not.toBeInTheDocument();
    expect(within(second).queryByText(/available/)).not.toBeInTheDocument();
    expect(within(second).getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(within(second).queryByRole('img')).not.toBeInTheDocument();
    expect(within(second).queryByText('Organic')).not.toBeInTheDocument();
    // No packSizes: the old pack-size count stays.
    expect(within(second).getByText('1 pack size')).toBeInTheDocument();
  });
});

describe('U29 — bulk publish / hide BG-10', () => {
  it('ticks rows, confirms naming the count, makes ONE call with the ids, reports the server counts and failures, then clears', async () => {
    const user = userEvent.setup();
    const onBulkStatus = vi.fn().mockResolvedValue({
      action: 'Unpublish',
      // Deliberately NOT what the items add up to: the screen must show the server's counts, never count the items (§20.4).
      succeededCount: 7,
      failedCount: 3,
      items: [
        { productId: 'p1', succeeded: true, status: 'Draft', errorCode: null, propertyName: null, message: null },
        {
          productId: 'p2',
          succeeded: false,
          status: null,
          errorCode: 'InvalidProductTransition',
          propertyName: 'Status',
          message: 'Cannot unpublish from Draft.',
        },
      ],
    });
    table({ onBulkStatus });
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    expect(screen.getByRole('checkbox', { name: 'Select Organic Rolled Oats' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Mustard Jar' })).toBeChecked();
    const bar = screen.getByRole('region', { name: 'Bulk actions' });
    expect(within(bar).getByText('2 selected')).toBeInTheDocument();

    await user.click(within(bar).getByRole('button', { name: 'Hide from shop' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Hide 2 products from the shop?')).toBeInTheDocument();
    expect(onBulkStatus).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Hide from shop' }));

    await waitFor(() => expect(onBulkStatus).toHaveBeenCalledTimes(1));
    expect(onBulkStatus).toHaveBeenCalledWith('Unpublish', ['p1', 'p2']);
    // The server's own counts and each failure with the product's name and the server's message (as text).
    const result = await screen.findByRole('status');
    expect(result).toHaveTextContent('7 updated, 3 not updated');
    expect(result).not.toHaveTextContent('1 updated, 1 not updated');
    expect(result).toHaveTextContent('Mustard Jar: Cannot unpublish from Draft.');
    // Selection cleared after the action.
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Organic Rolled Oats' })).not.toBeChecked();
  });

  it('Publish confirms too, and a single selected row can be cleared', async () => {
    const user = userEvent.setup();
    const onBulkStatus = vi.fn();
    table({ onBulkStatus });
    await user.click(screen.getByRole('checkbox', { name: 'Select Mustard Jar' }));
    const bar = screen.getByRole('region', { name: 'Bulk actions' });
    await user.click(within(bar).getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Publish 1 product?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onBulkStatus).not.toHaveBeenCalled();
    await user.click(within(bar).getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
  });

  it('clears the selection when the page shows different products (page change, OQ-12)', async () => {
    const user = userEvent.setup();
    const props = {
      totalCount: 2,
      pageSize: 25,
      isLoading: false,
      isError: false,
      onRetry: () => {},
      filters: FILTERS,
      onFilter: vi.fn(),
      onFlush: vi.fn(),
      exportHref: '/x',
      onBulkStatus: vi.fn(),
    };
    const { rerender } = render(<StaffProductTable {...props} items={[oats, jar]} />);
    await user.click(screen.getByRole('checkbox', { name: 'Select Mustard Jar' }));
    expect(screen.getByRole('region', { name: 'Bulk actions' })).toBeInTheDocument();
    rerender(<StaffProductTable {...props} items={[{ ...oats, productId: 'p3', name: 'Next page item' }]} />);
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument(),
    );
  });

  it('a malformed-request 400 is shown in plain language and nothing is reported as updated', async () => {
    const user = userEvent.setup();
    const onBulkStatus = vi.fn().mockRejectedValue(
      new ApiValidationError({
        isValid: false,
        errors: [
          {
            propertyName: 'ProductIds.Count',
            errorCode: 'LessThanOrEqualValidator',
            errorMessage: 'Choose at most 100 products at a time.',
            resourceName: 'BulkChangeProductStatusCommand',
          },
        ],
      }),
    );
    table({ onBulkStatus });
    await user.click(screen.getByRole('checkbox', { name: 'Select Mustard Jar' }));
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose at most 100 products at a time.');
    expect(screen.queryByText(/updated,/)).not.toBeInTheDocument();
  });
});

async function renderPage(element: React.ReactElement) {
  await act(async () => {
    renderWithClient(<Suspense fallback={null}>{element}</Suspense>);
  });
}

describe('U30 — district in the details save (BG-12)', () => {
  it('saves the district in the same PUT as everything else, with expectedVersion, and never sends isSubscribable', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.put('*/api/staff/shop/products/:productId', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderPage(
      <ProductDetailsPage params={Promise.resolve({ productId: shopFixtureIds.multiVariantProductId })} />,
    );
    const district = await screen.findByLabelText('District of origin', {}, { timeout: 4000 });
    expect(district).toHaveValue('Dinajpur');
    await user.clear(district);
    await user.type(district, 'Sylhet');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ districtOfOrigin: 'Sylhet', expectedVersion: expect.any(Number) });
    expect(body).not.toHaveProperty('isSubscribable');
  });

  it('clearing the field sends null; the server refusal lands under the field', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(
      http.put('*/api/staff/shop/products/:productId', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            isValid: false,
            errors: [
              {
                propertyName: 'DistrictOfOrigin',
                errorCode: 'InvalidDistrictOfOrigin',
                errorMessage: 'District of origin must be at most 60 characters of plain text.',
                resourceName: 'Product',
              },
            ],
          },
          { status: 400 },
        );
      }),
    );
    await renderPage(
      <ProductDetailsPage params={Promise.resolve({ productId: shopFixtureIds.multiVariantProductId })} />,
    );
    const district = await screen.findByLabelText('District of origin', {}, { timeout: 4000 });
    await user.clear(district);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({ districtOfOrigin: null });
    expect(await screen.findByText('District of origin must be at most 60 characters of plain text.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('InvalidDistrictOfOrigin');
  });
});

const sku = (over: Partial<StaffSku> = {}): StaffSku => ({
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
  scheduledPrice: { amount: '2600.00', currencyCode: 'BDT' },
  compareAtPrice: { amount: '2800.00', currencyCode: 'BDT' },
  scheduledCompareAtPrice: { amount: '3000.00', currencyCode: 'BDT' },
  ...over,
});
const productWith = (skus: StaffSku[]): StaffProductDetail =>
  ({
    productId: 'p1',
    version: 3,
    kind: 'Standard',
    name: 'Organic Rolled Oats',
    category: 'RiceAndGrains',
    skus,
    certifications: [],
    food: null,
  }) as unknown as StaffProductDetail;

describe('U31 — "Was" price BG-13', () => {
  it('renders the compare-at price and "then …" beside a scheduled one; "—" without one', () => {
    render(
      <VariantsTable
        product={productWith([sku(), sku({ skuId: 's2', code: 'OAT-4KG', compareAtPrice: null, scheduledCompareAtPrice: null, scheduledPrice: null })])}
        onAddSku={vi.fn()}
        onUpdateSku={vi.fn()}
        onSetStatus={vi.fn()}
        priceSkuId={null}
        onSelectPrices={() => {}}
        onSchedulePrice={vi.fn()}
      />,
    );
    const first = screen.getByRole('row', { name: /OAT-2KG/ });
    expect(first).toHaveTextContent(formatMoney({ amount: '2800.00', currencyCode: 'BDT' }));
    expect(first).toHaveTextContent(`then ${formatMoney({ amount: '3000.00', currencyCode: 'BDT' })}`);
    const second = screen.getByRole('row', { name: /OAT-4KG/ });
    expect(second).not.toHaveTextContent(/then/);
  });

  it('the schedule dialog sends the optional Was price, and CompareAtMustExceedPrice shows under that field', async () => {
    const user = userEvent.setup();
    const onSchedulePrice = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiValidationError({
          isValid: false,
          errors: [
            {
              propertyName: 'CompareAtAmount',
              errorCode: 'CompareAtMustExceedPrice',
              errorMessage: 'The compare-at price must be greater than the price.',
              resourceName: 'SkuPrice',
            },
          ],
        }),
      )
      .mockResolvedValue(undefined);
    const s = sku();
    render(
      <VariantsTable
        product={productWith([s])}
        onAddSku={vi.fn()}
        onUpdateSku={vi.fn()}
        onSetStatus={vi.fn()}
        priceSkuId="s1"
        onSelectPrices={() => {}}
        priceHistory={{ current: null, scheduled: [], past: [] }}
        onSchedulePrice={onSchedulePrice}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Schedule a new price' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Amount (BDT)'), '2600');
    await user.type(within(dialog).getByLabelText('Was price (optional)'), '2500');
    await user.click(within(dialog).getByRole('button', { name: 'Schedule' }));
    const was = within(dialog).getByLabelText('Was price (optional)');
    await waitFor(() => expect(was).toHaveAttribute('aria-invalid', 'true'));
    expect(within(dialog).getByText('The compare-at price must be greater than the price.')).toBeInTheDocument();
    expect(onSchedulePrice).toHaveBeenLastCalledWith(s, '2600', expect.any(String), 'BDT', '2500');

    await user.clear(was);
    await user.type(was, '3100');
    await user.click(within(dialog).getByRole('button', { name: 'Schedule' }));
    await waitFor(() => expect(onSchedulePrice).toHaveBeenCalledTimes(2));
    expect(onSchedulePrice).toHaveBeenLastCalledWith(s, '2600', expect.any(String), 'BDT', '3100');
  });

  it('the schedule dialog without a Was price sends none; a malformed Was price is refused before any request', async () => {
    const user = userEvent.setup();
    const onSchedulePrice = vi.fn().mockResolvedValue(undefined);
    render(
      <VariantsTable
        product={productWith([sku()])}
        onAddSku={vi.fn()}
        onUpdateSku={vi.fn()}
        onSetStatus={vi.fn()}
        priceSkuId="s1"
        onSelectPrices={() => {}}
        priceHistory={{ current: null, scheduled: [], past: [] }}
        onSchedulePrice={onSchedulePrice}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Schedule a new price' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Amount (BDT)'), '2600');
    await user.type(within(dialog).getByLabelText('Was price (optional)'), '12,5');
    await user.click(within(dialog).getByRole('button', { name: 'Schedule' }));
    expect(await within(dialog).findByText(/Enter an amount such as/)).toBeInTheDocument();
    expect(onSchedulePrice).not.toHaveBeenCalled();
    await user.clear(within(dialog).getByLabelText('Was price (optional)'));
    await user.click(within(dialog).getByRole('button', { name: 'Schedule' }));
    await waitFor(() => expect(onSchedulePrice).toHaveBeenCalledTimes(1));
    expect(onSchedulePrice.mock.calls[0]![4]).toBeUndefined();
  });

  it('the request body carries compareAtAmount as a JSON number next to the amount, and none when unset', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    server.use(
      http.post('*/api/staff/shop/skus/:skuId/prices', async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ skuPriceId: 'x' }, { status: 201 });
      }),
    );
    const effectiveFrom = new Date().toISOString();
    await scheduleSkuPrice('s1', { amount: '2600.00', currencyCode: 'BDT', effectiveFrom, compareAtAmount: '3000.00' });
    await scheduleSkuPrice('s1', { amount: '2600.00', currencyCode: 'BDT', effectiveFrom });
    expect(Number(bodies[0]!.amount)).toBe(2600);
    expect(Number(bodies[0]!.compareAtAmount)).toBe(3000);
    expect(bodies[1]).not.toHaveProperty('compareAtAmount');
  });
});

const certified = (food: Record<string, unknown> = {}): StaffProductDetail =>
  ({
    productId: 'p1',
    version: 3,
    kind: 'Standard',
    name: 'Organic Rolled Oats',
    category: 'RiceAndGrains',
    certifications: ['CertifiedOrganic'],
    skus: [],
    food: {
      ingredientList: 'Oats',
      storageInstructions: null,
      shelfLife: null,
      netWeight: null,
      allergens: null,
      organicCertifier: 'Bangladesh Organic Council',
      organicCertificateNumber: 'BOC-1',
      organicCertificateExpiresOn: '2030-12-31',
      organicCertificateExpired: false,
      organicCertificateFileId: 'file-1',
      organicCertificateUrl: '/api/files/file-1/content?exp=9999999999&disp=inline&sig=x',
      ...food,
    },
  }) as unknown as StaffProductDetail;

describe('U32 — organic certificate BG-14', () => {
  it('shows the expiry date, and the Expired pill ONLY when the server says so (never from the date)', () => {
    const { unmount } = render(
      <FoodDetailsForm
        product={certified({ organicCertificateExpiresOn: '2019-01-01', organicCertificateExpired: false })}
        onSave={vi.fn()}
        onReload={() => {}}
      />,
    );
    expect(screen.getByLabelText('Certificate valid until')).toHaveValue('2019-01-01');
    expect(screen.queryByText('Expired')).not.toBeInTheDocument();
    unmount();
    render(
      <FoodDetailsForm
        product={certified({ organicCertificateExpiresOn: '2035-01-01', organicCertificateExpired: true })}
        onSave={vi.fn()}
        onReload={() => {}}
      />,
    );
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('"View certificate" opens the signed URL in a new tab with noopener; "Remove file" saves null', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<FoodDetailsForm product={certified()} onSave={onSave} onReload={() => {}} />);
    const link = screen.getByRole('link', { name: /View certificate/ });
    expect(link.getAttribute('href')).toContain('/api/files/file-1/content?exp=9999999999');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toMatch(/noopener/);
    await user.click(screen.getByRole('button', { name: 'Remove file' }));
    // Removed: the uploader (purpose OrganicCertificate: PDF and images, 10 MB) takes its place.
    expect(screen.queryByRole('link', { name: /View certificate/ })).not.toBeInTheDocument();
    expect(document.getElementById('fd-cert-file')?.getAttribute('accept')).toBe(
      'application/pdf,image/jpeg,image/png,image/webp',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      organicCertificateFileId: '',
      organicCertificateExpiresOn: '2030-12-31',
    });
  });

  it('InvalidCertificateFile shows under the file field in plain language', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(
      new ApiValidationError({
        isValid: false,
        errors: [
          {
            propertyName: 'OrganicCertificateFileId',
            errorCode: 'InvalidCertificateFile',
            errorMessage: '',
            resourceName: 'Product',
          },
        ],
      }),
    );
    render(<FoodDetailsForm product={certified()} onSave={onSave} onReload={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/could not be attached/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('InvalidCertificateFile');
  });

  it('the page saves the certificate fields in the food PUT (expiry kept, file cleared with null)', async () => {
    const user = userEvent.setup();
    let body: Record<string, unknown> | null = null;
    server.use(
      // A role that holds Shop.ProductsManage (presentation gate for the certificate controls).
      http.get('*/api/staff/session', () =>
        HttpResponse.json({
          staffAccountId: 's1',
          fullName: 'Shop Manager',
          roleIds: ['ShopManager'],
          issuedOn: '2026-10-14T00:00:00Z',
          lastActivityOn: '2026-10-14T00:00:00Z',
          idleExpiresOn: '2026-10-14T01:00:00Z',
          absoluteExpiresOn: '2026-10-14T09:00:00Z',
          idleTimeoutMinutes: 30,
          serverTime: '2026-10-14T00:00:00Z',
        }),
      ),
      http.put('*/api/staff/shop/products/:productId/food', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderPage(
      <ProductFoodPage params={Promise.resolve({ productId: shopFixtureIds.multiVariantProductId })} />,
    );
    const expiry = await screen.findByLabelText('Certificate valid until', {}, { timeout: 4000 });
    expect(expiry).toHaveValue('2030-12-31');
    await user.click(screen.getByRole('button', { name: 'Remove file' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      organicCertificateExpiresOn: '2030-12-31',
      organicCertificateFileId: null,
      organicCertifier: 'Bangladesh Organic Council',
    });
  });

  it('the expired seed is the mustard oil, the oats certificate is valid (the server derives it from UTC today)', async () => {
    const mustard = db.products.find((p) => p.slug === 'pure-mustard-oil')!;
    const response = await fetch(`http://localhost:5005/api/staff/shop/products/${mustard.productId}`);
    const detail = (await response.json()) as StaffProductDetail;
    expect(detail.food?.organicCertificateExpired).toBe(true);
    const oatsResponse = await fetch(`http://localhost:5005/api/staff/shop/products/${shopFixtureIds.multiVariantProductId}`);
    const oatsDetail = (await oatsResponse.json()) as StaffProductDetail;
    expect(oatsDetail.food?.organicCertificateExpired).toBe(false);
    expect(oatsDetail.food?.organicCertificateUrl).toMatch(/^\/api\/files\/.+\/content\?exp=\d+&disp=inline&sig=/);
  });
});
