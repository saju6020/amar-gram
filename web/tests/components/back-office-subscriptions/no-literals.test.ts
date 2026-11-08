import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * HO-P6 S3 U40: tokens only, and 44 px targets on the controls S3 adds. No `#rgb`, `#rrggbb` or `#rrggbbaa` colour literal, no
 * `rgb(` or `hsl(` colour and no `[#...]` arbitrary value in any file S3 added or edited (the shared `no-hex-literals` and
 * `no-colour-literals` tests cover the folders they list; this one names S3's files so none depends on that list).
 */
const ROOT = path.resolve(import.meta.dirname, '../../..');
const DIRS = ['components/back-office-subscriptions'];
const FILES = [
  'lib/hooks/useSubscriptionSummaries.ts',
  'components/staff-shop/ProductDetailsForm.tsx',
  'components/customer/CustomerProfile.tsx',
  'components/back-office-overview/CustomerProfileView.tsx',
  'components/back-office-overview/DashboardAttention.tsx',
  'components/orders/StaffOrderQueue.tsx',
  'app/(staff)/staff/shop/products/[productId]/page.tsx',
];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\w"'])\/\/.*$/gm, '$1');
}

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\[#/;

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.(tsx?|css)$/.test(file))
    .map((file) => path.join(dir, file));
}

const read = (file: string) => stripComments(readFileSync(path.join(ROOT, file), 'utf8'));

describe('no colour literals in the S3 files (U40)', () => {
  it('scans the new components', () => {
    expect(DIRS.flatMap(sourceFiles).length).toBeGreaterThanOrEqual(1);
  });

  for (const file of [...DIRS.flatMap(sourceFiles), ...FILES]) {
    it(`${file} has none`, () => {
      expect(read(file)).not.toMatch(COLOUR);
    });
  }
});

describe('44 px targets on what S3 adds (U40)', () => {
  it('the "Can be subscribed to" label, the customer tab rows and the dashboard rows carry min-h-11', () => {
    expect(read('components/staff-shop/ProductDetailsForm.tsx')).toMatch(/htmlFor="pd-subscribable"[^>]*min-h-11/);
    expect(read('components/back-office-subscriptions/CustomerSubscriptionsPanel.tsx')).toMatch(/<Link[\s\S]*?min-h-11/);
    // AttentionRow (shared) is already min-h-11; the Channel select S3 touches is raised to match.
    expect(read('components/orders/StaffOrderQueue.tsx')).toMatch(/id="oq-channel"[^>]*className="min-h-11"/);
  });
});
