import { describe, expect, it } from 'vitest';
import { sanitizeNextPath } from '@/lib/validation/nextPath';

describe('sanitizeNextPath — ARCH gate LOW (first pass)', () => {
  it('accepts an exact prefix match', () => {
    expect(sanitizeNextPath('/shop', '/shop', '/portal/orders')).toBe('/shop');
  });

  it('accepts a prefix followed by a /-boundary', () => {
    expect(sanitizeNextPath('/shop/product', '/shop', '/portal/orders')).toBe('/shop/product');
  });

  it('accepts a prefix followed by a query string', () => {
    expect(sanitizeNextPath('/shop?page=1', '/shop', '/portal/orders')).toBe('/shop?page=1');
  });

  it('rejects a longer, unrelated path segment that merely starts with the prefix', () => {
    expect(sanitizeNextPath('/shopXYZ', '/shop', '/portal/orders')).toBe('/portal/orders');
  });

  it('rejects a longer, unrelated path segment even when the allowed prefix has a trailing slash', () => {
    expect(sanitizeNextPath('/staffing', '/staff/', '/staff/orders')).toBe('/staff/orders');
  });

  it('still accepts a trailing-slash prefix at an exact match and at a /-boundary', () => {
    expect(sanitizeNextPath('/staff', '/staff/', '/staff/orders')).toBe('/staff');
    expect(sanitizeNextPath('/staff/customers', '/staff/', '/staff/orders')).toBe(
      '/staff/customers',
    );
  });

  it('falls back on a protocol-relative //-prefixed value', () => {
    expect(sanitizeNextPath('//evil.example', ['/portal/', '/shop'], '/portal/orders')).toBe(
      '/portal/orders',
    );
  });

  it('falls back on an absolute URL (U-C2 — a ?next=https://evil.example is ignored)', () => {
    expect(sanitizeNextPath('https://evil.example', '/portal/', '/portal/orders')).toBe(
      '/portal/orders',
    );
    expect(
      sanitizeNextPath('https://evil.example/portal/orders', '/portal/', '/portal/orders'),
    ).toBe('/portal/orders');
  });

  it('falls back on a null/undefined/empty next', () => {
    expect(sanitizeNextPath(null, '/portal/', '/portal/orders')).toBe('/portal/orders');
    expect(sanitizeNextPath(undefined, '/portal/', '/portal/orders')).toBe('/portal/orders');
    expect(sanitizeNextPath('', '/portal/', '/portal/orders')).toBe('/portal/orders');
  });

  it('checks every prefix in a list', () => {
    expect(sanitizeNextPath('/shop/1', ['/portal/', '/shop'], '/portal/orders')).toBe('/shop/1');
    expect(sanitizeNextPath('/other', ['/portal/', '/shop'], '/portal/orders')).toBe(
      '/portal/orders',
    );
  });
});

describe('sanitizeNextPath — A-APT1 normalisation hardening', () => {
  const fb = '/portal/orders';
  const BS = String.fromCharCode(92);
  it.each([
    ['/shop/..//evil'],
    ['/portal/../..//evil'],
    ['/shop/%2e%2e//evil'],
    ['/shop/%2E%2E/%2e%2e//evil'],
    ['/shop/.%2e//evil'],
    ['/shop' + BS + 'evil'],
    ['/' + BS + 'evil'],
    ['/shop/' + BS + '..' + BS + 'evil'],
    ['/\t/evil'],
    ['/shop/\t/evil'],
    ['/shop\n/x'],
    ['/shop\r/x'],
    ['/shop/\u0000x'],
  ])('falls back on %j', (value) => {
    expect(sanitizeNextPath(value, ['/portal/', '/shop'], fb)).toBe(fb);
  });

  it('still returns a valid path (with dot-segments that stay inside the area, and a query) unchanged', () => {
    expect(sanitizeNextPath('/shop/a/../b?x=1', '/shop', fb)).toBe('/shop/a/../b?x=1');
    expect(sanitizeNextPath('/portal/orders/1#top', '/portal/', fb)).toBe('/portal/orders/1#top');
  });
});
