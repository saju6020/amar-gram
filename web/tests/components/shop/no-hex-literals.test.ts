import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * HO-P3 U9 / A15 - the store-front shell and shared card files use token utilities only. No `#rgb`,
 * `#rrggbb` or `#rrggbbaa` colour literal, no `rgb(`/`hsl(` colour and no `[#...]` arbitrary value.
 * (An anchor whose name is all hex letters, such as `#add`, must be renamed, not allow-listed.)
 * Comments are stripped first. The list is S0's own block of the handover's section 13; each later
 * slice adds its files to its own test, not here.
 */
const ROOT = path.resolve(import.meta.dirname, '../../..');
const FILES = [
  'app/(shop)/layout.tsx',
  'app/(shop)/error.tsx',
  'app/(shop)/loading.tsx',
  'app/(shop)/not-found.tsx',
  'app/(shop)/_components/MaintenanceGate.tsx',
  'app/(shop)/_components/ShopAccountLinks.tsx',
  'app/(portal)/layout.tsx',
  'app/(portal)/loading.tsx',
  'components/common/portal-header.tsx',
  'components/shop/ShopHeader.tsx',
  'components/shop/ShopTopStrip.tsx',
  'components/shop/MobileTabBar.tsx',
  'components/shop/SearchBox.tsx',
  'components/shop/CategoryChips.tsx',
  'components/shop/LanguageSwitcher.tsx',
  'components/shop/BannerStrip.tsx',
  'components/shop/MaintenanceNotice.tsx',
  'components/shop/ShopLoadError.tsx',
  'components/shop/ShopFooter.tsx',
  'components/cart/CartBadge.tsx',
  'components/cart/QuantityStepper.tsx',
  'components/catalogue/ProductCard.tsx',
  'components/catalogue/ProductGrid.tsx',
  'components/product/StatusText.tsx',
  'components/hearth/card.ts',
  'components/hearth/buttons.ts',
  'components/hearth/fields.ts',
  'components/hearth/HearthBand.tsx',
  'components/hearth/IconTile.tsx',
  'components/hearth/HearthEmpty.tsx',
  'components/hearth/GreetingHeader.tsx',
];

/** Drops block comments and `//` line comments (a `//` right after a colon is part of a URL, so it stays). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\w"'])\/\/.*$/gm, '$1');
}

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\[#/;

describe('no colour literals in the shell and shared card files (HO-P3 U9)', () => {
  it.each(FILES)('%s', (file) => {
    const code = stripComments(readFileSync(path.join(ROOT, file), 'utf8'));
    const hit = code.split('\n').find((line) => COLOUR.test(line));
    expect(hit, `colour literal in ${file}: ${hit}`).toBeUndefined();
  });
});
