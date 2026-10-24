'use client';

import { useActionState } from 'react';
import { updateProfileAction, updateBusinessAction, saveAddressAction } from '@/lib/actions/account';
import { INITIAL_FORM_STATE } from '@/lib/actions/types';
import type { Business, Profile } from '@/lib/data/types';
import { Alert, Card, Field, Input, Select, Textarea } from '../ui';
import { SubmitButton } from '../SubmitButton';

interface CityOption {
  code: string;
  name_ar: string;
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState(updateProfileAction, INITIAL_FORM_STATE);
  return (
    <Card>
      <h2 className="text-lg font-bold text-brand-950">بيانات المسؤول</h2>
      <form action={action} className="mt-5 grid gap-5 sm:grid-cols-2" noValidate>
        {state.error ? <div className="sm:col-span-2"><Alert tone="error">{state.error}</Alert></div> : null}
        {state.success ? <div className="sm:col-span-2"><Alert tone="success">{state.success}</Alert></div> : null}
        <Field label="الاسم الكامل" htmlFor="pf-name" error={state.fieldErrors?.fullName}>
          <Input id="pf-name" name="fullName" defaultValue={profile.full_name} required />
        </Field>
        <Field label="رقم الهاتف" htmlFor="pf-phone" error={state.fieldErrors?.phone}>
          <Input id="pf-phone" name="phone" dir="ltr" defaultValue={profile.phone ?? ''} required />
        </Field>
        <div className="sm:col-span-2">
          <SubmitButton>حفظ البيانات</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

export function BusinessForm({ business, cities }: { business: Business; cities: CityOption[] }) {
  const [state, action] = useActionState(updateBusinessAction, INITIAL_FORM_STATE);
  return (
    <Card>
      <h2 className="text-lg font-bold text-brand-950">الملف التجاري</h2>
      <p className="mt-1 text-sm text-muted">تظهر هذه البيانات للطرف الآخر في الطلبات المرتبطة بك.</p>
      <form action={action} className="mt-5 grid gap-5 sm:grid-cols-2" noValidate>
        {state.error ? <div className="sm:col-span-2"><Alert tone="error">{state.error}</Alert></div> : null}
        {state.success ? <div className="sm:col-span-2"><Alert tone="success">{state.success}</Alert></div> : null}
        <Field label="اسم المنشأة" htmlFor="bf-legal" error={state.fieldErrors?.legalName}>
          <Input id="bf-legal" name="legalName" defaultValue={business.legal_name} required />
        </Field>
        <Field label="الرقم الضريبي (اختياري)" htmlFor="bf-tax" error={state.fieldErrors?.taxNumber}>
          <Input id="bf-tax" name="taxNumber" defaultValue={business.tax_number ?? ''} />
        </Field>
        <Field label="المدينة" htmlFor="bf-city" error={state.fieldErrors?.cityCode}>
          <Select id="bf-city" name="cityCode" defaultValue={business.city_code}>
            {cities.map((c) => (
              <option key={c.code} value={c.code}>{c.name_ar}</option>
            ))}
          </Select>
        </Field>
        <Field label="هاتف العمل" htmlFor="bf-phone" error={state.fieldErrors?.phone}>
          <Input id="bf-phone" name="phone" dir="ltr" defaultValue={business.phone} required />
        </Field>
        <Field label="العنوان" htmlFor="bf-street" error={state.fieldErrors?.streetAddress}>
          <Input id="bf-street" name="streetAddress" defaultValue={business.street_address ?? ''} />
        </Field>
        <Field label="وصف النشاط (اختياري)" htmlFor="bf-desc" error={state.fieldErrors?.descriptionAr}>
          <Textarea id="bf-desc" name="descriptionAr" defaultValue={business.description_ar ?? ''} maxLength={2000} />
        </Field>
        <div className="sm:col-span-2">
          <SubmitButton>حفظ الملف التجاري</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

export function AddressForm({ cities }: { cities: CityOption[] }) {
  const [state, action] = useActionState(saveAddressAction, INITIAL_FORM_STATE);
  return (
    <Card>
      <h2 className="text-lg font-bold text-brand-950">إضافة عنوان توصيل</h2>
      <form action={action} className="mt-5 grid gap-5 sm:grid-cols-2" noValidate>
        {state.error ? <div className="sm:col-span-2"><Alert tone="error">{state.error}</Alert></div> : null}
        {state.success ? <div className="sm:col-span-2"><Alert tone="success">{state.success}</Alert></div> : null}
        <Field label="اسم العنوان" htmlFor="ad-label" hint="مثال: المخزن الرئيسي" error={state.fieldErrors?.label}>
          <Input id="ad-label" name="label" required />
        </Field>
        <Field label="المدينة" htmlFor="ad-city" error={state.fieldErrors?.cityCode}>
          <Select id="ad-city" name="cityCode" defaultValue="baghdad" required>
            {cities.map((c) => (
              <option key={c.code} value={c.code}>{c.name_ar}</option>
            ))}
          </Select>
        </Field>
        <Field label="المنطقة" htmlFor="ad-district" error={state.fieldErrors?.district}>
          <Input id="ad-district" name="district" required />
        </Field>
        <Field label="تفاصيل العنوان" htmlFor="ad-line" error={state.fieldErrors?.addressLine}>
          <Input id="ad-line" name="addressLine" required />
        </Field>
        <Field label="هاتف للتسليم" htmlFor="ad-phone" error={state.fieldErrors?.phone}>
          <Input id="ad-phone" name="phone" dir="ltr" required />
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold text-brand-950 sm:col-span-2">
          <input type="checkbox" name="isDefault" className="size-4 accent-brand-700" />
          اجعله العنوان الافتراضي
        </label>
        <div className="sm:col-span-2">
          <SubmitButton>حفظ العنوان</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
