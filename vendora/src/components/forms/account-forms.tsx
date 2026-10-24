'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addAddressAction, deleteAddressAction, updateBusinessAction, updateProfileAction } from '@/actions/account';
import { SubmitButton } from '@/components/ui/button';
import { buttonClass } from '@/components/ui/button-styles';
import { Card, Notice } from '@/components/ui/card';
import { Field, SelectInput, TextArea, TextInput } from '@/components/ui/field';
import { useAction } from '@/components/forms/use-action';
import { normalizePhone } from '@/lib/validation';

type City = { code: string; name_ar: string };

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const { run, pending, result } = useAction(updateProfileAction);
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        run({ fullName: String(form.get('fullName') ?? ''), phone: normalizePhone(String(form.get('phone') ?? '')) });
      }}
    >
      {result ? <Notice tone={result.ok ? 'success' : 'error'}>{result.message}</Notice> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="الاسم الكامل" name="fullName" error={errors.fullName}>
          <TextInput name="fullName" defaultValue={fullName} required error={errors.fullName} />
        </Field>
        <Field label="رقم الهاتف" name="phone" error={errors.phone}>
          <TextInput name="phone" type="tel" dir="ltr" defaultValue={phone} required error={errors.phone} />
        </Field>
      </div>
      <SubmitButton pendingLabel="جارٍ الحفظ…" disabled={pending}>
        حفظ البيانات
      </SubmitButton>
    </form>
  );
}

export function BusinessForm({
  business,
  cities,
  showAddress = true,
}: {
  business: { name: string; description: string | null; city_code: string; address: string | null; phone: string };
  cities: City[];
  showAddress?: boolean;
}) {
  const { run, pending, result } = useAction(updateBusinessAction);
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        run({
          name: String(form.get('name') ?? ''),
          description: String(form.get('description') ?? ''),
          cityCode: String(form.get('cityCode') ?? ''),
          address: String(form.get('address') ?? ''),
          phone: normalizePhone(String(form.get('phone') ?? '')),
        });
      }}
    >
      {result ? <Notice tone={result.ok ? 'success' : 'error'}>{result.message}</Notice> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="اسم النشاط التجاري" name="name" error={errors.name}>
          <TextInput name="name" defaultValue={business.name} required error={errors.name} />
        </Field>
        <Field label="الهاتف التجاري" name="phone" error={errors.phone}>
          <TextInput name="phone" type="tel" dir="ltr" defaultValue={business.phone} required error={errors.phone} />
        </Field>
        <Field label="المحافظة الرئيسية" name="cityCode" error={errors.cityCode}>
          <SelectInput name="cityCode" defaultValue={business.city_code} error={errors.cityCode}>
            {cities.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name_ar}
              </option>
            ))}
          </SelectInput>
        </Field>
        {showAddress ? (
          <Field label="العنوان" name="address" error={errors.address}>
            <TextInput name="address" defaultValue={business.address ?? ''} error={errors.address} />
          </Field>
        ) : null}
      </div>
      <Field label="وصف مختصر (اختياري)" name="description" error={errors.description}>
        <TextArea name="description" rows={3} defaultValue={business.description ?? ''} error={errors.description} />
      </Field>
      <SubmitButton pendingLabel="جارٍ الحفظ…" disabled={pending}>
        حفظ بيانات النشاط
      </SubmitButton>
    </form>
  );
}

export function AddressForm({ cities }: { cities: City[] }) {
  const router = useRouter();
  const { run, pending, result } = useAction(addAddressAction);
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  return (
    <form
      className="grid gap-5 sm:grid-cols-2"
      noValidate
      onSubmit={(e) => {
        const form = e.currentTarget;
        e.preventDefault();
        const data = new FormData(form);
        run(
          {
            label: String(data.get('label') ?? ''),
            cityCode: String(data.get('cityCode') ?? ''),
            addressLine: String(data.get('addressLine') ?? ''),
            landmark: String(data.get('landmark') ?? ''),
          },
          () => {
            form.reset();
            router.refresh();
          },
        );
      }}
    >
      {result ? <div className="sm:col-span-2"><Notice tone={result.ok ? 'success' : 'error'}>{result.ok ? 'تمت إضافة العنوان.' : result.message}</Notice></div> : null}
      <Field label="اسم العنوان" name="label" error={errors.label} hint="مثال: المحل، المخزن، المطعم">
        <TextInput name="label" required error={errors.label} />
      </Field>
      <Field label="المحافظة" name="cityCode" error={errors.cityCode}>
        <SelectInput name="cityCode" defaultValue="baghdad" error={errors.cityCode}>
          {cities.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name_ar}
            </option>
          ))}
        </SelectInput>
      </Field>
      <div className="sm:col-span-2">
        <Field label="العنوان التفصيلي" name="addressLine" error={errors.addressLine}>
          <TextInput name="addressLine" required error={errors.addressLine} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="أقرب معلم (اختياري)" name="landmark" error={errors.landmark}>
          <TextInput name="landmark" error={errors.landmark} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel="جارٍ الإضافة…" disabled={pending}>
          إضافة العنوان
        </SubmitButton>
      </div>
    </form>
  );
}

export function DeleteAddressButton({ addressId }: { addressId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const { run, pending } = useAction(async () => deleteAddressAction(addressId));
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        className={buttonClass('danger', 'min-h-9 px-3 text-xs')}
        onClick={() => {
          if (!window.confirm('هل تريد حذف هذا العنوان؟')) return;
          run(undefined, () => {
            setMessage(null);
            router.refresh();
          });
        }}
      >
        {pending ? 'جارٍ الحذف…' : 'حذف'}
      </button>
      {message ? <p className="text-xs text-danger">{message}</p> : null}
    </div>
  );
}

export function AddressCard({ label, city, line, landmark, children }: { label: string; city: string; line: string; landmark: string | null; children?: React.ReactNode }) {
  return (
    <Card className="flex flex-wrap items-start justify-between gap-4 p-4">
      <div className="space-y-1">
        <p className="font-semibold text-brand-900">{label}</p>
        <p className="text-sm text-muted">
          {city} · {line}
          {landmark ? ` · ${landmark}` : ''}
        </p>
      </div>
      {children}
    </Card>
  );
}
