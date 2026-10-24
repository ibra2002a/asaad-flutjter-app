import { describe, expect, it } from 'vitest';
import { commissionForLine, orderCommission, eligibleBase } from '@/lib/domain/commission';

describe('commission calculation', () => {
  it('computes IQD 12,000 on an eligible order of IQD 300,000 at 4%', () => {
    expect(commissionForLine(300_000, 400)).toBe(12_000);
  });

  it('rounds half-up to the nearest whole dinar', () => {
    // 1,249 × 4% = 49.96 → 50
    expect(commissionForLine(1_249, 400)).toBe(50);
    // 1,237 × 4% = 49.48 → 49
    expect(commissionForLine(1_237, 400)).toBe(49);
    // exactly .5 rounds up: 12.5 IQD at 100% is not possible; use 125 × 10% = 12.5 → 13
    expect(commissionForLine(125, 1000)).toBe(13);
  });

  it('returns zero for a zero base or a zero rate', () => {
    expect(commissionForLine(0, 400)).toBe(0);
    expect(commissionForLine(300_000, 0)).toBe(0);
  });

  it('rejects fractional money and out-of-range rates', () => {
    expect(() => commissionForLine(10.5, 400)).toThrow(RangeError);
    expect(() => commissionForLine(1000, 3001)).toThrow(RangeError);
    expect(() => commissionForLine(1000, -1)).toThrow(RangeError);
    expect(() => commissionForLine(1000, 4.5)).toThrow(RangeError);
  });

  it('excludes returned units from the eligible base', () => {
    const line = { unitPriceIqd: 100_000, quantity: 3, returnedQuantity: 1, commissionRateBp: 400 };
    expect(eligibleBase(line)).toBe(200_000);
    expect(orderCommission([line])).toEqual({ eligibleBaseIqd: 200_000, commissionIqd: 8_000 });
  });

  it('applies each line its own frozen rate', () => {
    const result = orderCommission([
      { unitPriceIqd: 300_000, quantity: 1, returnedQuantity: 0, commissionRateBp: 400 },
      { unitPriceIqd: 100_000, quantity: 2, returnedQuantity: 0, commissionRateBp: 1000 },
    ]);
    expect(result.eligibleBaseIqd).toBe(500_000);
    expect(result.commissionIqd).toBe(12_000 + 20_000);
  });
});
