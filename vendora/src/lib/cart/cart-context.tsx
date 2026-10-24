'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MAX_CART_LINES, MAX_LINE_QUANTITY, type CartLine } from '@/lib/domain/cart';

/**
 * Cart lines live in this browser only. They carry no prices: the server reads
 * current prices and limits at checkout, so a stale or edited cart cannot
 * change what the buyer pays.
 */
const STORAGE_KEY = 'vendora.cart.v1';

interface CartContextValue {
  lines: CartLine[];
  count: number;
  hydrated: boolean;
  addItem: (productId: string, quantity: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function readStorage(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (line): line is CartLine =>
          typeof line === 'object' &&
          line !== null &&
          typeof (line as CartLine).productId === 'string' &&
          Number.isInteger((line as CartLine).quantity) &&
          (line as CartLine).quantity > 0 &&
          (line as CartLine).quantity <= MAX_LINE_QUANTITY,
      )
      .slice(0, MAX_CART_LINES);
  } catch {
    // Storage can be blocked (private mode, disabled cookies). The cart still works in memory.
    return [];
  }
}

function writeStorage(lines: CartLine[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Ignored: the in-memory cart remains correct for this page session.
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLines(readStorage());
    setHydrated(true);

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setLines(readStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((updater: (current: CartLine[]) => CartLine[]) => {
    setLines((current) => {
      const next = updater(current);
      writeStorage(next);
      return next;
    });
  }, []);

  const addItem = useCallback(
    (productId: string, quantity: number) => {
      update((current) => {
        const existing = current.find((l) => l.productId === productId);
        if (existing) {
          return current.map((l) =>
            l.productId === productId ? { ...l, quantity: Math.min(l.quantity + quantity, MAX_LINE_QUANTITY) } : l,
          );
        }
        if (current.length >= MAX_CART_LINES) return current;
        return [...current, { productId, quantity: Math.min(quantity, MAX_LINE_QUANTITY) }];
      });
    },
    [update],
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      update((current) =>
        current.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(Math.max(1, quantity), MAX_LINE_QUANTITY) } : l)),
      );
    },
    [update],
  );

  const removeItem = useCallback((productId: string) => {
    update((current) => current.filter((l) => l.productId !== productId));
  }, [update]);

  const clear = useCallback(() => update(() => []), [update]);

  const value = useMemo<CartContextValue>(
    () => ({ lines, count: lines.length, hydrated, addItem, setQuantity, removeItem, clear }),
    [lines, hydrated, addItem, setQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside CartProvider');
  }
  return context;
}
