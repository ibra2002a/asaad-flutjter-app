'use client';

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import {
  addToCart,
  cartCount,
  CART_STORAGE_KEY,
  EMPTY_CART,
  parseCart,
  removeFromCart,
  setQuantity as setLineQuantity,
  type AddResult,
  type Cart,
  type CartLine,
} from '@/lib/cart';

/**
 * The cart lives in localStorage and is read through useSyncExternalStore, so every component
 * sees the same value without copying it into state. If storage is blocked, an in-memory copy
 * keeps the cart working for the current page session.
 */
let memoryRaw: string | null = null;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    return memoryRaw;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function currentCart(): Cart {
  const raw = readRaw();
  if (!raw) return EMPTY_CART;
  try {
    return parseCart(JSON.parse(raw));
  } catch {
    return EMPTY_CART;
  }
}

function writeCart(cart: Cart) {
  const raw = JSON.stringify(cart);
  memoryRaw = raw;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, raw);
  } catch {
    // Storage unavailable (private mode or quota): the in-memory copy above still holds the cart.
  }
  listeners.forEach((notify) => notify());
}

type CartContextValue = {
  cart: Cart;
  count: number;
  hydrated: boolean;
  add: (line: CartLine) => AddResult;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  // undefined on the server and during hydration; the stored value (or null) once the client takes over.
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readRaw, () => undefined);
  const hydrated = raw !== undefined;

  const cart = useMemo<Cart>(() => {
    if (!raw) return EMPTY_CART;
    try {
      return parseCart(JSON.parse(raw));
    } catch {
      return EMPTY_CART;
    }
  }, [raw]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      count: cartCount(cart),
      hydrated,
      add: (line) => {
        const result = addToCart(currentCart(), line);
        if (result.ok) writeCart(result.cart);
        return result;
      },
      setQuantity: (productId, quantity) => writeCart(setLineQuantity(currentCart(), productId, quantity)),
      remove: (productId) => writeCart(removeFromCart(currentCart(), productId)),
      clear: () => writeCart(EMPTY_CART),
    }),
    [cart, hydrated],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) {
    throw new Error('useCart must be used inside <CartProvider>');
  }
  return value;
}
