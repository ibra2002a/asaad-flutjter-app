/**
 * Commission arithmetic, mirrored from public._create_commission() for display and tests.
 * The database computes and stores the real value; the browser never supplies it.
 *
 * Rule: commission = round-half-up(eligible * rate_bps / 10000), with all values as whole IQD.
 * Eligible = product subtotal after discounts (delivery fee excluded unless the rule says otherwise).
 */
export function calculateCommissionIqd(eligibleSubtotalIqd: number, rateBps: number): number {
  if (!Number.isSafeInteger(eligibleSubtotalIqd) || eligibleSubtotalIqd < 0) {
    throw new RangeError('eligibleSubtotalIqd must be a non-negative safe integer');
  }
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 3000) {
    throw new RangeError('rateBps must be an integer between 0 and 3000');
  }
  const product = BigInt(eligibleSubtotalIqd) * BigInt(rateBps);
  return Number((product + 5000n) / 10000n);
}

/** Converts a percentage typed by an admin (e.g. "4.5") into basis points (450). */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}
