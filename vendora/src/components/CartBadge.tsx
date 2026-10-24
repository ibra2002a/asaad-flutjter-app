'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart/cart-context';
import { formatCount } from '@/lib/domain/money';

export function CartBadge() {
  const { count, hydrated } = useCart();
  return (
    <Link
      href="/cart"
      className="relative inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-900 hover:bg-brand-50"
      aria-label={`سلة المشتريات، ${hydrated ? formatCount(count) : ''} منتج`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9.5" cy="19.5" r="1.5" />
        <circle cx="17" cy="19.5" r="1.5" />
      </svg>
      <span className="hidden sm:inline">السلة</span>
      {hydrated && count > 0 ? (
        <span className="ltr-num absolute -end-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-lime-400 px-1.5 text-xs font-bold text-brand-950">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
