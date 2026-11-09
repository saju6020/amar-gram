import type { CatalogueFilters, CatalogueItem, CategoryNode } from '@/lib/api/shop-catalogue';

export function makeItem(overrides: Partial<CatalogueItem> = {}): CatalogueItem {
  return {
    productId: 'p-1',
    slug: 'organic-rolled-oats',
    name: 'Organic Rolled Oats',
    brand: 'Amar Gram Farms',
    category: 'RiceAndGrains',
    subcategory: 'FlattenedAndPuffedRice',
    kind: 'Standard',
    countryOfOrigin: { code: 'BD', name: 'Bangladesh' },
    fromPrice: { amount: '650.00', currencyCode: 'BDT' },
    priceVaries: false,
    availability: 'InStock',
    rating: { average: 4.5, count: 23 },
    primaryImage: { url: null, altText: 'Organic Rolled Oats bag', isPrimary: true },
    ...overrides,
  };
}

export const FACETS: CatalogueFilters = {
  brands: [
    { name: 'Amar Gram Farms', count: 4 },
    { name: 'Sunfield', count: 6 },
  ],
  origins: [
    { code: 'TH', name: 'Thailand', count: 9 },
    { code: 'JP', name: 'Japan', count: 2 },
  ],
  certifications: [{ value: 'CertifiedOrganic', count: 3 }],
  price: { min: 250, max: 5200 },
  districts: [],
};

export const CATEGORIES: CategoryNode[] = [
  {
    value: 'RiceAndGrains',
    productCount: 20,
    subcategories: [
      { value: 'AromaticRice', productCount: 10 },
      { value: 'FlattenedAndPuffedRice', productCount: 5 },
    ],
  },
  { value: 'HouseholdAndCare', productCount: 4, subcategories: [] },
];
