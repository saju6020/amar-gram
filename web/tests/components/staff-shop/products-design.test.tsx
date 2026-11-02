import * as React from 'react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { resetShopMockData, shopFixtureIds } from '@/mocks/handlers/shop';
import ProductEditorLayout from '@/app/(staff)/staff/shop/products/[productId]/layout';
import StaffShopLayout from '@/app/(staff)/staff/shop/layout';
import { StaffProductTable } from '@/components/staff-shop/StaffProductTable';
import { renderWithClient } from '../product/test-utils';

const push = vi.fn();
const replace = vi.fn();
let pathname = '/staff/shop/products';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

beforeEach(() => {
  resetShopMockData();
  push.mockClear();
  replace.mockClear();
  pathname = '/staff/shop/products';
});

const FILTERS = {
  q: '',
  status: '',
  category: '',
  brand: '',
  kind: '',
  listed: '',
  barcode: '',
  sort: '',
};

function table(over: Partial<React.ComponentProps<typeof StaffProductTable>> = {}) {
  const onFilter = vi.fn();
  const onFlush = vi.fn();
  render(
    <StaffProductTable
      items={[
        {
          productId: 'p1',
          name: 'Organic Rolled Oats',
          brand: 'Amar Gram Farms',
          category: 'RiceAndGrains',
          status: 'Active',
          kind: 'Standard',
          skuCount: 3,
          listedOnStorefront: true,
          lastUpdatedOn: '2026-10-01T00:00:00Z',
        },
      ]}
      totalCount={1}
      pageSize={25}
      isLoading={false}
      isError={false}
      onRetry={() => {}}
      filters={FILTERS}
      onFilter={onFilter}
      onFlush={onFlush}
      exportHref="/api/staff/shop/products/export.csv?status=Draft"
      {...over}
    />,
  );
  return { onFilter, onFlush };
}

describe('Products list — HO-P4 §11.4.2/§11.4.3 (U25, U26)', () => {
  it('U25: status pills are All, Draft, Active, Archived and a click writes status', async () => {
    const user = userEvent.setup();
    const { onFilter } = table();
    const tabs = screen.getByRole('tablist', { name: 'Status' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['All', 'Draft', 'Active', 'Archived']);
    expect(within(tabs).getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    await user.click(within(tabs).getByRole('tab', { name: 'Draft' }));
    expect(onFilter).toHaveBeenCalledWith('status', 'Draft');
    await user.click(within(tabs).getByRole('tab', { name: 'All' }));
    expect(onFilter).toHaveBeenCalledWith('status', '');
    // No counts: the list row carries no per-status totals.
    expect(within(tabs).queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('U26: Banners and + New product link out; no Categories control; export keeps the filters', () => {
    table();
    expect(screen.getByRole('link', { name: 'Banners' })).toHaveAttribute(
      'href',
      '/staff/admin/content?kind=Banner',
    );
    expect(screen.getByRole('link', { name: '+ New product' })).toHaveAttribute(
      'href',
      '/staff/shop/products/new',
    );
    expect(screen.queryByText(/^categories$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Export CSV/ })).toHaveAttribute(
      'href',
      '/api/staff/shop/products/export.csv?status=Draft',
    );
  });

  it('shows the design columns (HO-P5 BG-9 adds Origin, Price and Stock); without the bulk handler there are no select boxes', () => {
    table();
    for (const header of [
      'Product',
      'Category',
      'Producer',
      'Origin',
      'Pack sizes',
      'Price',
      'Stock',
      'Listed in shop',
      'Status',
      'Updated',
    ]) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    // The row carries none of the BG-9 data: the old pack-size count stays, the rest says "—", nothing is invented.
    expect(screen.getByText('3 pack sizes')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/available/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Organic')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Organic' })).not.toBeInTheDocument();
    expect(screen.queryByText(/publish selected|hide selected|hide from shop/i)).not.toBeInTheDocument();
  });

  it('the search box sends digits as barcode and text as q (confirmed with Enter)', async () => {
    const user = userEvent.setup();
    const { onFilter, onFlush } = table();
    const search = screen.getByLabelText('Name, SKU or barcode');
    await user.type(search, 'oat{Enter}');
    expect(onFilter).toHaveBeenCalledWith('q', 'oat');
    expect(onFilter).toHaveBeenCalledWith('barcode', '');
    onFilter.mockClear();
    await user.clear(search);
    await user.type(search, '8900000000101{Enter}');
    expect(onFilter).toHaveBeenCalledWith('barcode', '8900000000101');
    expect(onFilter).toHaveBeenCalledWith('q', '');
    expect(onFlush).toHaveBeenCalledWith('barcode');
  });
});

describe('Shop section nav — HO-P4 §11.4.1', () => {
  it('is link pills with aria-current on the current section and no tab roles', () => {
    pathname = '/staff/shop/origins';
    render(
      <StaffShopLayout>
        <p>body</p>
      </StaffShopLayout>,
    );
    const nav = screen.getByRole('navigation', { name: 'Shop' });
    expect(within(nav).getByRole('link', { name: 'Origins' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Products' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});

async function renderEditor(productId: string) {
  await act(async () => {
    renderWithClient(
      <Suspense fallback={null}>
        <ProductEditorLayout params={Promise.resolve({ productId })}>
          <p>section body</p>
        </ProductEditorLayout>
      </Suspense>,
    );
  });
}

describe('Product editor layout — HO-P4 §11.4.4/§11.4.5 (U27, U28)', () => {
  it('U27: breadcrumb, section link tabs on the existing routes, and a select for narrow screens', async () => {
    const id = shopFixtureIds.unmetChecklistProductId; // a food product
    pathname = `/staff/shop/products/${id}/variants`;
    await renderEditor(id);
    await screen.findByRole('heading', { level: 1, name: 'Unfinished Muesli' }, { timeout: 4000 });
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Products' })).toHaveAttribute(
      'href',
      '/staff/shop/products',
    );
    const nav = screen.getByRole('navigation', { name: 'Product sections' });
    const base = `/staff/shop/products/${id}`;
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Details',
      'Food & labelling',
      'Pack sizes & prices',
      'Photos',
      'Related',
      'Translations',
    ]);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      base,
      `${base}/food`,
      `${base}/variants`,
      `${base}/images`,
      `${base}/related`,
      `${base}/translations`,
    ]);
    expect(within(nav).getByRole('link', { name: 'Pack sizes & prices' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).queryByRole('tab')).not.toBeInTheDocument();
    // Below md the same sections are a select.
    expect(screen.getByLabelText('Section')).toHaveValue(`${base}/variants`);
  });

  it('a draft has no "Preview in shop" link', async () => {
    const id = shopFixtureIds.draftProductId;
    await renderEditor(id);
    await screen.findByRole('heading', { level: 1 }, { timeout: 4000 });
    expect(screen.queryByRole('link', { name: 'Preview in shop' })).not.toBeInTheDocument();
  });

  it('an active, listed product links to its shop page', async () => {
    const id = shopFixtureIds.multiVariantProductId;
    await renderEditor(id);
    const link = await screen.findByRole('link', { name: 'Preview in shop' }, { timeout: 4000 });
    expect(link.getAttribute('href')).toMatch(/^\/shop\/products\/[a-z0-9-]+$/);
  });

  it('U28: the Status card publishes with the product version; there is no status radio', async () => {
    const user = userEvent.setup();
    const id = shopFixtureIds.unmetChecklistProductId;
    const bodies: unknown[] = [];
    server.use(
      http.post('*/api/staff/shop/products/:productId/publish', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(
          { errors: [{ propertyName: '', errorCode: 'ProductNotPublishable', errorMessage: '' }] },
          { status: 422 },
        );
      }),
    );
    await renderEditor(id);
    const card = await screen.findByRole('region', { name: 'Status' }, { timeout: 4000 });
    expect(within(card).getByRole('list', { name: 'Publish checklist' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Publish' }));
    const dialog = await screen.findByRole('dialog', { name: 'Publish this product?' });
    await user.click(within(dialog).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ expectedVersion: expect.any(Number) });
  });
});
