import { assertWholeIqd } from './money';

/**
 * Commission rates are stored in basis points: 400 bp = 4%.
 * Mirrors public.commission_for_line() in the database. Keep both identical;
 * tests/db/commission.test.ts verifies the SQL result against this function.
 */
export const MAX_RATE_BP = 3000; // 30% hard ceiling
export const DEVELOPMENT_DEFAULT_RATE_BP = 400;

export function commissionForLine(eligibleIqd: number, rateBp: number): number {
  assertWholeIqd(eligibleIqd, 'eligibleIqd');
  if (!Number.isInteger(rateBp) || rateBp < 0 || rateBp > MAX_RATE_BP) {
    throw new RangeError('rateBp must be an integer between 0 and 3000');
  }
  // Half-up rounding to the nearest whole dinar, integer arithmetic only.
  return Math.floor((eligibleIqd * rateBp + 5000) / 10000);
}

export interface CommissionLine {
  unitPriceIqd: number;
  quantity: number;
  returnedQuantity: number;
  commissionRateBp: number;
}

/** Eligible base = unit price × units not returned. Delivery fees are never included. */
export function eligibleBase(line: CommissionLine): number {
  return (line.quantity - line.returnedQuantity) * line.unitPriceIqd;
}

export function orderCommission(lines: CommissionLine[]): { eligibleBaseIqd: number; commissionIqd: number } {
  return lines.reduce(
    (acc, line) => {
      const base = eligibleBase(line);
      return {
        eligibleBaseIqd: acc.eligibleBaseIqd + base,
        commissionIqd: acc.commissionIqd + commissionForLine(base, line.commissionRateBp),
      };
    },
    { eligibleBaseIqd: 0, commissionIqd: 0 },
  );
}
