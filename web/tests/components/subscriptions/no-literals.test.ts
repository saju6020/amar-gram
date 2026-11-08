import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * HO-P6 S1 U40: tokens only. No `#rgb`, `#rrggbb` or `#rrggbbaa` colour literal, no `rgb(` or `hsl(` colour and no `[#...]`
 * arbitrary value in any file S1 added (scanned recursively, so a new file is covered without being listed). The shared
 * `no-hex-literals` and `no-colour-literals` tests already cover `components/portal`, `components/product` and `app/(portal)`.
 */
const ROOT = path.resolve(import.meta.dirname, '../../..');
const DIRS = ['components/subscriptions', 'app/(portal)/portal/subscriptions'];
const FILES = ['lib/hooks/useSubscriptions.ts'];

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\w"'])\/\/.*$/gm, '$1');
}

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\[#/;

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.(tsx?|css)$/.test(file))
    .map((file) => path.join(dir, file));
}

describe('no colour literals in the customer subscription files (U40)', () => {
  it('scans the screens', () => {
    expect(DIRS.flatMap(sourceFiles).length).toBeGreaterThan(20);
  });

  it.each([...DIRS.flatMap(sourceFiles), ...FILES])('%s', (file) => {
    const code = stripComments(readFileSync(path.join(ROOT, file), 'utf8'));
    const hit = code.split('\n').find((line) => COLOUR.test(line));
    expect(hit, `colour literal in ${file}: ${hit}`).toBeUndefined();
  });
});

describe('no payment capture in the customer subscription files (ADR-238, C-5)', () => {
  it.each(DIRS.flatMap(sourceFiles))('%s', (file) => {
    const code = stripComments(readFileSync(path.join(ROOT, file), 'utf8'));
    expect(code).not.toMatch(/autocomplete\s*=\s*["']cc-|card\s?number|\bcvv\b|\bcvc\b|expiry\s?date|save (my |this )?card|auto-?charge/i);
  });
});
