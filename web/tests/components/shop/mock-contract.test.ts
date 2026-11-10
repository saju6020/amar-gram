import { describe, expect, it } from 'vitest';
import type { CatalogueResult } from '@/lib/api/shop-catalogue';
import { shopFixtureIds } from '@/mocks/handlers/shop/fixtures';

/** The shop mock is generated from HO-SHP-001 §12.4 — spot-check the shapes the UI relies on. */
describe('shop mock contract — HO-SHP-002 §12', () => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;

  it('answers the catalogue with the real wire shape (images always url: null)', async () => {
    const body = (await (await fetch(`${base}/api/shop/products`)).json()) as CatalogueResult;
    expect(body.totalCount).toBeGreaterThanOrEqual(40);
    expect(body.pageSize).toBe(24);
    expect(body.items.every((i) => i.primaryImage?.url === null)).toBe(true);
    expect(body.appliedFilters.sort).toBe('Newest');
  });

  it('searches with typos and answers a zero-result search with suggestions', async () => {
    const typo = (await (await fetch(`${base}/api/shop/products?q=jasmin%20rice`)).json()) as {
      totalCount: number;
    };
    expect(typo.totalCount).toBeGreaterThan(0);
    const none = (await (await fetch(`${base}/api/shop/products?q=zzqqxx`)).json()) as {
      totalCount: number;
      suggestions: { popular: unknown[] };
    };
    expect(none.totalCount).toBe(0);
    expect(none.suggestions.popular).toHaveLength(8);
  });

  // CatalogueSizeExpansion.cs: one card per active, priced size; paging and totalCount stay per product.
  describe('one card per size (owner, 2026-10-18)', () => {
    const list = async (query: string) =>
      (await (await fetch(`${base}/api/shop/products?${query}`)).json()) as CatalogueResult;

    it('spreads a multi-size product into its sizes, cheapest first, each with its own sku, label and price', async () => {
      const body = await list('q=rolled%20oats');
      const oats = body.items.filter((i) => i.slug === 'organic-rolled-oats');
      expect(oats.map((i) => i.skuId)).toEqual([
        shopFixtureIds.skuOats400,
        shopFixtureIds.skuOats2kg,
        shopFixtureIds.skuOats4kg,
      ]);
      expect(oats.every((i) => i.sizeLabel)).toBe(true);
      expect(oats.every((i) => i.priceVaries === false)).toBe(true);
      const prices = oats.map((i) => Number(i.fromPrice?.amount));
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
      expect(new Set(prices).size).toBe(3);
    });

    it('lists the sizes dearest first when sorting by price, high to low', async () => {
      const body = await list('q=rolled%20oats&sort=price_desc');
      const oats = body.items.filter((i) => i.slug === 'organic-rolled-oats');
      expect(oats[0]?.skuId).toBe(shopFixtureIds.skuOats4kg);
      expect(oats.at(-1)?.skuId).toBe(shopFixtureIds.skuOats400);
    });

    it('applies the price filter per size, so a size outside it is not shown', async () => {
      const all = await list('q=rolled%20oats');
      const cheapest = Number(
        all.items.find((i) => i.skuId === shopFixtureIds.skuOats400)?.fromPrice?.amount,
      );
      const body = await list(`q=rolled%20oats&maxPrice=${cheapest}`);
      const oats = body.items.filter((i) => i.slug === 'organic-rolled-oats');
      expect(oats.map((i) => i.skuId)).toEqual([shopFixtureIds.skuOats400]);
    });

    it('applies the minimum price per size too, so only the dearer sizes are shown', async () => {
      const all = await list('q=rolled%20oats');
      const dearest = Number(
        all.items.find((i) => i.skuId === shopFixtureIds.skuOats4kg)?.fromPrice?.amount,
      );
      const body = await list(`q=rolled%20oats&minPrice=${dearest}`);
      const oats = body.items.filter((i) => i.slug === 'organic-rolled-oats');
      expect(oats.map((i) => i.skuId)).toEqual([shopFixtureIds.skuOats4kg]);
    });

    it('always sends skuId and sizeLabel, as the server does (null when a product has no priced size)', async () => {
      const body = await list('');
      for (const item of body.items) {
        expect(item).toHaveProperty('skuId');
        expect(item).toHaveProperty('sizeLabel');
      }
    });

    it('pages per product: totalCount counts products, totalItemCount is at least the active sizes', async () => {
      const body = await list('');
      const products = new Set(body.items.map((i) => i.productId));
      expect(products.size).toBeLessThanOrEqual(body.pageSize);
      expect(body.items.length).toBeGreaterThan(products.size);
      expect(body.totalItemCount).toBeGreaterThan(body.totalCount);
    });
  });
});
