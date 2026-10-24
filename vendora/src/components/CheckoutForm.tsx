'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart/cart-context';
import { getCartProductsAction, placeOrderAction, type CartProductView } from '@/lib/actions/buyer';
import { INITIAL_FORM_STATE } from '@/lib/actions/types';
import { cartSubtotal, describeIssue, groupBySupplier, validateQuantity, effectiveUnitPrice } from '@/lib/domain/cart';
import { formatIqd } from '@/lib/domain/money';
import type { Address } from '@/lib/data/types';
import { Alert, Card, Skeleton, buttonClass } from './ui';
import { SubmitButton } from './SubmitButton';

export function CheckoutForm({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const { lines, clear, hydrated } = useCart();
  const [products, setProducts] = useState<Map<string, CartProductView> | null>(null);
  const [addressId, setAddressId] = useState(addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? '');
  // One key per checkout attempt. Retrying the same attempt cannot create a second order.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, formAction] = useActionState(placeOrderAction, INITIAL_FORM_STATE);

  const idsKey = lines.map((l) => l.productId).sort().join(',');
  useEffect(() => {
    if (!hydrated) return;
    if (lines.length === 0) {
      setProducts(new Map());
      return;
    }
    let cancelled = false;
    getCartProductsAction(lines.map((l) => l.productId)).then((rows) => {
      if (!cancelled) setProducts(new Map(rows.map((r) => [r.id, r])));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, idsKey]);

  useEffect(() => {
    if (state.redirectTo) {
      clear();
      router.push(state.redirectTo);
    }
  }, [state.redirectTo, clear, router]);

  const resolved = useMemo(
    () =>
      products
        ? lines
            .map((line) => ({ line, product: products.get(line.productId) }))
            .filter((x): x is { line: (typeof lines)[number]; product: CartProductView } => Boolean(x.product))
        : [],
    [lines, products],
  );

  if (!hydrated || products === null) {
    return <Skeleton className="h-64" />;
  }

  if (lines.length === 0) {
    return <Alert tone="info">سلتك فارغة. <Link className="font-bold underline" href="/products">تصفح المنتجات</Link></Alert>;
  }

  const issues = resolved
    .map(({ line, product }) => ({ product, issue: validateQuantity(product, line.quantity) }))
    .filter((x) => x.issue !== null);
  const missing = lines.length - resolved.length;
  const blocked = issues.length > 0 || missing > 0;
  const groups = groupBySupplier(resolved);
  const subtotal = cartSubtotal(resolved.map((r) => ({ product: r.product, quantity: r.line.quantity })));
  const payload = JSON.stringify(resolved.map((r) => ({ productId: r.line.productId, quantity: r.line.quantity })));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="items" value={payload} />
        <input type="hidden" name="addressId" value={addressId} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

        <Card>
          <h2 className="text-lg font-bold text-brand-950">عنوان التوصيل</h2>
          <fieldset className="mt-4 space-y-3">
            <legend className="sr-only">اختر عنوان التوصيل</legend>
            {addresses.map((address) => (
              <label
                key={address.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                  addressId === address.id ? 'border-brand-500 bg-brand-50 ring-3 ring-brand-100' : 'border-line hover:border-brand-200'
                }`}
              >
                <input
                  type="radio"
                  name="addressChoice"
                  value={address.id}
                  checked={addressId === address.id}
                  onChange={() => setAddressId(address.id)}
                  className="mt-1 size-4 accent-brand-700"
                />
                <span>
                  <span className="block font-bold text-brand-950">{address.label}</span>
                  <span className="block text-sm text-slate-700">{address.district} — {address.address_line}</span>
                  <span className="ltr-num block text-xs text-muted">{address.phone}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-brand-950">مراجعة الطلب</h2>
          <div className="mt-4 space-y-5">
            {[...groups.entries()].map(([supplierId, groupLines]) => (
              <div key={supplierId} className="rounded-xl border border-line">
                <p className="border-b border-line bg-brand-50/60 px-4 py-2 font-bold text-brand-950">
                  طلب من: {groupLines[0]?.product.supplierName}
                </p>
                <ul className="divide-y divide-line">
                  {groupLines.map(({ line, product }) => (
                    <li key={line.productId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className="min-w-0">
                        <span className="font-semibold text-brand-950">{product.nameAr}</span>
                        <span className="ltr-num block text-muted">{line.quantity} × {formatIqd(effectiveUnitPrice(product))}</span>
                      </span>
                      <span className="ltr-num font-bold">{formatIqd(effectiveUnitPrice(product) * line.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {issues.length > 0 ? (
            <div className="mt-4">
              <Alert tone="error">
                <ul className="list-disc space-y-1 ps-5">
                  {issues.map(({ product, issue }) => (
                    <li key={product.id}>{product.nameAr}: {issue ? describeIssue(issue, product.unit) : ''}</li>
                  ))}
                </ul>
                <p className="mt-2">عدّل الكميات من <Link href="/cart" className="font-bold underline">السلة</Link> ثم أعد المحاولة.</p>
              </Alert>
            </div>
          ) : null}
          {missing > 0 ? <p className="mt-4"><Alert tone="warning">{missing} منتج لم يعد متاحا وسيتم استبعاده.</Alert></p> : null}
        </Card>

        {state.error ? <Alert tone="error">{state.error}</Alert> : null}

        <SubmitButton variant="accent" pendingLabel="جاري تأكيد الطلب…" className={`min-h-12 w-full text-base ${blocked || !addressId ? 'pointer-events-none opacity-50' : ''}`}>
          تأكيد الطلب
        </SubmitButton>
        <p className="text-center text-xs text-muted">بالضغط على تأكيد الطلب توافق على شروط المنصة. الدفع يتم مباشرة مع المورد وفق الاتفاق.</p>
      </form>

      <aside className="h-fit rounded-2xl border border-line bg-white p-6 shadow-sm lg:sticky lg:top-24">
        <h2 className="text-lg font-bold text-brand-950">الإجمالي</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between"><dt className="text-muted">عدد الطلبات</dt><dd className="ltr-num font-semibold">{groups.size}</dd></div>
          <div className="flex justify-between border-t border-line pt-3 text-base"><dt className="font-bold">المجموع</dt><dd className="ltr-num font-black text-brand-900">{formatIqd(subtotal)}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted">لا تشمل رسوم التوصيل إلا إذا أعلنها المورد صراحة.</p>
        <Link href="/cart" className={buttonClass('secondary', 'mt-6 w-full')}>تعديل السلة</Link>
      </aside>
    </div>
  );
}
