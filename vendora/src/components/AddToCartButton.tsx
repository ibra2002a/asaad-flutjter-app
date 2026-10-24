'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart/cart-context';
import { clampQuantity, validateQuantity, type ProductConstraints } from '@/lib/domain/cart';
import { Alert } from './ui';

export function AddToCartButton({ product }: { product: ProductConstraints }) {
  const { addItem, lines } = useCart();
  const alreadyInCart = lines.find((l) => l.productId === product.id)?.quantity ?? 0;
  const [quantity, setQuantity] = useState(product.minOrderQty);
  const [added, setAdded] = useState(false);
  const outOfStock = product.stockQty < 1;
  const issue = validateQuantity(product, quantity);
  const max = Math.min(product.maxOrderQty ?? Number.POSITIVE_INFINITY, product.stockQty);

  const bump = (delta: number) => {
    setAdded(false);
    setQuantity((q) => clampQuantity(product, q + delta));
  };

  if (outOfStock) {
    return <Alert tone="warning">هذا المنتج غير متوفر حاليا.</Alert>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span id="qty-label" className="text-sm font-semibold text-brand-950">الكمية</span>
        <div role="group" aria-labelledby="qty-label" className="flex items-center rounded-xl border border-line bg-white">
          <button
            type="button"
            onClick={() => bump(-1)}
            disabled={quantity <= product.minOrderQty}
            className="flex min-h-11 min-w-11 items-center justify-center text-xl font-bold text-brand-900 hover:bg-brand-50 disabled:opacity-40"
            aria-label="إنقاص الكمية"
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={product.minOrderQty}
            max={Number.isFinite(max) ? max : undefined}
            value={quantity}
            onChange={(e) => {
              setAdded(false);
              setQuantity(Number(e.target.value));
            }}
            onBlur={() => setQuantity((q) => clampQuantity(product, q))}
            className="ltr-num h-11 w-20 border-x border-line text-center text-base font-bold focus:outline-none"
            aria-describedby="qty-hint"
          />
          <button
            type="button"
            onClick={() => bump(1)}
            disabled={quantity >= max}
            className="flex min-h-11 min-w-11 items-center justify-center text-xl font-bold text-brand-900 hover:bg-brand-50 disabled:opacity-40"
            aria-label="زيادة الكمية"
          >
            +
          </button>
        </div>
      </div>

      <p id="qty-hint" className="text-xs text-muted">
        الحد الأدنى {product.minOrderQty}
        {product.maxOrderQty ? ` · الحد الأعلى ${product.maxOrderQty}` : ''} · المتوفر {product.stockQty}
        {alreadyInCart > 0 ? ` · في سلتك ${alreadyInCart}` : ''}
      </p>

      {issue ? <Alert tone="error">{issueText(issue)}</Alert> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={issue !== null}
          onClick={() => {
            addItem(product.id, quantity);
            setAdded(true);
          }}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-brand-800 px-6 text-base font-bold text-white shadow-sm shadow-brand-900/20 hover:bg-brand-900 disabled:opacity-50"
        >
          أضف إلى السلة
        </button>
        {added ? (
          <Link href="/cart" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-lime-400 px-6 font-bold text-brand-950 hover:bg-lime-500">
            عرض السلة
          </Link>
        ) : null}
      </div>
      <p aria-live="polite" className="sr-only">{added ? 'تمت إضافة المنتج إلى السلة' : ''}</p>
    </div>
  );
}

function issueText(issue: NonNullable<ReturnType<typeof validateQuantity>>): string {
  switch (issue.code) {
    case 'BELOW_MINIMUM':
      return `الحد الأدنى للطلب ${issue.minimum}`;
    case 'ABOVE_MAXIMUM':
      return `الحد الأعلى للطلب ${issue.maximum}`;
    case 'INSUFFICIENT_STOCK':
      return `المتوفر ${issue.available} فقط`;
    case 'NOT_A_WHOLE_NUMBER':
      return 'أدخل كمية صحيحة';
  }
}
