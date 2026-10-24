import { describe, expect, it } from 'vitest';
import { addToCart, cartCount, EMPTY_CART, MAX_CART_LINES, parseCart, removeFromCart, setQuantity } from '@/lib/cart';

const SUP_A = '11111111-1111-4111-8111-111111111111';
const SUP_B = '22222222-2222-4222-8222-222222222222';
const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('cart rules', () => {
  it('keeps a cart to one supplier', () => {
    const first = addToCart(EMPTY_CART, { productId: P1, supplierId: SUP_A, quantity: 2 });
    expect(first.ok).toBe(true);
    const blocked = addToCart(first.ok ? first.cart : EMPTY_CART, { productId: P2, supplierId: SUP_B, quantity: 1 });
    expect(blocked).toEqual({ ok: false, reason: 'other_supplier' });
  });

  it('merges repeated products and caps quantities', () => {
    const a = addToCart(EMPTY_CART, { productId: P1, supplierId: SUP_A, quantity: 99_990 });
    const b = addToCart(a.ok ? a.cart : EMPTY_CART, { productId: P1, supplierId: SUP_A, quantity: 50 });
    expect(b.ok && b.cart.lines).toEqual([{ productId: P1, supplierId: SUP_A, quantity: 100_000 }]);
  });

  it('limits the number of distinct lines', () => {
    let cart = EMPTY_CART;
    for (let i = 0; i < MAX_CART_LINES; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      const result = addToCart(cart, { productId: id, supplierId: SUP_A, quantity: 1 });
      expect(result.ok).toBe(true);
      if (result.ok) cart = result.cart;
    }
    const overflow = addToCart(cart, { productId: '99999999-9999-4999-8999-999999999999', supplierId: SUP_A, quantity: 1 });
    expect(overflow).toEqual({ ok: false, reason: 'too_many_lines' });
  });

  it('sets quantities, removes lines, and counts units', () => {
    const added = addToCart(EMPTY_CART, { productId: P1, supplierId: SUP_A, quantity: 3 });
    const cart = added.ok ? added.cart : EMPTY_CART;
    expect(cartCount(setQuantity(cart, P1, 7))).toBe(7);
    expect(setQuantity(cart, P1, 0).lines).toEqual([]);
    expect(removeFromCart(cart, P1).lines).toEqual([]);
  });

  it('drops malformed or mixed-supplier data restored from storage', () => {
    expect(parseCart(null)).toEqual(EMPTY_CART);
    expect(parseCart({ lines: 'nope' })).toEqual(EMPTY_CART);
    expect(parseCart({ lines: [{ productId: 'not-a-uuid', supplierId: SUP_A, quantity: 1 }] })).toEqual(EMPTY_CART);
    expect(parseCart({ lines: [{ productId: P1, supplierId: SUP_A, quantity: 1.5 }] })).toEqual(EMPTY_CART);
    const mixed = {
      lines: [
        { productId: P1, supplierId: SUP_A, quantity: 1 },
        { productId: P2, supplierId: SUP_B, quantity: 1 },
      ],
    };
    expect(parseCart(mixed)).toEqual(EMPTY_CART);
    const valid = { lines: [{ productId: P1, supplierId: SUP_A, quantity: 4 }] };
    expect(parseCart(valid)).toEqual(valid);
  });
});
