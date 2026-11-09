import { describe, expect, it } from 'vitest';
import { navRegistry } from '@/nav';

const EXPECTED_AREAS = [
  'accounts',
  'administration',
  'notifications',
  'file-storage',
  'shop',
  'inventory',
  'billing',
  'orders',
  'subscriptions',
  'portal',
  'reporting',
  'cross-cutting',
];

describe('navRegistry', () => {
  it('pre-registers all 12 functional areas exactly once', () => {
    const keys = navRegistry.map((area) => area.key);
    expect(keys).toHaveLength(12);
    expect(new Set(keys).size).toBe(12);
    expect(keys.sort()).toEqual([...EXPECTED_AREAS].sort());
  });

  it("every area's registered items are well-formed (empty until that area ships its own screens)", () => {
    // Data-driven, not by area key: this asserts on shape only, so it never needs another
    // area-specific edit (web/README.md "Adding a functional area").
    for (const area of navRegistry) {
      for (const item of area.items) {
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.href.startsWith('/')).toBe(true);
      }
    }
  });

  it('at least one area has registered real screens', () => {
    const totalItems = navRegistry.reduce((sum, area) => sum + area.items.length, 0);
    expect(totalItems).toBeGreaterThan(0);
  });
});
