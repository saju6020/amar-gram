import { describe, expect, it } from 'vitest';
import {
  formatCommerceInstant,
  formatCycleDate,
  formatCycleDateLong,
  formatPercentText,
  isZeroPercent,
} from '@/lib/subscriptions/dates';

/**
 * HO-P6 U3. A date-only string is laid out through UTC parts, so the result does not depend on the machine's
 * zone. Run once as is and once with `TZ=America/New_York` (and `TZ=Asia/Dhaka`): the same assertions hold.
 */
describe('subscription dates (ADR-FE-112)', () => {
  it('formats a cycle date as the server does (ddd d MMM) under any TZ', () => {
    expect(formatCycleDate('2026-10-20')).toBe('Tue 20 Oct');
    expect(formatCycleDate('2026-01-01')).toBe('Thu 1 Jan');
    expect(formatCycleDate('2026-12-31')).toBe('Thu 31 Dec');
  });

  it('formats the long form', () => {
    expect(formatCycleDateLong('2026-10-20')).toBe('Tuesday 20 October 2026');
  });

  it('shows a dash for nothing and leaves an unparseable text alone', () => {
    expect(formatCycleDate(null)).toBe('—');
    expect(formatCycleDate(undefined)).toBe('—');
    expect(formatCycleDate('soon')).toBe('soon');
    expect(formatCycleDate('2026-13-40')).toBe('2026-13-40');
  });

  it('names the commerce zone on an instant and converts into it', () => {
    // 2026-10-17T18:00:00Z is local midnight on Sun 18 Oct in Asia/Dhaka (UTC+6).
    expect(formatCommerceInstant('2026-10-17T18:00:00Z', 'Asia/Dhaka')).toBe('Sun 18 Oct, 00:00 (Asia/Dhaka)');
    expect(formatCommerceInstant('2026-10-17T18:00:00+00:00', 'America/New_York')).toBe(
      'Sat 17 Oct, 14:00 (America/New_York)',
    );
    expect(formatCommerceInstant(null, 'Asia/Dhaka')).toBe('—');
    expect(formatCommerceInstant('not a time', 'Asia/Dhaka')).toBe('—');
  });

  it('trims a percent text by string handling only', () => {
    expect(formatPercentText('10.00')).toBe('10');
    expect(formatPercentText('12.50')).toBe('12.5');
    expect(formatPercentText('0.00')).toBe('0');
    expect(formatPercentText('7')).toBe('7');
  });

  it('knows a zero rate', () => {
    expect(isZeroPercent('0.00')).toBe(true);
    expect(isZeroPercent('0')).toBe(true);
    expect(isZeroPercent('00.0')).toBe(true);
    expect(isZeroPercent('10.00')).toBe(false);
    expect(isZeroPercent('0.50')).toBe(false);
  });
});
