import { describe, expect, it } from 'vitest';
import {
  cartSubtotal,
  clampQuantity,
  groupBySupplier,
  lineTotal,
  validateQuantity,
  type ProductConstraints,
} from '@/lib/domain/cart';

const base: ProductConstraints = {
  id: '11111111-1111-1111-1111-111111111111',
  nameAr: 'زيت دوار الشمس',
  priceIqd: 300_000,
  salePriceIqd: null,
  minOrderQty: 2,
  maxOrderQty: 50,
  stockQty: 40,
  supplierId: 'supplier-a',
};

describe('price and quantity validation', () => {
  it('accepts a quantity within minimum, maximum and stock', () => {
    expect(validateQuantity(base, 2)).toBeNull();
    expect(validateQuantity(base, 40)).toBeNull();
  });

  it('rejects quantities below the minimum order', () => {
    expect(validateQuantity(base, 1)).toEqual({ code: 'BELOW_MINIMUM', minimum: 2 });
  });

  it('rejects quantities above the maximum order', () => {
    expect(validateQuantity({ ...base, stockQty: 500 }, 51)).toEqual({ code: 'ABOVE_MAXIMUM', maximum: 50 });
  });

  it('rejects quantities above available stock', () => {
    expect(validateQuantity(base, 41)).toEqual({ code: 'INSUFFICIENT_STOCK', available: 40 });
  });

  it('rejects zero, negative, fractional and non-numeric quantities', () => {
    expect(validateQuantity(base, 0)).toEqual({ code: 'NOT_A_WHOLE_NUMBER' });
    expect(validateQuantity(base, -3)).toEqual({ code: 'NOT_A_WHOLE_NUMBER' });
    expect(validateQuantity(base, 2.5)).toEqual({ code: 'NOT_A_WHOLE_NUMBER' });
    expect(validateQuantity(base, Number.NaN)).toEqual({ code: 'NOT_A_WHOLE_NUMBER' });
  });

  it('uses the sale price for totals when a discount is active', () => {
    const discounted = { ...base, salePriceIqd: 285_000 };
    expect(lineTotal(discounted, 3)).toBe(855_000);
    expect(lineTotal(base, 3)).toBe(900_000);
  });

  it('clamps stepper input into the legal range', () => {
    expect(clampQuantity(base, 0)).toBe(2);
    expect(clampQuantity(base, 999)).toBe(40);
    expect(clampQuantity({ ...base, maxOrderQty: 10 }, 999)).toBe(10);
    expect(clampQuantity(base, 7.9)).toBe(7);
  });

  it('computes the cart subtotal from effective prices', () => {
    const other = { ...base, id: 'b', priceIqd: 100_000, salePriceIqd: null, supplierId: 'supplier-b' };
    const total = cartSubtotal([
      { product: base, quantity: 2 },
      { product: other, quantity: 5 },
    ]);
    expect(total).toBe(600_000 + 500_000);
  });

  it('groups cart lines by supplier because each supplier gets its own order', () => {
    const other = { ...base, id: 'b', supplierId: 'supplier-b' };
    const groups = groupBySupplier([
      { product: base, quantity: 2 },
      { product: other, quantity: 2 },
      { product: { ...base, id: 'c' }, quantity: 3 },
    ]);
    expect([...groups.keys()].sort()).toEqual(['supplier-a', 'supplier-b']);
    expect(groups.get('supplier-a')).toHaveLength(2);
  });
});
