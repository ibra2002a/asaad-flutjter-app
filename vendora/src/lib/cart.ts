/**
 * Cart rules that run in the browser for a good experience. The server re-validates
 * everything (prices, availability, coverage, minimums) in place_order().
 */
export const CART_STORAGE_KEY = 'vendora-cart-v1';
export const MAX_CART_LINES = 50;

export type CartLine = {
  productId: string;
  supplierId: string;
  quantity: number;
};

export type Cart = { lines: CartLine[] };

export const EMPTY_CART: Cart = { lines: [] };

export type AddResult = { ok: true; cart: Cart } | { ok: false; reason: 'other_supplier' | 'too_many_lines' };

/** Adds a product. A cart may only contain products from one supplier (first-release rule). */
export function addToCart(cart: Cart, line: CartLine): AddResult {
  if (cart.lines.length > 0 && cart.lines[0]!.supplierId !== line.supplierId) {
    return { ok: false, reason: 'other_supplier' };
  }
  const existing = cart.lines.find((l) => l.productId === line.productId);
  if (existing) {
    return {
      ok: true,
      cart: {
        lines: cart.lines.map((l) =>
          l.productId === line.productId ? { ...l, quantity: Math.min(l.quantity + line.quantity, 100_000) } : l,
        ),
      },
    };
  }
  if (cart.lines.length >= MAX_CART_LINES) {
    return { ok: false, reason: 'too_many_lines' };
  }
  return { ok: true, cart: { lines: [...cart.lines, line] } };
}

export function setQuantity(cart: Cart, productId: string, quantity: number): Cart {
  if (quantity < 1) return removeFromCart(cart, productId);
  return { lines: cart.lines.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(quantity, 100_000) } : l)) };
}

export function removeFromCart(cart: Cart, productId: string): Cart {
  return { lines: cart.lines.filter((l) => l.productId !== productId) };
}

export function cartCount(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** Parses untrusted data from localStorage, dropping anything malformed. */
export function parseCart(raw: unknown): Cart {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Cart).lines)) return EMPTY_CART;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const lines = (raw as Cart).lines
    .filter(
      (l): l is CartLine =>
        !!l &&
        typeof l.productId === 'string' &&
        UUID.test(l.productId) &&
        typeof l.supplierId === 'string' &&
        UUID.test(l.supplierId) &&
        Number.isInteger(l.quantity) &&
        l.quantity >= 1 &&
        l.quantity <= 100_000,
    )
    .slice(0, MAX_CART_LINES);
  const sameSupplier = lines.every((l) => l.supplierId === lines[0]?.supplierId);
  return sameSupplier ? { lines } : EMPTY_CART;
}
