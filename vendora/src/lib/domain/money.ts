/**
 * Iraqi dinar amounts are whole-dinar integers everywhere in VENDORA.
 * Never use floating point for money; always operate on integers.
 */
export const IQD_CURRENCY_LABEL = 'د.ع';

export function assertWholeIqd(amount: number, label = 'amount'): number {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`${label} must be a safe integer number of IQD`);
  }
  return amount;
}

export function formatIqd(amount: number): string {
  assertWholeIqd(amount);
  return `${new Intl.NumberFormat('en-US').format(amount)} ${IQD_CURRENCY_LABEL}`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('ar-IQ').format(value);
}
