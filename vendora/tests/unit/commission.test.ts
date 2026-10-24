import { describe, expect, it } from 'vitest';
import { calculateCommissionIqd, percentToBps } from '@/lib/commission';

describe('calculateCommissionIqd', () => {
  it('applies the rate to the eligible subtotal in whole IQD', () => {
    // 135,000 IQD at 4% (400 bps) = 5,400 IQD
    expect(calculateCommissionIqd(135_000, 400)).toBe(5_400);
  });

  it('rounds half up to the nearest whole dinar', () => {
    // 12,345 * 400 / 10000 = 494.3 -> 494
    expect(calculateCommissionIqd(12_345, 400)).toBe(494);
    // 12,500 * 400 / 10000 = 500 exactly
    expect(calculateCommissionIqd(12_500, 400)).toBe(500);
    // 5 * 1000 / 10000 = 0.5 -> 1 (half up)
    expect(calculateCommissionIqd(5, 1000)).toBe(1);
    // 2 * 2499 / 10000 = 0.4998 -> 0
    expect(calculateCommissionIqd(2, 2499)).toBe(0);
  });

  it('returns zero when the rate is zero', () => {
    expect(calculateCommissionIqd(1_000_000, 0)).toBe(0);
  });

  it('stays exact for large totals (bigint arithmetic)', () => {
    // 1 billion IQD at 30% = 300 million IQD
    expect(calculateCommissionIqd(1_000_000_000, 3000)).toBe(300_000_000);
  });

  it('rejects invalid inputs', () => {
    expect(() => calculateCommissionIqd(-1, 400)).toThrow(RangeError);
    expect(() => calculateCommissionIqd(1.5, 400)).toThrow(RangeError);
    expect(() => calculateCommissionIqd(1000, 3001)).toThrow(RangeError);
    expect(() => calculateCommissionIqd(1000, 400.5)).toThrow(RangeError);
  });
});

describe('percentToBps', () => {
  it('converts admin percentages to basis points', () => {
    expect(percentToBps(4)).toBe(400);
    expect(percentToBps(4.5)).toBe(450);
    expect(percentToBps(0.01)).toBe(1);
  });
});
