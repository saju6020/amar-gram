import { describe, expect, it } from 'vitest';
import { isSafeInternalPath } from '@/lib/routing/isSafeInternalPath';

// HO-NTF-002 U-A5 (the pure half) — ADR-FE-162.
describe('isSafeInternalPath', () => {
  it.each(['/portal/orders/1', '/shop?category=rice&page=1', '/portal/inbox#top', '/'])(
    'accepts the site-relative path %s',
    (path) => {
      expect(isSafeInternalPath(path)).toBe(true);
    },
  );

  it.each([
    ['protocol-relative', '//evil.example'],
    ['absolute https URL', 'https://evil.example'],
    ['backslash after the slash', '/\\evil'],
    ['backslash later in the path', '/portal\\..\\evil'],
    ['tab hidden between slashes', '/\t/evil.example'],
    ['newline hidden between slashes', '/\n/evil.example'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['relative without a leading slash', 'portal/orders'],
    ['empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ])('refuses %s', (_label, path) => {
    expect(isSafeInternalPath(path as string | null | undefined)).toBe(false);
  });
});
