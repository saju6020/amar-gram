/**
 * `lib/shop/labels.ts` — HO-SHP-002 §11, HO-P2 §2.3. Display names for the API's enumeration values
 * (which come by name, e.g. `RiceAndGrains`, `CertifiedOrganic`). Labels are English-only chrome (C-8);
 * product CONTENT is what FR-SHP-15 translates. Unknown values fall back to a spaced version of the name.
 */

/** HO-P2 §1.1, in the enumeration's order (value 1–11). */
export const CATEGORY_LABELS: Record<string, string> = {
  RiceAndGrains: 'Rice & grains',
  HoneyAndGur: 'Honey & gur',
  OilsAndGhee: 'Oils & ghee',
  Spices: 'Spices',
  Pulses: 'Pulses',
  TeaAndDrinks: 'Tea & drinks',
  FreshProduce: 'Fresh produce',
  DatesAndDryFruit: 'Dates & dry fruit',
  DairyAndEggs: 'Dairy & eggs',
  SnacksAndSweets: 'Snacks & sweets',
  HouseholdAndCare: 'Household & natural care',
};

/** HO-P2 §1.1's IsFood rule: every category is food except household & natural care. */
const NON_FOOD_CATEGORIES: ReadonlySet<string> = new Set(['HouseholdAndCare']);
export const isFoodCategory = (category: string) =>
  category in CATEGORY_LABELS && !NON_FOOD_CATEGORIES.has(category);

/** HO-P2 §1.2's examples; any other subcategory falls back to its spaced name. */
const SUBCATEGORY_LABELS: Record<string, string> = {
  AromaticRice: 'Aromatic rice',
  EverydayRice: 'Everyday rice',
  FlattenedAndPuffedRice: 'Flattened & puffed rice',
  Flour: 'Flour',
  Honey: 'Honey',
  DateMolasses: 'Date molasses (gur)',
  DateMolassesGur: 'Date molasses (gur)',
  SugarcaneGur: 'Sugarcane gur',
  MustardOil: 'Mustard oil',
  Ghee: 'Ghee',
  OtherOils: 'Other oils',
  JuteAndBags: 'Jute & bags',
  NaturalCare: 'Natural care',
};

/** HO-P2 §1.3 — replaces health focus and protein source. */
export const CERTIFICATION_LABELS: Record<string, string> = {
  CertifiedOrganic: 'Certified organic',
  PesticideFree: 'Pesticide-free',
  Traditional: 'Traditional',
  Halal: 'Halal',
};
export const CERTIFICATIONS = Object.keys(CERTIFICATION_LABELS);

function spaced(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export const categoryLabel = (value: string) => CATEGORY_LABELS[value] ?? spaced(value);
export const subcategoryLabel = (value: string) =>
  SUBCATEGORY_LABELS[value] ?? spaced(value).replace(/ And /g, ' & ');
export const certificationLabel = (value: string) => CERTIFICATION_LABELS[value] ?? spaced(value);

export const SORT_LABELS = {
  relevance: 'Relevance',
  newest: 'Newest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  popularity: 'Popularity',
  rating: 'Rating',
} as const;

/** Availability is ALWAYS text (plus an icon in the component), never colour alone (UI-6). */
export function availabilityText(availability: 'InStock' | 'OutOfStock'): string {
  return availability === 'InStock' ? 'In stock' : 'Out of stock';
}
