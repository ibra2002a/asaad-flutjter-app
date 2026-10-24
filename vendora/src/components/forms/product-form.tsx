'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createProductAction, updateProductAction } from '@/actions/products';
import { SubmitButton } from '@/components/ui/button';
import { buttonClass } from '@/components/ui/button-styles';
import { Card, Notice } from '@/components/ui/card';
import { Field, SelectInput, TextArea, TextInput } from '@/components/ui/field';
import { useAction } from '@/components/forms/use-action';
import { STOCK_LABELS } from '@/lib/labels';
import type { StockStatus } from '@/lib/types';

export type ProductFormValues = {
  name: string;
  description: string;
  categoryId: string;
  unit: string;
  priceIqd: number;
  minQuantity: number;
  stockStatus: StockStatus;
  isPublished: boolean;
};

export function ProductForm({
  productId,
  initial,
  categories,
  canPublish,
}: {
  productId?: string;
  initial: ProductFormValues;
  categories: { id: string; name_ar: string }[];
  canPublish: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>(initial);
  const create = useAction(createProductAction);
  const update = useAction((input: ProductFormValues) => updateProductAction(productId!, input));
  const active = productId ? update : create;
  const result = active.result;
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (productId) {
      update.run(values, () => router.refresh());
    } else {
      create.run(values, (outcome) => {
        router.push(`/supplier/products/${outcome.data?.id}`);
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {result ? <Notice tone={result.ok ? 'success' : 'error'}>{result.message}</Notice> : null}
      {!canPublish ? (
        <Notice tone="warning">
          حسابك قيد المراجعة. يمكنك حفظ المنتجات كمسودات، ولن تظهر للمشترين حتى يتم اعتماد حسابك.
        </Notice>
      ) : null}

      <Card className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="اسم المنتج" name="name" error={errors.name}>
            <TextInput name="name" value={values.name} onChange={(e) => set('name', e.target.value)} required maxLength={150} error={errors.name} />
          </Field>
        </div>
        <Field label="الفئة" name="categoryId" error={errors.categoryId}>
          <SelectInput name="categoryId" value={values.categoryId} onChange={(e) => set('categoryId', e.target.value)} required error={errors.categoryId}>
            <option value="" disabled>
              اختر الفئة
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="الوحدة" name="unit" error={errors.unit} hint="مثال: كرتون، كيس، كغم، علبة">
          <TextInput name="unit" value={values.unit} onChange={(e) => set('unit', e.target.value)} required maxLength={40} error={errors.unit} />
        </Field>
        <Field label="السعر للوحدة (دينار عراقي)" name="priceIqd" error={errors.priceIqd}>
          <TextInput
            name="priceIqd"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            dir="ltr"
            value={values.priceIqd}
            onChange={(e) => set('priceIqd', Number(e.target.value))}
            required
            error={errors.priceIqd}
          />
        </Field>
        <Field label="الحد الأدنى للكمية" name="minQuantity" error={errors.minQuantity}>
          <TextInput
            name="minQuantity"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            dir="ltr"
            value={values.minQuantity}
            onChange={(e) => set('minQuantity', Number(e.target.value))}
            required
            error={errors.minQuantity}
          />
        </Field>
        <Field label="حالة التوفر" name="stockStatus" error={errors.stockStatus}>
          <SelectInput name="stockStatus" value={values.stockStatus} onChange={(e) => set('stockStatus', e.target.value as StockStatus)} error={errors.stockStatus}>
            {(Object.keys(STOCK_LABELS) as StockStatus[]).map((s) => (
              <option key={s} value={s}>
                {STOCK_LABELS[s]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="space-y-1.5">
          <span className="block text-sm font-semibold">النشر</span>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3">
            <input
              type="checkbox"
              name="isPublished"
              checked={values.isPublished}
              disabled={!canPublish && !values.isPublished}
              onChange={(e) => set('isPublished', e.target.checked)}
              className="size-5 accent-brand-700"
            />
            <span className="text-sm">
              {values.isPublished ? 'منشور ويظهر للمشترين' : 'مسودة (غير ظاهرة للمشترين)'}
            </span>
          </label>
          {errors.isPublished ? <p className="text-sm text-danger" role="alert">{errors.isPublished}</p> : null}
        </div>
        <div className="sm:col-span-2">
          <Field label="وصف المنتج (اختياري)" name="description" error={errors.description}>
            <TextArea name="description" rows={4} maxLength={2000} value={values.description} onChange={(e) => set('description', e.target.value)} error={errors.description} />
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingLabel="جارٍ الحفظ…" disabled={create.pending || update.pending}>
          {productId ? 'حفظ التعديلات' : 'حفظ المنتج'}
        </SubmitButton>
        <Link href="/supplier/products" className={buttonClass('secondary')}>
          رجوع إلى المنتجات
        </Link>
      </div>
    </form>
  );
}
