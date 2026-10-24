'use client';

import { useActionState } from 'react';
import { adminUpsertCategoryAction } from '@/lib/actions/admin';
import { INITIAL_FORM_STATE } from '@/lib/actions/types';
import { Alert, Card, Field, Input, Textarea } from '../ui';
import { SubmitButton } from '../SubmitButton';

export interface CategoryFormValues {
  id: string;
  slug: string;
  name_ar: string;
  description_ar: string | null;
  sort_order: number;
  is_active: boolean;
}

export function CategoryForm({ category }: { category?: CategoryFormValues }) {
  const [state, action] = useActionState(adminUpsertCategoryAction, INITIAL_FORM_STATE);
  return (
    <Card>
      <h2 className="text-lg font-bold text-brand-950">{category ? `تعديل: ${category.name_ar}` : 'إضافة فئة جديدة'}</h2>
      <form action={action} className="mt-5 grid gap-5 sm:grid-cols-2" noValidate>
        {category ? <input type="hidden" name="id" value={category.id} /> : null}
        {state.error ? <div className="sm:col-span-2"><Alert tone="error">{state.error}</Alert></div> : null}
        {state.success ? <div className="sm:col-span-2"><Alert tone="success">{state.success}</Alert></div> : null}
        <Field label="اسم الفئة" htmlFor={`cat-name-${category?.id ?? 'new'}`} error={state.fieldErrors?.nameAr}>
          <Input id={`cat-name-${category?.id ?? 'new'}`} name="nameAr" defaultValue={category?.name_ar} required />
        </Field>
        <Field label="الرابط المختصر (slug)" htmlFor={`cat-slug-${category?.id ?? 'new'}`} hint="أحرف إنجليزية صغيرة وشرطات" error={state.fieldErrors?.slug}>
          <Input id={`cat-slug-${category?.id ?? 'new'}`} name="slug" dir="ltr" defaultValue={category?.slug} required />
        </Field>
        <div className="sm:col-span-2">
          <Field label="وصف مختصر" htmlFor={`cat-desc-${category?.id ?? 'new'}`}>
            <Textarea id={`cat-desc-${category?.id ?? 'new'}`} name="descriptionAr" defaultValue={category?.description_ar ?? ''} maxLength={500} />
          </Field>
        </div>
        <Field label="ترتيب العرض" htmlFor={`cat-sort-${category?.id ?? 'new'}`}>
          <Input id={`cat-sort-${category?.id ?? 'new'}`} name="sortOrder" type="number" dir="ltr" defaultValue={category?.sort_order ?? 100} />
        </Field>
        <label className="flex items-center gap-2 self-end text-sm font-semibold text-brand-950">
          <input type="checkbox" name="isActive" defaultChecked={category?.is_active ?? true} className="size-4 accent-brand-700" />
          فئة مفعّلة وتظهر للتجار
        </label>
        <div className="sm:col-span-2">
          <SubmitButton>{category ? 'حفظ التعديل' : 'إضافة الفئة'}</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
