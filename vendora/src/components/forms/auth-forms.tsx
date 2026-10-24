'use client';

import { useActionState, useState } from 'react';
import { signInAction, signUpAction } from '@/actions/auth';
import { initialActionState, type ActionResult } from '@/lib/action-result';
import { SubmitButton } from '@/components/ui/button';
import { Field, SelectInput, TextInput } from '@/components/ui/field';
import { Notice } from '@/components/ui/card';

type City = { code: string; name_ar: string };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<ActionResult, FormData>(signInAction, initialActionState);
  const errors = !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next ?? ''} />
      {!state.ok && state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <Field label="البريد الإلكتروني" name="email" error={errors.email}>
        <TextInput name="email" type="email" autoComplete="email" dir="ltr" required error={errors.email} />
      </Field>
      <Field label="كلمة المرور" name="password" error={errors.password}>
        <TextInput name="password" type="password" autoComplete="current-password" dir="ltr" required error={errors.password} />
      </Field>
      <SubmitButton className="w-full" pendingLabel="جارٍ تسجيل الدخول…">
        تسجيل الدخول
      </SubmitButton>
    </form>
  );
}

export function RegisterForm({ cities }: { cities: City[] }) {
  const [state, formAction] = useActionState<ActionResult<{ needsConfirmation: boolean }>, FormData>(
    signUpAction,
    initialActionState,
  );
  const [role, setRole] = useState<'buyer' | 'supplier'>('buyer');
  const errors = !state.ok ? (state.fieldErrors ?? {}) : {};

  if (state.ok && state.data?.needsConfirmation) {
    return (
      <Notice tone="success">
        أرسلنا رابط التأكيد إلى بريدك الإلكتروني. افتح الرابط لتفعيل الحساب، ثم سجّل الدخول.
      </Notice>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {!state.ok && state.message ? <Notice tone="error">{state.message}</Notice> : null}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">نوع الحساب</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { value: 'buyer', title: 'مشتري تجاري', text: 'شراء بالجملة لمحلك أو مطعمك' },
              { value: 'supplier', title: 'مورد جملة', text: 'عرض منتجاتك وإدارة الطلبات (يتطلب اعتماد)' },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                role === option.value ? 'border-brand-700 bg-brand-50 ring-2 ring-brand-600/30' : 'border-line hover:border-brand-600/50'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={role === option.value}
                onChange={() => setRole(option.value)}
                className="sr-only"
              />
              <span className="block font-semibold text-brand-900">{option.title}</span>
              <span className="mt-1 block text-sm text-muted">{option.text}</span>
            </label>
          ))}
        </div>
        {errors.role ? <p className="text-sm text-danger" role="alert">{errors.role}</p> : null}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="الاسم الكامل" name="fullName" error={errors.fullName}>
          <TextInput name="fullName" autoComplete="name" required error={errors.fullName} />
        </Field>
        <Field label="رقم الهاتف" name="phone" error={errors.phone} hint="مثال: 07701234567">
          <TextInput name="phone" type="tel" autoComplete="tel" dir="ltr" required error={errors.phone} />
        </Field>
        <Field label={role === 'supplier' ? 'اسم شركة / مؤسسة المورد' : 'اسم المحل / المطعم / الشركة'} name="businessName" error={errors.businessName}>
          <TextInput name="businessName" autoComplete="organization" required error={errors.businessName} />
        </Field>
        <Field label="المحافظة" name="cityCode" error={errors.cityCode} hint={role === 'supplier' ? 'أول محافظة تخدمها (يمكن إضافة غيرها لاحقاً)' : undefined}>
          <SelectInput name="cityCode" required error={errors.cityCode} defaultValue="baghdad">
            {cities.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name_ar}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="عنوان النشاط (اختياري)" name="businessAddress" error={errors.businessAddress}>
          <TextInput name="businessAddress" autoComplete="street-address" error={errors.businessAddress} />
        </Field>
        <Field label="البريد الإلكتروني" name="email" error={errors.email}>
          <TextInput name="email" type="email" autoComplete="email" dir="ltr" required error={errors.email} />
        </Field>
        <Field label="كلمة المرور" name="password" error={errors.password} hint="8 أحرف على الأقل">
          <TextInput name="password" type="password" autoComplete="new-password" dir="ltr" required minLength={8} error={errors.password} />
        </Field>
      </div>

      {role === 'supplier' ? (
        <Notice tone="warning">
          حسابات الموردين تُراجع يدوياً قبل تفعيل النشر واستقبال الطلبات. ستتمكن من إدخال منتجاتك كمسودات أثناء المراجعة.
        </Notice>
      ) : null}

      <SubmitButton className="w-full" pendingLabel="جارٍ إنشاء الحساب…">
        إنشاء الحساب
      </SubmitButton>
    </form>
  );
}
