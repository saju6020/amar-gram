import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * HO-P6 U6: the subscription source guard (ADR-FE-110, ADR-FE-112, ADR-FE-113, ADR-238). `eslint.config.mjs`
 * is outside this pass, so the rules are a Vitest source scan, like `tests/guards/*`. It covers the folders
 * and files the subscription screens live in; a folder that does not exist yet scans nothing.
 *
 * Rules, per file (comments and string contents are ignored):
 *  1. no `new Date(` whose argument is a `yyyy-MM-dd` string literal or an identifier ending `On`;
 *  2. no import of `addDaysIso` or `date-fns`;
 *  3. no `Number(`, `parseFloat(` or `parseInt(` of, and no `+ - * /` on, an identifier that names an amount,
 *     price, total, subtotal, discount or percent;
 *  4. no `card`, `cvv` or `expiry date` input names.
 *
 * `findViolations` is exported-by-shape for the planted-violation cases below, which prove the guard can fail.
 */
const ROOT = path.resolve(import.meta.dirname, '../../..');

const FOLDERS = [
  'components/subscriptions',
  'components/staff-subscriptions',
  'components/back-office-subscriptions',
  'lib/subscriptions',
];

function walk(dir: string, accept: (file: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, accept);
    return accept(full) ? [full] : [];
  });
}

const isSource = (file: string) => /\.(ts|tsx)$/.test(file);

export function subscriptionSourceFiles(): string[] {
  const files = new Set<string>();
  for (const folder of FOLDERS) walk(path.join(ROOT, folder), isSource).forEach((f) => files.add(f));
  // app/**/subscriptions/**
  const appRoot = path.join(ROOT, 'app');
  const collectApp = (dir: string, inside: boolean) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (!entry.isDirectory()) {
        if (inside && isSource(full)) files.add(full);
      } else {
        collectApp(full, inside || entry.name === 'subscriptions');
      }
    }
  };
  collectApp(appRoot, false);
  // lib/api/*subscriptions.ts and lib/hooks/use*Subscription*.ts
  for (const f of walk(path.join(ROOT, 'lib/api'), (x) => /subscriptions\.ts$/.test(x))) files.add(f);
  for (const f of walk(path.join(ROOT, 'lib/hooks'), (x) => /[\\/]use\w*Subscription\w*\.ts$/.test(x))) files.add(f);
  return [...files].sort();
}

/** Blank out comments, strings and regex-free template text; keep `${…}` code so arithmetic inside it is seen. */
function strip(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    const n = source[i + 1];
    if (c === '/' && n === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
    } else if (c === '/' && n === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
    } else if (c === "'" || c === '"') {
      const quote = c;
      let text = '';
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\\') i += 1;
        text += source[i];
        i += 1;
      }
      i += 1;
      // Keep the content of a string that is a date literal, so rule 1 can see it.
      out += /^\d{4}-\d{2}-\d{2}/.test(text) ? `"${text}"` : '""';
    } else if (c === '`') {
      i += 1;
      let depth = 0;
      out += '``';
      while (i < source.length && !(source[i] === '`' && depth === 0)) {
        if (source[i] === '$' && source[i + 1] === '{') {
          depth += 1;
          i += 2;
          out += ' ( ';
          continue;
        }
        if (depth > 0 && source[i] === '}') {
          depth -= 1;
          out += ' ) ';
          i += 1;
          continue;
        }
        if (depth > 0) out += source[i];
        i += 1;
      }
      i += 1;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

const MONEYISH = '\\w*(?:amount|price|total|subtotal|discount|percent)\\w*';

export function findViolations(source: string): string[] {
  const code = strip(source);
  const found: string[] = [];

  if (/new\s+Date\(\s*["']\d{4}-\d{2}-\d{2}/.test(code)) found.push('new Date() of a date literal');
  if (/new\s+Date\(\s*\w*On\s*[,)]/.test(code)) found.push('new Date() of a date-only identifier');
  if (/\baddDaysIso\b/.test(code)) found.push('addDaysIso');
  if (/from\s+["']date-fns/.test(source) || /require\(\s*["']date-fns/.test(source)) found.push('date-fns');

  if (new RegExp(`\\b(?:Number|parseFloat|parseInt)\\(\\s*[^)]*\\b${MONEYISH}`, 'i').test(code)) {
    found.push('Number()/parseFloat()/parseInt() of a money or percent value');
  }
  const before = new RegExp(
    `\\b${MONEYISH}\\s*(?:[-+*/]=?)\\s*[\\w(]|\\b${MONEYISH}\\s*(?:\\+\\+|--)`,
    'i',
  );
  const after = new RegExp(`[\\w)]\\s*(?:[-+*/])\\s*${MONEYISH}\\b`, 'i');
  if (before.test(code) || after.test(code)) found.push('arithmetic on a money or percent value');

  // Input names live in strings, so this rule reads the source with only its comments removed.
  const withStrings = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  if (/\b(?:card\s?number|card-?num|cvv|cvc|expiry\s?date)\b/i.test(withStrings)) {
    found.push('card input name');
  }
  return found;
}

describe('subscription source guard (U6)', () => {
  it('the subscription code has no date arithmetic, date-only new Date, money arithmetic or card input', () => {
    const offenders = subscriptionSourceFiles()
      .map((file) => ({ file: path.relative(ROOT, file), found: findViolations(fs.readFileSync(file, 'utf8')) }))
      .filter((x) => x.found.length > 0);
    expect(offenders).toEqual([]);
  });

  it('scans the S0 files at least', () => {
    const files = subscriptionSourceFiles().map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));
    expect(files).toEqual(
      expect.arrayContaining([
        'lib/api/subscriptions.ts',
        'lib/api/staff-subscriptions.ts',
        'lib/subscriptions/dates.ts',
        'lib/subscriptions/errors.ts',
      ]),
    );
  });

  describe('fails on a planted violation', () => {
    it.each([
      ['new Date of a date literal', "const d = new Date('2026-10-20');"],
      ['new Date of a date-only identifier', 'const d = new Date(nextDeliveryOn);'],
      ['addDaysIso', "import { addDaysIso } from '@/lib/format/time';"],
      ['date-fns', "import { addWeeks } from 'date-fns';"],
      ['Number() of a money value', 'const n = Number(estimate.subtotal.amount);'],
      ['parseFloat of a percent', 'const p = parseFloat(discountPercent);'],
      ['parseInt of a price', 'const p = parseInt(unitPrice, 10);'],
      ['addition of a total', 'const t = subtotal + discountAmount;'],
      ['multiplication of a price', 'const t = unitPrice * quantity;'],
      ['subtraction inside a template', 'const t = `${estimatedTotal - discountAmount}`;'],
      ['an increment of an amount', 'amount++;'],
      ['a card input', '<input name="cardNumber" />'],
      ['a cvv input', '<input name="cvv" />'],
      ['an expiry date input', '<input name="expiry date" />'],
    ])('%s', (_name, source) => {
      expect(findViolations(source).length).toBeGreaterThan(0);
    });
  });

  describe('lets the allowed forms through', () => {
    it.each([
      ['a comment mentioning the rules', '// never new Date(\'2026-10-20\') or price * quantity'],
      ['a string that mentions a total', 'const label = "Estimated total - per delivery";'],
      ['a money value only formatted', 'const text = formatMoney(estimate.estimatedTotal);'],
      ['a percent trimmed as text', "const text = percent.replace(/0+$/, '');"],
      ['UTC parts of a date', 'const at = new Date(Date.UTC(year, month - 1, day));'],
      ['an instant', 'const at = new Date(instant);'],
      ['a plain index sum', 'const next = index + 1;'],
    ])('%s', (_name, source) => {
      expect(findViolations(source)).toEqual([]);
    });
  });
});
