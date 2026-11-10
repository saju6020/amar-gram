import { isFoodCategory } from '@/lib/shop/labels';
import { clearPersisted, loadPersisted, savePersisted } from '../admin/fixtures';
import {
  COUNTRY_NAMES,
  seedOrigins,
  seedProducts,
  seedReviews,
  shopFixtureIds,
  type Availability,
  type MockOrigin,
  type MockProduct,
  type MockReview,
  type MockSku,
} from './fixtures';

/**
 * `mocks/handlers/shop/store.ts` — HO-SHP-002 §12. The shop mock's in-memory database and the view
 * builders that shape it into HO-SHP-001 §12.4's wire models. Persisted to `sessionStorage` in a
 * real browser (the same pattern as `mocks/handlers/admin/fixtures.ts`), so a full-page
 * navigation keeps a mutation; in Vitest and in `msw/node` (server rendering) it is plain module
 * state, always seeded fresh.
 */

// HO-P6 S0 (v3): bumped for isSubscribable. HO-P5 Amended (b): bumped so a browser's stale copy does not hide the new district, certificate and "Was" price seeds.
const PERSIST_KEY = '__amargram_shop_mock_db__v3';

export interface MockAlert {
  stockAlertId: string;
  skuId: string;
  status: 'Pending' | 'Notified' | 'Closed';
  requestedOn: string;
  notifiedOn: string | null;
}
export interface MockWishlistEntry {
  skuId: string;
  addedOn: string;
}
interface Shape {
  products: MockProduct[];
  origins: MockOrigin[];
  reviews: MockReview[];
  wishlist: MockWishlistEntry[];
  alerts: MockAlert[];
}

function seedWishlist(): MockWishlistEntry[] {
  return [
    { skuId: shopFixtureIds.skuOats400, addedOn: '2026-10-01T10:00:00Z' },
    { skuId: 'b0000000-0000-0000-0000-000000009001', addedOn: '2026-09-15T10:00:00Z' },
  ];
}

function seedAlerts(): MockAlert[] {
  return [
    {
      stockAlertId: 'e0000000-0000-0000-0000-000000000001',
      skuId: shopFixtureIds.skuOats4kg,
      status: 'Pending',
      requestedOn: '2026-10-02T10:00:00Z',
      notifiedOn: null,
    },
    {
      stockAlertId: 'e0000000-0000-0000-0000-000000000002',
      skuId: 'b0000000-0000-0000-0000-000000000801',
      status: 'Notified',
      requestedOn: '2026-09-20T10:00:00Z',
      notifiedOn: '2026-10-03T08:00:00Z',
    },
    {
      stockAlertId: 'e0000000-0000-0000-0000-000000000003',
      skuId: 'b0000000-0000-0000-0000-000000009101',
      status: 'Closed',
      requestedOn: '2026-08-20T10:00:00Z',
      notifiedOn: null,
    },
  ];
}

function seed(): Shape {
  return {
    products: seedProducts(),
    origins: seedOrigins(),
    reviews: seedReviews(),
    wishlist: seedWishlist(),
    alerts: seedAlerts(),
  };
}

export const db: Shape = loadPersisted<Shape>(PERSIST_KEY) ?? seed();

export function persist(): void {
  savePersisted(PERSIST_KEY, db);
}

export function resetShopMockData(): void {
  Object.assign(db, seed());
  clearPersisted(PERSIST_KEY);
}

// ---- view builders ---------------------------------------------------------------------------

export const money = (amount: string) => ({ amount, currencyCode: 'BDT' });

/**
 * Minor units (`280000`) to the wire amount (`"2800.00"`) by string handling only: no division, no float
 * (HO-P5 S0 carry-forward: the "Was" price is formatted, never computed).
 */
function centsText(cents: number): string {
  const digits = String(Math.trunc(cents)).padStart(3, '0');
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

const compareAtOf = (sku: MockSku) =>
  sku.compareAtCents == null ? null : money(centsText(sku.compareAtCents));

export const isOnStorefront = (p: MockProduct) => p.status === 'Active' && p.listed;

export function findBySlug(slug: string): MockProduct | undefined {
  return db.products.find((p) => p.slug === slug);
}
export function findById(productId: string): MockProduct | undefined {
  return db.products.find((p) => p.productId === productId);
}
export function findSku(skuId: string): { product: MockProduct; sku: MockSku } | undefined {
  for (const product of db.products) {
    const sku = product.skus.find((s) => s.skuId === skuId);
    if (sku) return { product, sku };
  }
  return undefined;
}

const activeSkus = (p: MockProduct) => p.skus.filter((s) => s.status === 'Active');

export function skuAvailability(p: MockProduct, sku: MockSku): Availability {
  if (p.kind === 'Bundle' && p.bundle) {
    const allIn = p.bundle.every((c) => {
      const found = findSku(c.skuId);
      return found ? found.sku.inStock && found.sku.status === 'Active' : false;
    });
    return allIn ? 'InStock' : 'OutOfStock';
  }
  return sku.inStock ? 'InStock' : 'OutOfStock';
}

export function productAvailability(p: MockProduct): Availability {
  return activeSkus(p).some((s) => skuAvailability(p, s) === 'InStock') ? 'InStock' : 'OutOfStock';
}

const imageFor = (p: MockProduct, isPrimary: boolean, skuId: string | null = null) => ({
  url: null,
  altText: `${p.name} — product photo`,
  isPrimary,
  skuId,
});

export function priceRange(p: MockProduct): { from: string | null; varies: boolean } {
  const prices = activeSkus(p)
    .map((s) => s.price)
    .filter((x): x is string => x !== null);
  if (prices.length === 0) return { from: null, varies: false };
  const sorted = [...prices].sort((a, b) => Number(a) - Number(b));
  return { from: sorted[0]!, varies: new Set(prices).size > 1 };
}

export function catalogueItem(p: MockProduct) {
  const { from, varies } = priceRange(p);
  return {
    productId: p.productId,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    category: p.category,
    subcategory: p.subcategory,
    kind: p.kind,
    countryOfOrigin: p.country
      ? { code: p.country, name: COUNTRY_NAMES[p.country] ?? p.country }
      : null,
    fromPrice: from ? money(from) : null,
    priceVaries: varies,
    availability: productAvailability(p),
    rating: { average: p.ratingAverage, count: p.ratingCount },
    primaryImage: imageFor(p, true),
    // HO-P5 G1/G8/BG-13: Read/ViewModels/CatalogueItem.cs:28-32. The public builder never sends the staff-only
    // certificate expiry and file, or the scheduled "Was" price. The mock's cards are per product, so the
    // "Was" price (a single-size card's field on the server) is sent only when the product has one active size.
    districtOfOrigin: p.district ?? null,
    certifications: p.certifications,
    compareAtPrice: activeSkus(p).length === 1 ? compareAtOf(activeSkus(p)[0]!) : null,
  };
}

/** As the real `Sku.LabelFor` (and `CatalogueSizeExpansion.SizeLabelOf`): null when the SKU has no axis. */
function sizeLabelOf(s: MockSku): string | null {
  const axes = [
    s.sizeOrWeight,
    s.flavour,
    s.colour,
    s.packQuantity !== null ? `Pack of ${s.packQuantity}` : null,
  ].filter((x): x is string => !!x && x.trim() !== '');
  return axes.length > 0 ? axes.join(' · ') : null;
}

export interface CardOptions {
  dearestFirst: boolean;
  minPrice: number | null;
  maxPrice: number | null;
  inStockOnly: boolean;
}

/**
 * One card per size, as `Read/QueryHandlers/Product/CatalogueSizeExpansion.cs` does for each product on a page.
 * A product with one priced active SKU (or none) keeps its single row, now naming its size; with several, each
 * priced active SKU is a card (cheapest first, dearest first on price high-to-low, ties by SKU code) carrying its
 * own price, "Was" price, stock and primary photo. Only the price and in-stock filters apply per size here.
 */
export function catalogueCards(p: MockProduct, options: CardOptions) {
  const base = catalogueItem(p);
  const sizes = activeSkus(p).filter((s) => s.price !== null);
  if (sizes.length === 0) return [base];
  if (sizes.length === 1) {
    const only = sizes[0]!;
    return [{ ...base, skuId: only.skuId, sizeLabel: sizeLabelOf(only), compareAtPrice: compareAtOf(only) }];
  }
  const direction = options.dearestFirst ? -1 : 1;
  const ordered = [...sizes].sort(
    (a, b) =>
      direction * (Number(a.price) - Number(b.price)) ||
      (a.code < b.code ? -1 : a.code > b.code ? 1 : 0),
  );
  return ordered.flatMap((s) => {
    const amount = Number(s.price);
    if (options.minPrice !== null && amount < options.minPrice) return [];
    if (options.maxPrice !== null && amount > options.maxPrice) return [];
    const inStock = skuAvailability(p, s) === 'InStock';
    if (options.inStockOnly && !inStock) return [];
    const photo = p.images.find((i) => i.isPrimary && i.skuId === s.skuId);
    return [
      {
        ...base,
        skuId: s.skuId,
        sizeLabel: sizeLabelOf(s),
        fromPrice: money(Number(s.price).toFixed(2)),
        priceVaries: false,
        compareAtPrice: compareAtOf(s),
        availability: inStock ? ('InStock' as const) : ('OutOfStock' as const),
        primaryImage: photo
          ? { ...imageFor(p, true, s.skuId), altText: photo.altText }
          : base.primaryImage,
      },
    ];
  });
}

export function detailView(p: MockProduct, locale: string | undefined) {
  const translation = locale ? p.translations.find((t) => t.locale === locale) : undefined;
  const pick = (field: 'name' | 'description' | 'ingredientList', base: string | null) => {
    const translated = translation?.[field] ?? null;
    return { value: translated ?? base, locale: translated ? locale! : 'en' };
  };
  const name = pick('name', p.name);
  const description = pick('description', p.description);
  const ingredientList = pick('ingredientList', p.ingredientList);
  const isFood = isFoodCategory(p.category);
  return {
    productId: p.productId,
    slug: p.slug,
    name: name.value!,
    // HO-P5 G1: Read/ViewModels/ProductDetailViewModel.cs:21 (no village).
    districtOfOrigin: p.district ?? null,
    brand: p.brand,
    description: description.value ?? '',
    category: p.category,
    subcategory: p.subcategory,
    tags: p.tags,
    kind: p.kind,
    countryOfOrigin: p.country
      ? { code: p.country, name: COUNTRY_NAMES[p.country] ?? p.country }
      : null,
    food:
      isFood && p.kind === 'Standard'
        ? {
            ingredientList: ingredientList.value,
            storageInstructions: p.storageInstructions,
            shelfLife: p.shelfLife,
            netWeight: p.netWeight,
            allergens: p.allergens,
            organicCertifier: p.organicCertifier,
            organicCertificateNumber: p.organicCertificateNumber,
          }
        : null,
    certifications: p.certifications,
    images: [imageFor(p, true), { ...imageFor(p, false), altText: `${p.name} — back of pack` }],
    skus: activeSkus(p).map((s) => ({
      skuId: s.skuId,
      code: s.code,
      label: s.sizeOrWeight ?? s.flavour ?? s.colour ?? s.code,
      sizeOrWeight: s.sizeOrWeight,
      flavour: s.flavour,
      colour: s.colour,
      packQuantity: s.packQuantity,
      price: s.price ? money(s.price) : null,
      // HO-P5 BG-13: Read/ViewModels/ProductDetailViewModel.cs:12-13.
      compareAtPrice: compareAtOf(s),
      availability: skuAvailability(p, s),
      expiryNotice: s.expiresOn && s.inStock ? { expiresOn: s.expiresOn } : null,
      images:
        s.code === 'OAT-4KG'
          ? [{ ...imageFor(p, true, s.skuId), altText: `${p.name} 4 kg bag` }]
          : [],
    })),
    rating: { average: p.ratingAverage, count: p.ratingCount },
    pricesIncludeTax: false,
    locale: locale && translation ? locale : 'en',
    fieldLocales: {
      name: name.locale,
      description: description.locale,
      ingredientList: ingredientList.locale,
    },
    bundle:
      p.kind === 'Bundle' && p.bundle
        ? {
            components: p.bundle.map((c) => {
              const found = findSku(c.skuId);
              return {
                productName: found?.product.name ?? 'Unknown product',
                productSlug: found?.product.slug ?? c.productSlug,
                skuLabel: found?.sku.sizeOrWeight ?? found?.sku.code ?? '',
                quantity: c.quantity,
                availability: found && found.sku.inStock ? 'InStock' : 'OutOfStock',
              };
            }),
          }
        : null,
  };
}

export function currentPrice(sku: MockSku) {
  return sku.price ? money(sku.price) : null;
}
