'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getCartProductsAction, type CartProduct } from '@/actions/catalog';
import { placeOrderAction } from '@/actions/orders';
import { useCart } from '@/components/cart/cart-provider';
import { SubmitButton } from '@/components/ui/button';
import { buttonClass } from '@/components/ui/button-styles';
import { Card, Notice } from '@/components/ui/card';
import { Field, SelectInput, TextArea, TextInput } from '@/components/ui/field';
import { useAction } from '@/components/forms/use-action';
import { formatIQD } from '@/lib/format';
import { PAYMENT_LABELS } from '@/lib/labels';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/types';

export type AddressOption = { id: string; label: string; city_name: string; address_line: string };

export function CheckoutForm({ addresses, defaultPhone }: { addresses: AddressOption[]; defaultPhone: string }) {
  const router = useRouter();
  const { cart, hydrated, clear } = useCart();
  const [products, setProducts] = useState<Record<string, CartProduct>>({});
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_on_delivery');
  const [contactPhone, setContactPhone] = useState(defaultPhone);
  const [buyerNotes, setBuyerNotes] = useState('');
  // One key per checkout attempt: a double-click or retry cannot create a second order.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const { run, pending, result } = useAction(placeOrderAction);
  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  const formError = result && !result.ok ? result.message : null;

  useEffect(() => {
    if (!hydrated || cart.lines.length === 0) return;
    let cancelled = false;
    getCartProductsAction(cart.lines.map((l) => l.productId)).then((res) => {
      if (!cancelled && res.ok) setProducts(Object.fromEntries((res.data ?? []).map((p) => [p.id, p])));
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, cart.lines]);

  const total = useMemo(
    () => cart.lines.reduce((sum, line) => sum + (products[line.productId]?.price_iqd ?? 0) * line.quantity, 0),
    [cart.lines, products],
  );

  if (!hydrated) return <p className="text-muted">جارٍ تحميل بيانات الطلب…</p>;

  if (cart.lines.length === 0) {
    return (
      <Notice tone="info">
        سلتك فارغة.{' '}
        <Link href="/products" className="font-semibold underline">
          تصفح المنتجات
        </Link>
      </Notice>
    );
  }

  if (addresses.length === 0) {
    return (
      <Notice tone="warning">
        أضف عنوان توصيل أولاً من{' '}
        <Link href="/account" className="font-semibold underline">
          صفحة الحساب
        </Link>
        .
      </Notice>
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(
      {
        items: cart.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        addressId,
        paymentMethod,
        contactPhone,
        buyerNotes: buyerNotes.trim() || undefined,
        idempotencyKey,
      },
      (outcome) => {
        clear();
        router.push(`/orders/${outcome.data?.orderId}?placed=1`);
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_340px]" noValidate>
      <div className="space-y-6">
        {formError ? <Notice tone="error">{formError}</Notice> : null}

        <Card className="space-y-5">
          <h2 className="text-lg font-bold text-brand-900">عنوان التوصيل</h2>
          <Field label="اختر العنوان" name="addressId" error={fieldErrors.addressId}>
            <SelectInput name="addressId" value={addressId} onChange={(e) => setAddressId(e.target.value)} error={fieldErrors.addressId}>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} · {a.city_name} · {a.address_line}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="رقم الهاتف للتنسيق مع المندوب" name="contactPhone" error={fieldErrors.contactPhone}>
            <TextInput
              name="contactPhone"
              type="tel"
              dir="ltr"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              required
              error={fieldErrors.contactPhone}
            />
          </Field>
        </Card>

        <Card className="space-y-5">
          <h2 className="text-lg font-bold text-brand-900">طريقة الدفع المتفق عليها</h2>
          <fieldset className="grid gap-3 sm:grid-cols-3">
            <legend className="sr-only">طريقة الدفع</legend>
            {PAYMENT_METHODS.map((method) => (
              <label
                key={method}
                className={`cursor-pointer rounded-xl border p-4 text-sm font-semibold ${
                  paymentMethod === method ? 'border-brand-700 bg-brand-50 ring-2 ring-brand-600/30' : 'border-line'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method}
                  checked={paymentMethod === method}
                  onChange={() => setPaymentMethod(method)}
                  className="sr-only"
                />
                {PAYMENT_LABELS[method]}
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-muted">المنصة لا تحتفظ بأموال المشترين. يتم الدفع بالطريقة المتفق عليها مع المورد.</p>
        </Card>

        <Card>
          <Field label="ملاحظات للمورد (اختياري)" name="buyerNotes" error={fieldErrors.buyerNotes} hint="مثال: التوصيل قبل الساعة 10 صباحاً">
            <TextArea
              name="buyerNotes"
              rows={3}
              maxLength={1000}
              value={buyerNotes}
              onChange={(e) => setBuyerNotes(e.target.value)}
              error={fieldErrors.buyerNotes}
            />
          </Field>
        </Card>
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border border-line bg-brand-50/50 p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-bold text-brand-900">ملخص الطلب</h2>
        <ul className="space-y-2 text-sm">
          {cart.lines.map((line) => {
            const p = products[line.productId];
            return (
              <li key={line.productId} className="flex justify-between gap-3">
                <span className="line-clamp-1">
                  {p?.name ?? '…'} × <span className="tabular">{line.quantity}</span>
                </span>
                <span className="shrink-0 font-semibold tabular">{p ? formatIQD(p.price_iqd * line.quantity) : '—'}</span>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-between border-t border-line pt-3 font-bold">
          <span>الإجمالي (قبل التوصيل)</span>
          <span className="tabular">{formatIQD(total)}</span>
        </div>
        <SubmitButton variant="accent" className="w-full" pendingLabel="جارٍ إرسال الطلب…" disabled={pending}>
          تأكيد وإرسال الطلب
        </SubmitButton>
        <p className="text-xs text-muted">
          عند الإرسال يتحقق الخادم من الأسعار والتوفر والحد الأدنى ومنطقة التوصيل، ثم تظهر حالة الطلب في صفحة طلباتي.
        </p>
        <Link href="/cart" className={buttonClass('ghost', 'w-full text-sm')}>
          تعديل السلة
        </Link>
      </aside>
    </form>
  );
}
