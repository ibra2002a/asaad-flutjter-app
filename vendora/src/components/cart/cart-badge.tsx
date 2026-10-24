'use client';

import Link from 'next/link';
import { useCart } from '@/components/cart/cart-provider';

export function CartBadge() {
  const { count, hydrated } = useCart();
  return (
    <Link
      href="/cart"
      className="relative inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-brand-800 hover:bg-brand-50"
    >
      السلة
      <span
        aria-label={`عدد المنتجات في السلة: ${hydrated ? count : 0}`}
        className="inline-flex min-w-6 items-center justify-center rounded-full bg-lime-400 px-1.5 text-xs font-bold text-brand-950 tabular"
      >
        {hydrated ? count : 0}
      </span>
    </Link>
  );
}
