'use client';

import { useActionState, useState } from 'react';
import { registerAction } from '@/lib/actions/auth';
import { INITIAL_FORM_STATE } from '@/lib/actions/types';
import { Alert, Field, Input, Select } from '../ui';
import { SubmitButton } from '../SubmitButton';

interface CityOption {
  code: string;
  name_ar: string;
}

export function RegisterForm({ cities }: { cities: CityOption[] }) {
  const [state, formAction] = useActionState(registerAction, INITIAL_FORM_STATE);
  const [role, setRole] = useState<'buyer' | 'supplier'>('buyer');
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold text-brand-950">نوع الحساب</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { value: 'buyer', title: 'تاجر / مشترٍ', text: 'أشتري بالجملة للمحل أو الشركة' },
            { value: 'supplier', title: 'مورد', text: 'أبيع منتجاتي بالجملة للتجار' },
          ].map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition ${
                role === option.value ? 'border-brand-600 bg-brand-50 ring-3 ring-brand-100' : 'border-line hover:border-brand-200'
              }`}
            >
              <span className="flex items-center gap-2 font-bold text-brand-950">
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={role === option.value}
                  onChange={() => setRole(option.value as 'buyer' | 'supplier')}
                  className="size-4 accent-brand-700"
                />
                {option.title}
              </span>
              <span className="text-sm text-muted">{option.text}</span>
            </label>
          ))}
        </div>
        {errors.role ? <p className="text-xs font-medium text-red-700">{errors.role}</p> : null}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="الاسم الكامل" htmlFor="fullName" error={errors.fullName}>
          <Input id="fullName" name="fullName" autoComplete="name" required />
        </Field>
        <Field label={role === 'supplier' ? 'اسم الشركة المورّدة' : 'اسم المحل أو الشركة'} htmlFor="legalName" error={errors.legalName}>
          <Input id="legalName" name="legalName" required />
        </Field>
        <Field label="المدينة" htmlFor="cityCode" error={errors.cityCode}>
          <Select id="cityCode" name="cityCode" defaultValue="baghdad" required>
            {cities.map((c) => (
              <option key={c.code} value={c.code}>{c.name_ar}</option>
            ))}
          </Select>
        </Field>
        <Field label="رقم الهاتف" htmlFor="phone" hint="مثال: 07701234567" error={errors.phone}>
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" required />
        </Field>
        <Field label="البريد الإلكتروني" htmlFor="email" error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" required />
        </Field>
        <Field label="كلمة المرور" htmlFor="password" hint="٨ أحرف على الأقل" error={errors.password}>
          <Input id="password" name="password" type="password" autoComplete="new-password" dir="ltr" minLength={8} required />
        </Field>
      </div>

      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input type="checkbox" name="acceptTerms" className="mt-1 size-4 accent-brand-700" required />
        <span>أوافق على شروط استخدام VENDORA وسياسة الخصوصية، وأقر بأن المعلومات التجارية المقدمة صحيحة.</span>
      </label>
      {errors.acceptTerms ? <p className="text-xs font-medium text-red-700">{errors.acceptTerms}</p> : null}

      <SubmitButton className="w-full text-base">{role === 'supplier' ? 'تسجيل كمورد' : 'إنشاء الحساب'}</SubmitButton>
      {role === 'supplier' ? <p className="text-center text-xs text-muted">حسابات الموردين تُراجع قبل نشر المنتجات.</p> : null}
    </form>
  );
}
