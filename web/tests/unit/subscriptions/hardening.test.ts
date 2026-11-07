import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatCycleDate, formatCycleDateLong } from '@/lib/subscriptions/dates';
import { day } from '@/mocks/handlers/subscriptions/schedule';

/** HO-P6 S0 TEST gate run 2: closes two gaps recorded in the first run. */

describe('zone independence without relying on the runner TZ (U3)', () => {
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it.each([
    ['America/New_York', 240],
    ['Asia/Dhaka', -360],
    ['Pacific/Kiritimati', -840],
    ['Pacific/Pago_Pago', 660],
  ])('formats the same under %s', (zone, offsetMinutes) => {
    process.env.TZ = zone;
    // Prove the switch took effect, otherwise the assertions below would be vacuous.
    expect(new Date(2026, 9, 20, 12).getTimezoneOffset()).toBe(offsetMinutes);
    expect(formatCycleDate('2026-10-20')).toBe('Tue 20 Oct');
    expect(formatCycleDate('2026-01-01')).toBe('Thu 1 Jan');
    expect(formatCycleDateLong('2026-10-20')).toBe('Tuesday 20 October 2026');
  });
});

describe('the mock schedule names dates through the shared formatter (Amended (d)(4))', () => {
  it('day() equals formatCycleDate and refuses a day the month does not have', () => {
    expect(day('2026-10-20')).toBe('Tue 20 Oct');
    expect(day('2026-10-20')).toBe(formatCycleDate('2026-10-20'));
    expect(day('2026-02-31')).toBe('2026-02-31');
  });
});

describe('mock store keys (Amended (b)(2), (b)(3), (d)(1))', () => {
  const root = path.resolve(__dirname, '../../..');
  const keyOf = (file: string) =>
    /const PERSIST_KEY\s*=\s*'([^']+)'/.exec(fs.readFileSync(path.join(root, file), 'utf8'))?.[1];

  it.each([
    ['mocks/handlers/shop/store.ts', '__amargram_shop_mock_db__v3'],
    ['mocks/handlers/ordering/store.ts', '__amargram_ordering_mock_db__v4'],
    ['mocks/handlers/subscriptions/store.ts', '__amargram_subscriptions_mock_db__v2'],
    ['mocks/handlers/areas/accounts.ts', '__amargram_accounts_mock_db_p7__'],
  ])('%s persists under %s', (file, key) => {
    expect(keyOf(file)).toBe(key);
  });
});
