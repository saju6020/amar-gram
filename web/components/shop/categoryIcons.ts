import {
  Bean,
  Carrot,
  Cookie,
  CupSoda,
  Droplet,
  Egg,
  Flame,
  Home,
  Leaf,
  Nut,
  Sprout,
  Wheat,
  type LucideIcon,
} from 'lucide-react';

/** HO-P2 §2.3 — one lucide icon per §1.1 category (the shop home's category tiles). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  RiceAndGrains: Wheat,
  HoneyAndGur: Droplet,
  OilsAndGhee: Flame,
  Spices: Leaf,
  Pulses: Bean,
  TeaAndDrinks: CupSoda,
  FreshProduce: Carrot,
  DatesAndDryFruit: Nut,
  DairyAndEggs: Egg,
  SnacksAndSweets: Cookie,
  HouseholdAndCare: Home,
};

/** A category the table doesn't know yet still gets a tile. */
export const FALLBACK_CATEGORY_ICON: LucideIcon = Sprout;

export function categoryIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category] ?? FALLBACK_CATEGORY_ICON;
}
