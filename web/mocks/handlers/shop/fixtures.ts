import { HttpResponse } from 'msw';
import { accountsFixtureIds } from '../areas/accounts';
import { administrationFixtureIds } from '../admin/fixtures';

/**
 * `mocks/handlers/shop/fixtures.ts` — HO-SHP-002 §12. Ids and the seeded catalogue, generated
 * from HO-SHP-001 §12.4 (never invented fields). Shared by the browser worker and `msw/node`
 * (server rendering in mock mode), so everything here is plain data with no browser dependency.
 *
 * Image `url` is ALWAYS `null`, exactly like the merged API (backlog SHP row 2) — the UI renders
 * the placeholder.
 */

const uuid = (prefix: string, n: number) =>
  `${prefix}0000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

export const shopFixtureIds = {
  customerId: accountsFixtureIds.customerId,
  /** The staff tax class every seeded product uses (HO-ADM-001 list). */
  taxClassId: administrationFixtureIds.taxClassStandardId,

  /** Three variants: 400 g and 2 kg in stock (2 kg carries an expiry notice), 4 kg out of stock. */
  multiVariantSlug: 'organic-rolled-oats',
  multiVariantProductId: uuid('a', 1),
  skuOats400: uuid('b', 101),
  skuOats2kg: uuid('b', 102),
  skuOats4kg: uuid('b', 103),
  /** Thai rice — the AC-5 path. */
  thaiRiceSlug: 'thai-jasmine-rice',
  thaiRiceProductId: uuid('a', 2),
  skuJasmineRice: uuid('b', 201),
  /** Kit whose second component is out of stock. */
  kitSlug: 'breakfast-starter-kit',
  kitProductId: uuid('a', 7),
  skuKit: uuid('b', 701),
  /** A product the customer has bought and can review. */
  reviewableSlug: 'organic-rolled-oats',
  /** A product the customer already reviewed. */
  alreadyReviewedSlug: 'thai-jasmine-rice',
  /** Standing in for "a customer who granted no marketing consent": an alert here says it will not
   *  be delivered (`willNotify: false`). The real flag is the routing policy's, not a SKU's. */
  skuAlertNoConsent: uuid('b', 801),
  noConsentSlug: 'red-lentils-masoor',
  /** Out-of-stock SKU whose alert is delivered. */
  skuAlertDelivered: uuid('b', 103),
  /** A Draft product (404 on the storefront) and an Active one with an unmet checklist. */
  draftProductId: uuid('a', 90),
  draftSlug: 'draft-herbal-soap',
  unmetChecklistProductId: uuid('a', 91),
  pendingReviewId: uuid('d', 1),
  publishedReviewId: uuid('d', 2),
  rejectedReviewId: uuid('d', 3),
  hiddenReviewId: uuid('d', 4),
  moderationPendingReviewId: uuid('d', 11),
  priceSkuId: uuid('b', 101),
  /** HO-P5 S0 (BG-14): the uploaded organic certificate on the oats product (the mustard-oil certificate has expired and has no file). */
  organicCertificateFileId: uuid('e', 1),
  /** HO-P5 S0: the two seeded certified-organic products, valid and expired. */
  certificateValidSlug: 'organic-rolled-oats',
  certificateExpiredSlug: 'pure-mustard-oil',
} as const;

export type Availability = 'InStock' | 'OutOfStock';

export interface MockSku {
  skuId: string;
  code: string;
  barcode: string | null;
  sizeOrWeight: string | null;
  flavour: string | null;
  colour: string | null;
  packQuantity: number | null;
  shippingWeightGrams: number | null;
  status: 'Active' | 'Discontinued';
  /** Current price amount, or null when never priced. */
  price: string | null;
  scheduledPrice: { amount: string; effectiveFrom: string } | null;
  /** HO-P5 BG-13 "Was" price in minor units: Read/ViewModels/CatalogueItem.cs:31-32, StaffProductDetailViewModel.cs:23-25. */
  compareAtCents?: number | null;
  scheduledCompareAtCents?: number | null;
  inStock: boolean;
  expiresOn: string | null;
}

export interface MockTranslation {
  locale: string;
  name: string | null;
  description: string | null;
  ingredientList: string | null;
}

export interface MockProduct {
  productId: string;
  slug: string;
  version: number;
  name: string;
  brand: string;
  description: string;
  category: string;
  subcategory: string | null;
  kind: 'Standard' | 'Bundle';
  status: 'Draft' | 'Active' | 'Archived';
  listed: boolean;
  country: string | null;
  tags: string[];
  ingredientList: string | null;
  storageInstructions: string | null;
  shelfLife: string | null;
  netWeight: string | null;
  allergens: string | null;
  organicCertifier: string | null;
  organicCertificateNumber: string | null;
  /** HO-P5 BG-14 (StaffProductDetailViewModel.cs:27-33): `yyyy-MM-dd` expiry and the uploaded file id. */
  organicCertificateExpiresOn?: string | null;
  organicCertificateFileId?: string | null;
  /** HO-P5 G1 / BG-12: Read/ViewModels/CatalogueItem.cs:28-29, ProductDetailViewModel.cs:21. A district name, no village. */
  district?: string | null;
  /** HO-P2 §1.3 certification names (`CertifiedOrganic`, `PesticideFree`, `Traditional`, `Halal`). */
  certifications: string[];
  images: Array<{
    fileId: string;
    altText: string;
    sortOrder: number;
    isPrimary: boolean;
    skuId: string | null;
  }>;
  skus: MockSku[];
  ratingAverage: number | null;
  ratingCount: number;
  createdAt: string;
  sold: number;
  bundle: Array<{ productSlug: string; skuId: string; quantity: number }> | null;
  related: Array<{ slug: string; kind: 'FrequentlyBoughtTogether' | 'UpSell'; sortOrder: number }>;
  translations: MockTranslation[];
  taxClassId: string;
  isExpiryTracked: boolean;
  firstPublishedOn: string | null;
  /** HO-P6 S0: Read/ViewModels/StaffProductDetailViewModel.cs:63. Absent = false (a stale persisted copy). */
  isSubscribable?: boolean;
}

export const COUNTRY_NAMES: Record<string, string> = {
  DE: 'Germany',
  TH: 'Thailand',
  TR: 'Türkiye',
  US: 'United States',
  KR: 'South Korea',
  FR: 'France',
  JP: 'Japan',
  IN: 'India',
  BD: 'Bangladesh',
};

/** HO-P2 §1.1/§1.2 — mirrors `ProductCategory` / `ProductSubcategory` in the API. */
export const CATEGORY_TREE: Record<string, string[]> = {
  RiceAndGrains: ['AromaticRice', 'EverydayRice', 'FlattenedAndPuffedRice', 'Flour'],
  HoneyAndGur: ['Honey', 'DateMolasses', 'SugarcaneGur'],
  OilsAndGhee: ['MustardOil', 'Ghee', 'OtherOils'],
  Spices: ['GroundSpices', 'WholeSpices', 'SpiceBlends'],
  Pulses: ['Lentils', 'ChickpeasAndPeas'],
  TeaAndDrinks: ['Tea', 'HerbalTea', 'JuicesAndSyrups'],
  FreshProduce: ['Fruit', 'Vegetables'],
  DatesAndDryFruit: ['Dates', 'Nuts', 'DriedFruit'],
  DairyAndEggs: ['Eggs', 'MilkAndYoghurt'],
  SnacksAndSweets: ['Snacks', 'TraditionalSweets', 'Pickles'],
  HouseholdAndCare: ['JuteAndBags', 'NaturalCare'],
};

export const MOCK_NOW = '2026-10-04T08:00:00Z';

const DESCRIPTION = [
  'Wholesome food from **trusted farms**.',
  '',
  '- Naturally rich in fibre',
  '- No artificial additives',
  '',
  'Read the [preparation guide](/shop) before cooking.',
].join('\n');

function sku(
  n: number,
  code: string,
  label: string,
  price: string | null,
  inStock: boolean,
  extra: Partial<MockSku> = {},
): MockSku {
  return {
    skuId: uuid('b', n),
    code,
    barcode: `89${String(n).padStart(11, '0')}`,
    sizeOrWeight: label,
    flavour: null,
    colour: null,
    packQuantity: null,
    shippingWeightGrams: null,
    status: 'Active',
    price,
    scheduledPrice: null,
    inStock,
    expiresOn: null,
    ...extra,
  };
}

function product(
  p: Partial<MockProduct> & Pick<MockProduct, 'productId' | 'slug' | 'name' | 'brand' | 'skus'>,
): MockProduct {
  return {
    version: 1,
    description: DESCRIPTION,
    category: 'RiceAndGrains',
    subcategory: 'EverydayRice',
    kind: 'Standard',
    status: 'Active',
    listed: true,
    country: null,
    tags: [],
    ingredientList: null,
    storageInstructions: null,
    shelfLife: null,
    netWeight: null,
    allergens: null,
    organicCertifier: null,
    organicCertificateNumber: null,
    certifications: [],
    images: [],
    ratingAverage: null,
    ratingCount: 0,
    createdAt: '2026-06-01T00:00:00Z',
    sold: 0,
    bundle: null,
    related: [],
    translations: [],
    taxClassId: shopFixtureIds.taxClassId,
    isExpiryTracked: false,
    firstPublishedOn: '2026-06-01T00:00:00Z',
    isSubscribable: false,
    ...p,
  };
}

function food(extra: Partial<MockProduct>): Partial<MockProduct> {
  return {
    category: 'RiceAndGrains',
    storageInstructions: 'Store in a cool, dry place. Keep the bag sealed once opened.',
    shelfLife: '12 months from packing',
    netWeight: '1 kg',
    allergens: 'None',
    isExpiryTracked: true,
    ...extra,
  };
}

/** Producers for the generated catalogue (HO-P2 §1.4: the API's `brand` column holds the producer). */
const PRODUCERS: Array<{ brand: string; country: string }> = [
  { brand: 'Sonar Bangla Farms', country: 'BD' },
  { brand: 'Padma Organics', country: 'BD' },
  { brand: 'Haat Bazaar Co-op', country: 'BD' },
  { brand: 'Sundarbans Harvest', country: 'BD' },
  { brand: 'Meghna Naturals', country: 'BD' },
  { brand: 'Teesta Valley', country: 'BD' },
  { brand: 'Green Valley', country: 'TH' },
  { brand: 'Golden Harvest', country: 'IN' },
  { brand: 'Black Forest Mill', country: 'DE' },
];
const GENERATED_LINES: Array<{
  category: string;
  subcategory: string;
  name: string;
  tag: string;
  district: string;
}> = [
  { category: 'RiceAndGrains', subcategory: 'AromaticRice', name: 'Kalijira Rice', tag: 'rice', district: 'Netrokona' },
  { category: 'RiceAndGrains', subcategory: 'EverydayRice', name: 'Miniket Rice', tag: 'rice', district: 'Naogaon' },
  { category: 'HoneyAndGur', subcategory: 'SugarcaneGur', name: 'Sugarcane Gur', tag: 'gur', district: 'Natore' },
  { category: 'OilsAndGhee', subcategory: 'Ghee', name: 'Desi Ghee', tag: 'ghee', district: 'Pabna' },
  { category: 'Spices', subcategory: 'GroundSpices', name: 'Turmeric Powder', tag: 'spice', district: 'Bandarban' },
  { category: 'Pulses', subcategory: 'Lentils', name: 'Moong Dal', tag: 'dal', district: 'Patuakhali' },
  { category: 'TeaAndDrinks', subcategory: 'Tea', name: 'Sylhet Green Tea', tag: 'tea', district: 'Sylhet' },
  { category: 'FreshProduce', subcategory: 'Fruit', name: 'Himsagar Mango', tag: 'fruit', district: 'Chapainawabganj' },
  { category: 'DatesAndDryFruit', subcategory: 'Dates', name: 'Khejur Dates', tag: 'dates', district: 'Jashore' },
  { category: 'DairyAndEggs', subcategory: 'Eggs', name: 'Free-range Eggs', tag: 'eggs', district: 'Gazipur' },
  { category: 'SnacksAndSweets', subcategory: 'Pickles', name: 'Olive Pickle', tag: 'pickle', district: 'Bogura' },
];
/** HO-P5 Amended (g): districts for the Bangladeshi food in `seedGenerated`'s `others` list. */
const OTHER_FOOD_DISTRICTS: Record<string, string> = {
  'Tulsi Herbal Tea': 'Panchagarh',
  'Bel Sharbat Syrup': 'Chapainawabganj',
  'Nolen Gur Sandesh': 'Jashore',
  'Puffed Rice Muri': 'Jhalokathi',
  'Seasonal Vegetable Box': 'Jashore',
  'Mishti Doi': 'Bogura',
};
const GRADES = ['Classic', 'Premium', 'Family'];
const CERTIFICATION_CYCLE: string[][] = [
  ['CertifiedOrganic'],
  [],
  ['PesticideFree', 'Traditional'],
  ['Halal'],
];

function seedGenerated(): MockProduct[] {
  const out: MockProduct[] = [];
  let n = 200;
  for (const [bi, b] of PRODUCERS.entries()) {
    for (const [si, grade] of GRADES.entries()) {
      n += 1;
      const line = GENERATED_LINES[(bi * 3 + si) % GENERATED_LINES.length]!;
      const slug = `${b.brand.toLowerCase().replace(/[^a-z]+/g, '-')}-${grade.toLowerCase()}-${line.name.toLowerCase().replace(/[^a-z]+/g, '-')}-${n}`;
      const base = 450 + ((bi * 7 + si * 13) % 9) * 110;
      const stocked = (bi + si) % 4 !== 3;
      const certifications = CERTIFICATION_CYCLE[(bi + si) % CERTIFICATION_CYCLE.length]!;
      out.push(
        product({
          productId: uuid('a', n),
          slug,
          name: `${b.brand} ${grade} ${line.name}`,
          brand: b.brand,
          category: line.category,
          subcategory: line.subcategory,
          country: b.country,
          district: b.country === 'BD' ? line.district : null,
          tags: [line.tag, si === 0 ? 'organic' : 'everyday'],
          ingredientList: `${line.name} (100%)`,
          ratingAverage: 3 + ((bi + si) % 3) * 0.7,
          ratingCount: 4 + bi * 3 + si,
          createdAt: `2026-0${1 + ((bi + si) % 8)}-15T00:00:00Z`,
          sold: 10 + bi * 17 + si * 5,
          ...food({ category: line.category }),
          certifications,
          ...(certifications.includes('CertifiedOrganic')
            ? {
                organicCertifier: 'Bangladesh Organic Council',
                organicCertificateNumber: `BOC-${n}`,
              }
            : {}),
          skus: [
            sku(n * 10 + 1, `GEN-${n}-S`, '500 g', String(base) + '.00', stocked),
            sku(
              n * 10 + 2,
              `GEN-${n}-L`,
              '2 kg',
              String(base * 4 - 200) + '.00',
              stocked && si !== 1,
              {
                expiresOn: stocked ? '2027-03-01' : null,
              },
            ),
          ],
        }),
      );
    }
  }
  const others: Array<[string, string, string, string, string, string]> = [
    ['HouseholdAndCare', 'JuteAndBags', 'Jute Shopping Bag', 'Sonar Bangla Farms', 'BD', '250.00'],
    ['HouseholdAndCare', 'JuteAndBags', 'Jute Produce Pouch', 'Sonar Bangla Farms', 'BD', '180.00'],
    ['HouseholdAndCare', 'NaturalCare', 'Herbal Hand Balm', 'Meghna Naturals', 'BD', '780.00'],
    ['HouseholdAndCare', 'NaturalCare', 'Neem Soap Bar', 'Meghna Naturals', 'BD', '220.00'],
    ['TeaAndDrinks', 'HerbalTea', 'Tulsi Herbal Tea', 'Teesta Valley', 'BD', '420.00'],
    ['TeaAndDrinks', 'JuicesAndSyrups', 'Bel Sharbat Syrup', 'Haat Bazaar Co-op', 'BD', '350.00'],
    [
      'SnacksAndSweets',
      'TraditionalSweets',
      'Nolen Gur Sandesh',
      'Haat Bazaar Co-op',
      'BD',
      '600.00',
    ],
    ['SnacksAndSweets', 'Snacks', 'Puffed Rice Muri', 'Haat Bazaar Co-op', 'BD', '120.00'],
    ['FreshProduce', 'Vegetables', 'Seasonal Vegetable Box', 'Padma Organics', 'BD', '900.00'],
    ['DairyAndEggs', 'MilkAndYoghurt', 'Mishti Doi', 'Padma Organics', 'BD', '320.00'],
    ['DatesAndDryFruit', 'Nuts', 'Roasted Cashew Nuts', 'Golden Harvest', 'IN', '1400.00'],
    ['Spices', 'WholeSpices', 'Whole Cumin Seeds', 'Golden Harvest', 'IN', '480.00'],
  ];
  for (const [category, subcategory, name, brand, country, price] of others) {
    n += 1;
    const isFood = category !== 'HouseholdAndCare';
    out.push(
      product({
        productId: uuid('a', n),
        slug: name.toLowerCase().replace(/[^a-z]+/g, '-'),
        name,
        brand,
        category,
        subcategory,
        country,
        district: OTHER_FOOD_DISTRICTS[name] ?? null,
        tags: [category.toLowerCase()],
        ratingAverage: 4.2,
        ratingCount: 9,
        sold: 30 + n,
        ...(isFood ? food({ category }) : {}),
        skus: [sku(n * 10 + 1, `GEN-${n}`, 'Standard', price, n % 5 !== 0)],
      }),
    );
  }
  return out;
}

/**
 * HO-P6 S0: the food products a customer can subscribe to (oats with three sizes, rice, gur, garam masala with
 * two sizes, mustard oil, honey, red lentils, mango pickle, dates). Every other product, kits and household
 * items included, is not offered. The subscriptions mock seeds subscriptions on these SKUs.
 */
const SUBSCRIBABLE_PRODUCT_NUMBERS: ReadonlySet<string> = new Set(
  [1, 2, 3, 4, 5, 6, 8, 9, 10].map((n) => uuid('a', n)),
);

export function seedProducts(): MockProduct[] {
  const hand: MockProduct[] = [
    product({
      productId: shopFixtureIds.multiVariantProductId,
      slug: shopFixtureIds.multiVariantSlug,
      name: 'Organic Rolled Oats',
      brand: 'Amar Gram Farms',
      subcategory: 'FlattenedAndPuffedRice',
      country: 'BD',
      tags: ['oats', 'breakfast', 'organic'],
      district: 'Dinajpur',
      organicCertificateExpiresOn: '2030-12-31',
      organicCertificateFileId: shopFixtureIds.organicCertificateFileId,
      certifications: ['CertifiedOrganic', 'PesticideFree'],
      organicCertifier: 'Bangladesh Organic Council',
      organicCertificateNumber: 'BOC-2026-0142',
      ingredientList: 'Whole grain rolled oats (100%)',
      ratingAverage: 4.5,
      ratingCount: 23,
      sold: 240,
      createdAt: '2026-09-01T00:00:00Z',
      ...food({}),
      related: [
        { slug: shopFixtureIds.thaiRiceSlug, kind: 'FrequentlyBoughtTogether', sortOrder: 1 },
        { slug: 'herbal-hand-balm', kind: 'UpSell', sortOrder: 1 },
      ],
      skus: [
        sku(101, 'OAT-400G', '400 g', '650.00', true),
        sku(102, 'OAT-2KG', '2 kg', '2450.00', true, {
          compareAtCents: 280_000,
          scheduledCompareAtCents: 300_000,
          shippingWeightGrams: 2100,
          expiresOn: '2026-11-12',
          scheduledPrice: { amount: '2600.00', effectiveFrom: '2026-12-01T00:00:00Z' },
        }),
        sku(103, 'OAT-4KG', '4 kg', '4400.00', false),
      ],
    }),
    product({
      productId: shopFixtureIds.thaiRiceProductId,
      slug: shopFixtureIds.thaiRiceSlug,
      name: 'Thai Jasmine Rice',
      brand: 'Green Valley',
      subcategory: 'AromaticRice',
      country: 'TH',
      tags: ['rice', 'jasmine', 'long-grain'],
      certifications: ['PesticideFree'],
      ingredientList: 'Jasmine rice (100%)',
      ratingAverage: 4,
      ratingCount: 8,
      sold: 180,
      createdAt: '2026-08-01T00:00:00Z',
      ...food({}),
      skus: [sku(201, 'JR-1KG', '1 kg', '780.00', true)],
      translations: [
        {
          locale: 'bn',
          name: 'থাই জেসমিন চাল',
          description: 'সুগন্ধি লম্বা দানার চাল।',
          ingredientList: 'জেসমিন চাল (১০০%)',
        },
      ],
    }),
    product({
      productId: uuid('a', 3),
      slug: 'date-palm-gur',
      name: 'Date Palm Gur',
      brand: 'Sundarbans Harvest',
      category: 'HoneyAndGur',
      subcategory: 'DateMolasses',
      country: 'BD',
      tags: ['gur', 'jessore', 'winter'],
      district: 'Satkhira',
      certifications: ['Traditional'],
      ingredientList: 'Date palm sap (100%)',
      ratingAverage: 3.8,
      ratingCount: 12,
      sold: 150,
      createdAt: '2026-07-10T00:00:00Z',
      ...food({ category: 'HoneyAndGur' }),
      skus: [sku(301, 'GUR-1KG', '1 kg', '690.00', true, { compareAtCents: 79_000 })],
    }),
    product({
      productId: uuid('a', 4),
      slug: 'garam-masala-blend',
      name: 'Garam Masala Blend',
      brand: 'Haat Bazaar Co-op',
      category: 'Spices',
      subcategory: 'SpiceBlends',
      country: 'BD',
      tags: ['spice', 'masala'],
      district: 'Sylhet',
      certifications: ['Halal'],
      ingredientList: 'Coriander, cumin, cardamom, cinnamon, clove, black pepper',
      ratingAverage: 4.7,
      ratingCount: 31,
      sold: 300,
      ...food({ category: 'Spices' }),
      skus: [
        sku(401, 'GM-250G', '250 g', '1800.00', true),
        sku(402, 'GM-750G', '750 g', '4900.00', true),
      ],
    }),
    product({
      productId: uuid('a', 5),
      slug: 'pure-mustard-oil',
      name: 'Pure Mustard Oil',
      brand: 'Padma Organics',
      category: 'OilsAndGhee',
      subcategory: 'MustardOil',
      country: 'BD',
      tags: ['oil', 'mustard', 'cold-pressed'],
      district: 'Sirajganj',
      organicCertificateExpiresOn: '2025-12-31',
      certifications: ['CertifiedOrganic'],
      organicCertifier: 'Bangladesh Organic Council',
      organicCertificateNumber: 'BOC-2026-0187',
      ingredientList: 'Cold-pressed mustard seed oil (100%)',
      ratingAverage: 4.4,
      ratingCount: 6,
      sold: 90,
      ...food({ category: 'OilsAndGhee' }),
      skus: [sku(501, 'MO-1_5L', '1.5 L', '3800.00', true)],
    }),
    product({
      productId: uuid('a', 6),
      slug: 'raw-forest-honey',
      name: 'Raw Forest Honey',
      brand: 'Sundarbans Harvest',
      category: 'HoneyAndGur',
      subcategory: 'Honey',
      country: 'BD',
      tags: ['honey', 'raw'],
      district: 'Satkhira',
      certifications: ['Traditional'],
      ingredientList: 'Raw honey (100%)',
      ratingAverage: 4.1,
      ratingCount: 3,
      sold: 40,
      ...food({ category: 'HoneyAndGur' }),
      skus: [sku(601, 'HONEY-500G', '500 g', '4100.00', true)],
    }),
    product({
      productId: shopFixtureIds.kitProductId,
      slug: shopFixtureIds.kitSlug,
      name: 'Breakfast Starter Kit',
      brand: 'Amar Gram',
      kind: 'Bundle',
      category: 'RiceAndGrains',
      subcategory: 'FlattenedAndPuffedRice',
      tags: ['kit', 'breakfast'],
      ratingAverage: null,
      ratingCount: 0,
      sold: 20,
      skus: [sku(701, 'KIT-BREAKFAST', 'Starter kit', '1500.00', true)],
      bundle: [
        {
          productSlug: shopFixtureIds.multiVariantSlug,
          skuId: shopFixtureIds.skuOats400,
          quantity: 1,
        },
        { productSlug: 'jute-shopping-bag', skuId: uuid('b', 9999), quantity: 2 },
      ],
    }),
    product({
      productId: uuid('a', 8),
      slug: shopFixtureIds.noConsentSlug,
      name: 'Red Lentils (Masoor Dal)',
      brand: 'Teesta Valley',
      category: 'Pulses',
      subcategory: 'Lentils',
      country: 'TR',
      tags: ['lentils', 'dal'],
      ingredientList: 'Split red lentils (100%)',
      ratingAverage: 3.9,
      ratingCount: 5,
      sold: 70,
      ...food({ category: 'Pulses' }),
      skus: [sku(801, 'RL-1KG', '1 kg', '1250.00', false)],
    }),
    product({
      productId: uuid('a', 9),
      slug: 'mango-pickle',
      name: 'Mango Pickle (Achar)',
      brand: 'Haat Bazaar Co-op',
      category: 'SnacksAndSweets',
      subcategory: 'Pickles',
      country: 'BD',
      tags: ['pickle', 'mango', 'achar'],
      district: 'Bogura',
      certifications: ['Traditional'],
      ingredientList: 'Green mango, mustard oil, salt, spices',
      ratingAverage: 4.6,
      ratingCount: 17,
      sold: 120,
      ...food({ category: 'SnacksAndSweets' }),
      skus: [sku(901, 'MP-400G', '400 g', '520.00', true)],
    }),
    product({
      productId: uuid('a', 10),
      slug: 'khejur-dates',
      name: 'Khejur Dates',
      brand: 'Sundarbans Harvest',
      category: 'DatesAndDryFruit',
      subcategory: 'Dates',
      country: 'KR',
      tags: ['dates', 'dried'],
      ingredientList: 'Dates (100%)',
      ratingAverage: 4.3,
      ratingCount: 10,
      sold: 60,
      ...food({ category: 'DatesAndDryFruit' }),
      skus: [sku(1001, 'KD-1KG', '1 kg', '1650.00', true)],
    }),
    product({
      productId: shopFixtureIds.draftProductId,
      slug: shopFixtureIds.draftSlug,
      name: 'Herbal Soap (draft)',
      brand: 'Meghna Naturals',
      category: 'HouseholdAndCare',
      subcategory: 'NaturalCare',
      status: 'Draft',
      firstPublishedOn: null,
      skus: [sku(9001, 'DRAFT-1', 'Standard', null, false)],
    }),
    product({
      productId: shopFixtureIds.unmetChecklistProductId,
      slug: 'unmet-checklist-food',
      name: 'Unfinished Muesli',
      brand: 'Padma Organics',
      ...food({}),
      status: 'Draft',
      firstPublishedOn: null,
      skus: [sku(9101, 'UNMET-1', '1 kg', null, false)],
    }),
  ];
  // Make the kit's second component a real out-of-stock product (the jute shopping bag).
  const generated = seedGenerated();
  const juteBag = generated.find((g) => g.slug === 'jute-shopping-bag');
  if (juteBag) {
    juteBag.skus[0]!.skuId = uuid('b', 9999);
    juteBag.skus[0]!.inStock = false;
  }
  return [...hand, ...generated].map((p) => ({
    ...p,
    isSubscribable: SUBSCRIBABLE_PRODUCT_NUMBERS.has(p.productId),
  }));
}

export interface MockOrigin {
  code: string;
  sourcingNotes: string | null;
  isFeatured: boolean;
  sortOrder: number;
}

export function seedOrigins(): MockOrigin[] {
  return [
    {
      code: 'TH',
      sourcingNotes:
        'Our Thai partners cook in small batches near **Bangkok**. Every lot is tested before it ships to Dhaka, and we visit the plant each year to check hygiene and storage.',
      isFeatured: true,
      sortOrder: 1,
    },
    {
      code: 'DE',
      sourcingNotes: 'Cold-pressed oils and specialty foods from a family-run German mill.',
      isFeatured: true,
      sortOrder: 2,
    },
    {
      code: 'US',
      sourcingNotes: 'Whole grains and pantry staples from established US farms.',
      isFeatured: false,
      sortOrder: 3,
    },
    { code: 'TR', sourcingNotes: null, isFeatured: false, sortOrder: 4 },
    { code: 'KR', sourcingNotes: null, isFeatured: false, sortOrder: 5 },
  ];
}

export interface MockReview {
  reviewId: string;
  productId: string;
  slug: string;
  productName: string;
  skuId: string;
  skuLabel: string;
  rating: number;
  title: string | null;
  body: string;
  status: 'PendingModeration' | 'Published' | 'Rejected' | 'Hidden';
  submittedOn: string;
  authorDisplayName: string;
  mine: boolean;
}

export function seedReviews(): MockReview[] {
  const base = {
    productId: shopFixtureIds.multiVariantProductId,
    slug: shopFixtureIds.multiVariantSlug,
    productName: 'Organic Rolled Oats',
    skuId: shopFixtureIds.skuOats2kg,
    skuLabel: '2 kg',
  };
  return [
    {
      ...base,
      reviewId: shopFixtureIds.publishedReviewId,
      rating: 5,
      title: 'Our family loves it',
      body: 'Cooks evenly and tastes fresh. Would buy again.',
      status: 'Published',
      submittedOn: '2026-10-03T09:00:00Z',
      authorDisplayName: 'Rahim K.',
      mine: false,
    },
    {
      ...base,
      reviewId: uuid('d', 5),
      rating: 4,
      title: 'Good, but pricey',
      body: 'Great quality. <b>Not</b> cheap though **really**.',
      status: 'Published',
      submittedOn: '2026-09-20T09:00:00Z',
      authorDisplayName: 'A verified buyer',
      mine: false,
    },
    {
      ...base,
      productId: shopFixtureIds.thaiRiceProductId,
      slug: shopFixtureIds.thaiRiceSlug,
      productName: 'Thai Jasmine Rice',
      skuId: shopFixtureIds.skuJasmineRice,
      skuLabel: '1 kg',
      reviewId: shopFixtureIds.pendingReviewId,
      rating: 4,
      title: 'Lovely aroma',
      body: 'The aroma filled the kitchen when I opened the bag.',
      status: 'PendingModeration',
      submittedOn: '2026-10-02T09:00:00Z',
      authorDisplayName: 'You',
      mine: true,
    },
    {
      ...base,
      productId: uuid('a', 4),
      slug: 'chicken-masala-mix',
      productName: 'Chicken Masala Mix',
      skuId: uuid('b', 401),
      skuLabel: '1 kg',
      reviewId: shopFixtureIds.rejectedReviewId,
      rating: 1,
      title: null,
      body: 'Not for us.',
      status: 'Rejected',
      submittedOn: '2026-09-10T09:00:00Z',
      authorDisplayName: 'You',
      mine: true,
    },
    {
      ...base,
      productId: uuid('a', 9),
      slug: 'slow-cooked-beef-curry',
      productName: 'Slow-cooked Beef Curry',
      skuId: uuid('b', 901),
      skuLabel: '400 g',
      reviewId: shopFixtureIds.hiddenReviewId,
      rating: 3,
      title: 'Okay',
      body: 'Fine for the price.',
      status: 'Hidden',
      submittedOn: '2026-08-10T09:00:00Z',
      authorDisplayName: 'You',
      mine: true,
    },
    {
      ...base,
      reviewId: shopFixtureIds.moderationPendingReviewId,
      rating: 2,
      title: 'Too small bag',
      body: 'Wish the bag was bigger.',
      status: 'PendingModeration',
      submittedOn: '2026-10-04T05:00:00Z',
      authorDisplayName: 'Nadia S.',
      mine: false,
    },
  ];
}

export function badRequest(
  propertyName: string,
  errorCode: string,
  errorMessage: string,
  resourceName = 'Product',
) {
  return HttpResponse.json(
    { errors: [{ propertyName, errorCode, errorMessage, resourceName }], isValid: false },
    { status: 400 },
  );
}
