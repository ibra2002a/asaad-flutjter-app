'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getCartProductsAction, type CartProduct } from '@/actions/catalog';
import { useCart } from '@/components/cart/cart-provider';
import { buttonClass } from '@/components/ui/button-styles';
import { Card, EmptyState, Notice } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field';
import { formatIQD } from '@/lib/format';
import { STOCK_LABELS } from '@/lib/labels';

export function CartView({ canCheckout }: { canCheckout: boolean }) {
  const { cart, hydrated, setQuantity, remove } = useCart();
  const ids = cart.lines.map((l) => l.productId);
  const idsKey = ids.join(',');
  // Products are fetched for one exact list of ids. Results for an older list are ignored.
  const [loaded, setLoaded] = useState<{ key: string; products: Record<string, CartProduct>; error: string | null } | null>(null);

  useEffect(() => {
    if (!hydrated || idsKey === '') return;
    let cancelled = false;
    getCartProductsAction(idsKey.split(',')).then((result) => {
      if (cancelled) return;
      setLoaded({
        key: idsKey,
        products: result.ok ? Object.fromEntries((result.data ?? []).map((p) => [p.id, p])) : {},
        error: result.ok ? null : result.message,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, idsKey]);

  const current = loaded && loaded.key === idsKey ? loaded : null;
  const products = useMemo(() => current?.products ?? {}, [current]);
  const loadError = current?.error ?? null;
  const loading = hydrated && idsKey !== '' && !current;

  const rows = useMemo(
    () =>
      cart.lines.map((line) => {
        const product = products[line.productId];
        const issues: string[] = [];
        if (product) {
          if (product.stock_status === 'out_of_stock') issues.push('غير متوفر حالياً');
          if (line.quantity < product.min_quantity) issues.push(`الحد الأدنى ${product.min_quantity}`);
        }
        return { line, product, issues };
      }),
    [cart.lines, products],
  );

  const total = rows.reduce((sum, r) => sum + (r.product ? r.product.price_iqd * r.line.quantity : 0), 0);
  const hasIssues = rows.some((r) => r.issues.length > 0 || !r.product);

  if (!hydrated) {
    return <p className="text-muted">جارٍ تحميل السلة…</p>;
  }
  if (cart.lines.length === 0) {
    return (
      <EmptyState
        title="سلتك فارغة"
        description="ابدأ بتصفح المنتجات وأضف ما تحتاجه. يمكن أن تحتوي كل سلة على منتجات من مورد واحد."
        action={
          <Link href="/products" className={buttonClass('primary')}>
            تصفح المنتجات
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <section aria-label="منتجات السلة" className="space-y-4">
        {loadError ? <Notice tone="error">{loadError}</Notice> : null}
        {loading ? <p className="text-sm text-muted">جارٍ تحديث الأسعار والتوفر…</p> : null}
        <ul className="space-y-4">
          {rows.map(({ line, product, issues }) => (
            <li key={line.productId}>
              <Card className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Link href={`/products/${line.productId}`} className="font-semibold text-brand-900 hover:underline">
                      {product?.name ?? 'منتج غير متاح'}
                    </Link>
                    {product ? (
                      <p className="text-sm text-muted">
                        {product.supplier_name} · {formatIQD(product.price_iqd)} / {product.unit} · {STOCK_LABELS[product.stock_status]}
                      </p>
                    ) : null}
                  </div>
                  <button type="button" onClick={() => remove(line.productId)} className={buttonClass('ghost', 'text-danger')}>
                    حذف
                  </button>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <label className="space-y-1">
                    <span className="block text-sm text-muted">الكمية</span>
                    <input
                      type="number"
                      min={product?.min_quantity ?? 1}
                      max={100000}
                      value={line.quantity}
                      onChange={(e) => setQuantity(line.productId, Number(e.target.value))}
                      className={`${inputClass} w-32`}
                      aria-label={`كمية ${product?.name ?? 'المنتج'}`}
                    />
                  </label>
                  <p className="text-lg font-bold text-brand-900 tabular">
                    {product ? formatIQD(product.price_iqd * line.quantity) : '—'}
                  </p>
                </div>
                {issues.length > 0 ? <Notice tone="warning">{issues.join(' · ')}</Notice> : null}
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <aside className="h-fit space-y-4 rounded-2xl border border-line bg-brand-50/50 p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-bold text-brand-900">ملخص الطلب</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">عدد المنتجات</dt>
            <dd className="font-semibold tabular">{cart.lines.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">المجموع (قبل التوصيل)</dt>
            <dd className="font-bold tabular">{formatIQD(total)}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted">تُحسب الأسعار النهائية من الخادم عند تأكيد الطلب. رسوم التوصيل يتفق عليها مع المورد.</p>
        {canCheckout ? (
          <Link
            href={hasIssues ? '/cart' : '/checkout'}
            aria-disabled={hasIssues}
            className={buttonClass('accent', `w-full ${hasIssues ? 'pointer-events-none opacity-60' : ''}`)}
          >
            متابعة إلى الدفع
          </Link>
        ) : (
          <Link href="/login?next=/checkout" className={buttonClass('primary', 'w-full')}>
            سجّل الدخول للمتابعة
          </Link>
        )}
        {hasIssues ? <p className="text-xs text-warning">عدّل الكميات أو احذف المنتجات غير المتاحة قبل المتابعة.</p> : null}
      </aside>
    </div>
  );
}
