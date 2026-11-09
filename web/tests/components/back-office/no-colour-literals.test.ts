import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * U41 (HO-P4 §15, A16): no hex or colour literals in components or the staff pages. Colours come
 * from the design tokens (`bg-leaf-ink`, `text-ink-muted`, ...), never from `#2f5114`, `rgb(...)`,
 * `hsl(...)` or a Tailwind arbitrary colour such as `bg-[#2f5114]`. `app/globals.css` (where the
 * tokens are defined) and `app/icon.svg` are outside the scan.
 */
const ROOT = path.resolve(import.meta.dirname, '../../..');
const SCANNED = ['components', 'app/(staff)', 'app/(auth)/staff'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.mdx']);

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FUNCTIONAL = /\b(?:rgba?|hsla?)\(/;
const ARBITRARY = /-\[#/;

function* walk(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.has(path.extname(entry.name))) yield full;
  }
}

describe('U41 — no hex or colour literals in components or staff pages', () => {
  it('finds none in components/**, app/(staff)/** and app/(auth)/staff/**', () => {
    const offenders: string[] = [];
    for (const base of SCANNED) {
      for (const file of walk(path.join(ROOT, base))) {
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, index) => {
          if (HEX.test(line) || FUNCTIONAL.test(line) || ARBITRARY.test(line)) {
            offenders.push(`${path.relative(ROOT, file)}:${index + 1}: ${line.trim()}`);
          }
        });
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the patterns catch what they should', () => {
    expect(HEX.test('bg-[#2f5114]')).toBe(true);
    expect(HEX.test('color: #fff;')).toBe(true);
    expect(FUNCTIONAL.test('rgba(0, 0, 0, 0.5)')).toBe(true);
    expect(FUNCTIONAL.test('hsl(10 20% 30%)')).toBe(true);
    expect(ARBITRARY.test('bg-[#abc]')).toBe(true);
    expect(HEX.test('href="#main-content"')).toBe(false);
    expect(HEX.test('bg-leaf-ink text-leaf-soft')).toBe(false);
  });
});
