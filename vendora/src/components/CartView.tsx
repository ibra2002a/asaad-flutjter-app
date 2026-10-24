'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart/cart-context';
import { getCartProductsAction, type CartProductView } from '@/lib/actions/buyer';
import { cartSubtotal, describeIssue, groupBySupplier, validateQuantity, clampQuantity, effectiveUnitPrice } from '@/lib/domain/cart';
import { formatIqd } from '@/lib/domain/money';
import { buttonClass, EmptyState, Card, Skeleton, Alert } from './ui';

export function CartView() {
  const { lines, hydrated, setQuantity, removeItem } = useCart();
  const [products, setProducts] = useState<Map<string, CartProductView> | null>(null);
  const [loadError, setLoadError] = useState(false);

  const idsKey = lines.map((l) => l.productId).sort().join(',');

  useEffect(() => {
    if (!hydrated) return;
    if (lines.length === 0) {
      setProducts(new Map());
      return;
    }
    let cancelled = false;
    getCartProductsAction(lines.map((l) => l.productId))
      .then((rows) => {
        if (!cancelled) {
          setProducts(new Map(rows.map((r) => [r.id, r])));
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
    // The cart identity, not every quantity change, decides when to refetch prices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, idsKey]);

  const resolved = useMemo(() => {
    if (!products) return [];
    return lines
      .map((line) => ({ line, product: products.get(line.productId) }))
      .filter((x): x is { line: (typeof lines)[number]; product: CartProductView } => Boolean(x.product));
  }, [lines, products]);

  const unavailable = products ? lines.filter((l) => !products.has(l.productId)) : [];
  const subtotal = cartSubtotal(resolved.map((r) => ({ product: r.product, quantity: r.line.quantity })));
  const groups = groupBySupplier(resolved);

  if (!hydrated || (lines.length > 0 && products === null)) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="جاري تحميل السلة">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        title="سلتك فارغة"
        description="أضف منتجات من الكتالوج، وسنحسب لك الأسعار والكميات المطلوبة."
        action={<Link href="/products" className={buttonClass('primary')}>تصفح المنتجات</Link>}
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {loadError ? <Alert tone="error">تعذر تحديث أسعار السلة. أعد تحميل الصفحة.</Alert> : null}
        {unavailable.length > 0 ? (
          <Alert tone="warning">
            {unavailable.length === 1 ? 'منتج واحد لم يعد متاحا' : `${unavailable.length} منتجات لم تعد متاحة`}، وسيتم استبعاده من الطلب.
            <button type="button" className="ms-2 font-bold underline" onClick={() => unavailable.forEach((l) => removeItem(l.productId))}>
              إزالة من السلة
            </button>
          </Alert>
        ) : null}

        {[...groups.entries()].map(([supplierId, groupLines]) => {
          const supplierName = groupLines[0]?.product.supplierName ?? '';
          const groupTotal = cartSubtotal(groupLines.map((g) => ({ product: g.product, quantity: g.line.quantity })));
          return (
            <Card key={supplierId} className="p-0">
              <div className="flex items-center justify-between gap-3 border-b border-line bg-brand-50/60 px-5 py-3">
                <p className="font-bold text-brand-950">{supplierName}</p>
                <p className="ltr-num text-sm font-semibold text-brand-800">{formatIqd(groupTotal)}</p>
              </div>
              <ul className="divide-y divide-line">
                {groupLines.map(({ line, product }) => {
                  const issue = validateQuantity(product, line.quantity);
                  return (
                    <li key={line.productId} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <Link href={`/products/${product.id}`} className="font-bold text-brand-950 hover:text-brand-700">
                          {product.nameAr}
                        </Link>
                        <p className="ltr-num mt-1 text-sm text-muted">{formatIqd(effectiveUnitPrice(product))} / {product.unit}</p>
                        {issue ? <p className="mt-1 text-xs font-semibold text-red-700">{describeIssue(issue, product.unit)}</p> : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <label htmlFor={`qty-${line.productId}`} className="sr-only">الكمية لـ {product.nameAr}</label>
                        <input
                          id={`qty-${line.productId}`}
                          type="number"
                          inputMode="numeric"
                          min={product.minOrderQty}
                          value={line.quantity}
                          onChange={(e) => setQuantity(line.productId, Number(e.target.value))}
                          onBlur={(e) => setQuantity(line.productId, clampQuantity(product, Number(e.target.value)))}
                          className="ltr-num h-11 w-24 rounded-xl border border-line px-3 text-center font-bold"
                        />
                        <p className="ltr-num w-32 text-end font-bold text-brand-900">{formatIqd(effectiveUnitPrice(product) * line.quantity)}</p>
                        <button type="button" onClick={() => removeItem(line.productId)} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                          حذف
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>

      <aside aria-label="ملخص الطلب" className="h-fit rounded-2xl border border-line bg-white p-6 shadow-sm lg:sticky lg:top-24">
        <h2 className="text-lg font-bold text-brand-950">ملخص الطلب</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between"><dt className="text-muted">عدد المنتجات</dt><dd className="ltr-num font-semibold">{resolved.length}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">عدد الموردين</dt><dd className="ltr-num font-semibold">{groups.size}</dd></div>
          <div className="flex justify-between border-t border-line pt-3 text-base"><dt className="font-bold">المجموع الفرعي</dt><dd className="ltr-num font-black text-brand-900">{formatIqd(subtotal)}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted">يُنشأ طلب منفصل لكل مورد. رسوم التوصيل (إن وجدت) تُحدد عند التأكيد.</p>
        <Link
          href="/checkout"
          aria-disabled={resolved.length === 0}
          className={buttonClass('accent', `mt-6 w-full min-h-12 text-base ${resolved.length === 0 ? 'pointer-events-none opacity-50' : ''}`)}
        >
          متابعة للدفع
        </Link>
        <p className="mt-3 text-center text-xs text-muted">تسجيل الدخول مطلوب لإتمام الطلب.</p>
      </aside>
    </div>
  );
}
