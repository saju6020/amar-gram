import type { PackTone } from '@/components/hearth/ProductPackArt';

/**
 * Which tint a product's placeholder pack gets, by its catalogue category (HO-P2 §1.1), so a listing
 * is not one flat colour: grains, honey, dates and sweets are warm (mango), fresh and green goods
 * leaf-tinted (`teal` = the accent-tint), and the rest alternate sunken. Decorative only; an unknown
 * category falls back to sunken. A real photo always wins over the placeholder at the call site.
 */
const TONE_BY_CATEGORY: Record<string, PackTone> = {
  RiceAndGrains: 'warm',
  HoneyAndGur: 'warm',
  OilsAndGhee: 'sunken',
  Spices: 'warm',
  Pulses: 'sunken',
  TeaAndDrinks: 'teal',
  FreshProduce: 'teal',
  DatesAndDryFruit: 'warm',
  DairyAndEggs: 'sunken',
  SnacksAndSweets: 'warm',
  HouseholdAndCare: 'teal',
};

export function packToneForCategory(category: string | null | undefined): PackTone {
  return (category && TONE_BY_CATEGORY[category]) || 'sunken';
}

/** The matching background for a card image area behind the (transparent) pack art. */
export const PACK_BG: Record<PackTone, string> = {
  warm: 'bg-warm-soft',
  teal: 'bg-accent-tint',
  sunken: 'bg-surface-sunken',
};
