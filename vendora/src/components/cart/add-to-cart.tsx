'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/components/cart/cart-provider';
import { buttonClass } from '@/components/ui/button-styles';
import { Notice } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field';

type Props = {
  productId: string;
  supplierId: string;
  minQuantity: number;
  unavailable: boolean;
};

export function AddToCartButton({ productId, supplierId, minQuantity, unavailable }: Props) {
  const { add, cart, hydrated } = useCart();
  const [quantity, setQuantity] = useState(minQuantity);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (unavailable) {
    return <Notice tone="warning">هذا المنتج غير متوفر حالياً.</Notice>;
  }

  const inCartElsewhere = hydrated && cart.lines.length > 0 && cart.lines[0]!.supplierId !== supplierId;

  function handleAdd() {
    if (!Number.isInteger(quantity) || quantity < minQuantity) {
      setMessage({ tone: 'error', text: `الحد الأدنى للكمية ${minQuantity}.` });
      return;
    }
    const result = add({ productId, supplierId, quantity });
    if (!result.ok) {
      setMessage({
        tone: 'error',
        text:
          result.reason === 'other_supplier'
            ? 'سلتك تحتوي على منتجات من مورد آخر. كل طلب يجب أن يكون من مورد واحد. أكمل طلبك الحالي أو أفرغ السلة أولاً.'
            : 'وصلت السلة إلى الحد الأقصى من المنتجات المختلفة.',
      });
      return;
    }
    setMessage({ tone: 'success', text: 'تمت إضافة المنتج إلى السلة.' });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1.5">
          <label htmlFor="quantity" className="block text-sm font-semibold">
            الكمية
          </label>
          <input
            id="quantity"
            type="number"
            inputMode="numeric"
            min={minQuantity}
            max={100000}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className={`${inputClass} w-40`}
          />
          <p className="text-xs text-muted">الحد الأدنى: {minQuantity}</p>
        </div>
        <button type="button" onClick={handleAdd} className={buttonClass('accent', 'sm:mb-6')}>
          أضف إلى السلة
        </button>
      </div>

      {inCartElsewhere ? (
        <Notice tone="warning">
          سلتك الحالية تحتوي على منتجات من مورد آخر. يمكنك{' '}
          <Link href="/cart" className="font-semibold underline">
            مراجعة السلة
          </Link>{' '}
          وإتمام الطلب الحالي أولاً.
        </Notice>
      ) : null}
      {message ? <Notice tone={message.tone === 'success' ? 'success' : 'error'}>{message.text}</Notice> : null}
    </div>
  );
}
