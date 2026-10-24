import { formatIqd } from './money';

/** Client-side cart. The server re-validates every line in place_order(). */
export interface CartLine {
  productId: string;
  quantity: number;
}

export interface ProductConstraints {
  id: string;
  nameAr: string;
  priceIqd: number;
  salePriceIqd: number | null;
  minOrderQty: number;
  maxOrderQty: number | null;
  stockQty: number;
  supplierId: string;
}

export type CartLineIssue =
  | { code: 'BELOW_MINIMUM'; minimum: number }
  | { code: 'ABOVE_MAXIMUM'; maximum: number }
  | { code: 'INSUFFICIENT_STOCK'; available: number }
  | { code: 'NOT_A_WHOLE_NUMBER' };

export const MAX_CART_LINES = 60;
export const MAX_LINE_QUANTITY = 1_000_000;

export function effectiveUnitPrice(product: Pick<ProductConstraints, 'priceIqd' | 'salePriceIqd'>): number {
  return product.salePriceIqd ?? product.priceIqd;
}

export function validateQuantity(product: ProductConstraints, quantity: number): CartLineIssue | null {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { code: 'NOT_A_WHOLE_NUMBER' };
  }
  if (quantity < product.minOrderQty) {
    return { code: 'BELOW_MINIMUM', minimum: product.minOrderQty };
  }
  if (product.maxOrderQty !== null && quantity > product.maxOrderQty) {
    return { code: 'ABOVE_MAXIMUM', maximum: product.maxOrderQty };
  }
  if (quantity > product.stockQty) {
    return { code: 'INSUFFICIENT_STOCK', available: product.stockQty };
  }
  return null;
}

/** Clamp a requested quantity to the nearest legal value for the stepper UI. */
export function clampQuantity(product: ProductConstraints, requested: number): number {
  const max = Math.min(product.maxOrderQty ?? Number.POSITIVE_INFINITY, product.stockQty);
  const value = Math.max(product.minOrderQty, Math.floor(requested));
  return Math.min(value, Math.max(product.minOrderQty, max));
}

export function lineTotal(product: ProductConstraints, quantity: number): number {
  return effectiveUnitPrice(product) * quantity;
}

export function cartSubtotal(
  lines: Array<{ product: ProductConstraints; quantity: number }>,
): number {
  return lines.reduce((sum, l) => sum + lineTotal(l.product, l.quantity), 0);
}

/** Groups cart lines by supplier, because the marketplace creates one order per supplier. */
export function groupBySupplier<T extends { product: ProductConstraints }>(lines: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const line of lines) {
    const bucket = groups.get(line.product.supplierId) ?? [];
    bucket.push(line);
    groups.set(line.product.supplierId, bucket);
  }
  return groups;
}

export function describeIssue(issue: CartLineIssue, unitLabel = ''): string {
  switch (issue.code) {
    case 'BELOW_MINIMUM':
      return `أقل كمية للطلب هي ${issue.minimum} ${unitLabel}`.trim();
    case 'ABOVE_MAXIMUM':
      return `أكبر كمية للطلب هي ${issue.maximum} ${unitLabel}`.trim();
    case 'INSUFFICIENT_STOCK':
      return issue.available > 0
        ? `المتوفر حاليا ${issue.available} ${unitLabel} فقط`.trim()
        : 'هذا المنتج غير متوفر حاليا';
    case 'NOT_A_WHOLE_NUMBER':
      return 'أدخل كمية صحيحة';
  }
}

export { formatIqd };
