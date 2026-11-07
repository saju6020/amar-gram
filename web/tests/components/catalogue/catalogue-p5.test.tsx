import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetShopMockData } from '@/mocks/handlers/shop';
import { CatalogueControls } from '@/app/(shop)/_components/CatalogueControls';
import { apiFetch, ApiValidationError } from '@/lib/api/client';
import type { CatalogueFilters } from '@/lib/api/shop-catalogue';
import { CATEGORIES, FACETS } from './catalogue-fixtures';

/**
 * HO-P5 S1 §15 U7 (the District filter, its chip and Clear filters) and the U47 mock refusals for
 * `GET /api/shop/products?district=` (Api/Controllers/ShopCatalogueController.cs:37-39).
 */

const replace = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/shop/products',
  useSearchParams: () => new URLSearchParams(search),
}));

const DISTRICT_FACETS: CatalogueFilters = {
  ...FACETS,
  districts: [
    { value: 'Dinajpur', count: 3 },
    { value: 'Satkhira', count: 2 },
    { value: 'Sylhet', count: 1 },
  ],
};

function setup(query = '', facets: CatalogueFilters = DISTRICT_FACETS) {
  search = query;
  return render(
    <CatalogueControls facets={facets} categories={CATEGORIES} currencyCode="BDT" summary={null}>
      <div>results</div>
    </CatalogueControls>,
  );
}

const lastUrl = () => replace.mock.calls.at(-1)?.[0] as string;
const filterCard = () => within(screen.getByRole('complementary', { name: 'Filters' }));

beforeEach(() => {
  replace.mockClear();
  resetShopMockData();
});

describe('U7: the District filter', () => {
  it('lists the districts the API sent, in that order, with their counts', () => {
    setup();
    const group = filterCard().getByRole('group', { name: 'District' });
    const boxes = within(group).getAllByRole('checkbox', { hidden: true });
    expect(boxes.map((box) => box.closest('label')?.textContent)).toEqual([
      'Dinajpur(3)',
      'Satkhira(2)',
      'Sylhet(1)',
    ]);
  });

  it('ticking one writes a repeatable district param to the URL', async () => {
    const user = userEvent.setup();
    setup('q=oats');
    await user.click(filterCard().getByRole('button', { name: 'District' }));
    await user.click(filterCard().getByRole('checkbox', { name: /Satkhira/ }));
    expect(lastUrl()).toBe('/shop/products?q=oats&district=Satkhira');
    search = 'q=oats&district=Satkhira';
    await user.click(filterCard().getByRole('checkbox', { name: /Sylhet/ }));
    expect(lastUrl()).toBe('/shop/products?q=oats&district=Satkhira&district=Sylhet');
  });

  it('an active district has the chip "Remove filter X", which removes only it', async () => {
    const user = userEvent.setup();
    setup('district=Dinajpur&district=Sylhet');
    expect(filterCard().getByRole('checkbox', { name: /Dinajpur/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Remove filter Dinajpur' }));
    expect(lastUrl()).toBe('/shop/products?district=Sylhet');
  });

  it('Clear filters removes the district and keeps the search', async () => {
    const user = userEvent.setup();
    setup('q=oats&district=Dinajpur');
    await user.click(filterCard().getByRole('button', { name: 'Clear filters' }));
    expect(lastUrl()).toBe('/shop/products?q=oats');
  });

  it('is counted in the phone sheet button', () => {
    setup('district=Dinajpur&district=Sylhet');
    expect(screen.getByRole('button', { name: 'Filters (2)' })).toBeInTheDocument();
  });

  it('has no District group when the API sends no districts', () => {
    setup('', { ...FACETS, districts: [] });
    expect(screen.queryByText('District')).not.toBeInTheDocument();
  });
});

describe('U47: the mock refuses what the server refuses', () => {
  const tooMany = Array.from({ length: 21 }, (_, i) => `D${i}`);

  async function refusal(promise: Promise<unknown>) {
    const error = await promise.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiValidationError);
    return (error as ApiValidationError).response.errors[0]!;
  }

  it('more than 20 district values -> InvalidCatalogueFilter naming district (ShopCatalogueController.cs:37-38)', async () => {
    // `getPublic` is server-only; the mock answers the same URL the page would request.
    const query = new URLSearchParams();
    for (const d of tooMany) query.append('district', d);
    const first = await refusal(apiFetch(`/api/shop/products?${query.toString()}`));
    expect(first.propertyName).toBe('district');
    expect(first.errorCode).toBe('InvalidCatalogueFilter');
  });

  it('blanks are dropped and values trimmed before they are counted: 20 real values plus blanks is accepted', async () => {
    const query = new URLSearchParams();
    for (const d of tooMany.slice(0, 20)) query.append('district', ` ${d} `);
    query.append('district', '');
    query.append('district', '   ');
    await expect(apiFetch(`/api/shop/products?${query.toString()}`)).resolves.toMatchObject({
      items: [],
    });
    // A 60-character value with padding is within the limit once trimmed.
    await expect(
      apiFetch(`/api/shop/products?district=${encodeURIComponent(` ${'x'.repeat(60)} `)}`),
    ).resolves.toBeDefined();
  });

  it('exactly 20 values is accepted', async () => {
    const query = new URLSearchParams();
    for (const d of tooMany.slice(0, 20)) query.append('district', d);
    await expect(apiFetch(`/api/shop/products?${query.toString()}`)).resolves.toMatchObject({
      items: [],
    });
  });

  it('a value over 60 characters -> InvalidCatalogueFilter naming district (ShopCatalogueController.cs:39)', async () => {
    const first = await refusal(
      apiFetch(`/api/shop/products?district=${encodeURIComponent('x'.repeat(61))}`),
    );
    expect(first.propertyName).toBe('district');
    expect(first.errorCode).toBe('InvalidCatalogueFilter');
    await expect(
      apiFetch(`/api/shop/products?district=${encodeURIComponent('x'.repeat(60))}`),
    ).resolves.toBeDefined();
  });

  it('filters case-insensitively, and the facets list the districts A-Z with counts', async () => {
    const result = await apiFetch<{
      items: Array<{ districtOfOrigin?: string | null }>;
      appliedFilters: Record<string, string | null>;
    }>('/api/shop/products?district=dinajpur');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.districtOfOrigin === 'Dinajpur')).toBe(true);
    expect(result.appliedFilters.district).toBe('dinajpur');

    const facets = await apiFetch<{ districts: Array<{ value: string; count: number }> }>(
      '/api/shop/filters',
    );
    const names = facets.districts.map((d) => d.value);
    expect(names).toEqual([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
    expect(facets.districts.find((d) => d.value === 'Dinajpur')?.count).toBeGreaterThanOrEqual(1);
    expect(facets.districts.some((d) => d.count >= 2)).toBe(true);
  });

  it('the public card and detail never carry the staff-only certificate or scheduled "Was" fields', async () => {
    const list = await apiFetch<{ items: Array<Record<string, unknown>> }>('/api/shop/products');
    const detail = await apiFetch<{ skus: Array<Record<string, unknown>> } & Record<string, unknown>>(
      '/api/shop/products/organic-rolled-oats',
    );
    const text = JSON.stringify([list, detail]);
    expect(text).not.toMatch(/organicCertificateExpiresOn|organicCertificateFileId|scheduledCompareAt/);
    // The "Was" price is a Money string, formatted rather than computed.
    const sku = detail.skus.find((s) => s.compareAtPrice);
    expect(sku?.compareAtPrice).toEqual({ amount: '2800.00', currencyCode: 'BDT' });
  });
});

describe('the "Was" price is formatted from minor units by string handling (centsText)', () => {
  it.each([
    [5, '0.05'],
    [99, '0.99'],
    [100, '1.00'],
    [101, '1.01'],
    [280_000, '2800.00'],
  ])('%i minor units is %s on the public detail and card', async (cents, amount) => {
    const { db, findBySlug, detailView, catalogueItem } = await import('@/mocks/handlers/shop/store');
    const product = findBySlug('organic-rolled-oats')!;
    product.skus[0]!.compareAtCents = cents;
    const sku = detailView(product, undefined).skus.find((s) => s.skuId === product.skus[0]!.skuId)!;
    expect(sku.compareAtPrice).toEqual({ amount, currencyCode: 'BDT' });
    // A card carries it only for a product with exactly one active size.
    const single = db.products.find((p) => p.skus.length === 1 && p.skus[0]!.status === 'Active')!;
    single.skus[0]!.compareAtCents = cents;
    expect(catalogueItem(single).compareAtPrice).toEqual({ amount, currencyCode: 'BDT' });
  });
});

describe('the shop mock store key is pinned at v3 (Amended (b), HO-P6 S0)', () => {
  it('persists under the v3 key', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
    try {
      window.sessionStorage.clear();
      vi.resetModules();
      const store = await import('@/mocks/handlers/shop/store');
      expect(store.db.products.length).toBeGreaterThan(0);
      expect(store.db.products.some((p) => p.district)).toBe(true);
      store.persist();
      expect(window.sessionStorage.getItem('__amargram_shop_mock_db__v3')).not.toBeNull();
    } finally {
      Reflect.deleteProperty(navigator, 'serviceWorker');
      window.sessionStorage.clear();
    }
  });
});
