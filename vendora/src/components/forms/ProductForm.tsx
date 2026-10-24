'use client';

import { useActionState } from 'react';
import { createProductAction, updateProductAction } from '@/lib/actions/supplier';
import { INITIAL_FORM_STATE } from '@/lib/actions/types';
import { productUnitLabelsAr, productUnits } from '@/lib/validation/schemas';
import { Alert, Card, Field, Input, Select, Textarea } from '../ui';
import { SubmitButton } from '../SubmitButton';

export interface ProductFormValues {
  id?: string;
  categoryId: string;
  nameAr: string;
  descriptionAr: string;
  unit: string;
  priceIqd: number;
  salePriceIqd: number | null;
  minOrderQty: number;
  maxOrderQty: number | null;
  stockQty: number;
  status: 'draft' | 'pending_review' | 'archived' | 'active' | 'rejected';
  moderationNote?: string | null;
}

export function ProductForm({
  categories,
  product,
  canPublish,
}: {
  categories: Array<{ id: string; name_ar: string }>;
  product?: ProductFormValues;
  canPublish: boolean;
}) {
  const action = product ? updateProductAction : createProductAction;
  const [state, formAction] = useActionState(action, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate encType="multipart/form-data">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {!canPublish ? (
        <Alert tone="warning">حسابك التجاري لم يُعتمد بعد. يمكنك تجهيز المنتج كمسودة، وسيُرسل للمراجعة بعد الاعتماد.</Alert>
      ) : null}

      <Card className="grid gap-5 sm:grid-cols-2">
        <h2 className="text-lg font-bold text-brand-950 sm:col-span-2">المعلومات الأساسية</h2>
        <Field label="اسم المنتج" htmlFor="pr-name" error={errors.nameAr}>
          <Input id="pr-name" name="nameAr" defaultValue={product?.nameAr} required maxLength={160} />
        </Field>
        <Field label="الفئة" htmlFor="pr-category" error={errors.categoryId}>
          <Select id="pr-category" name="categoryId" defaultValue={product?.categoryId ?? ''} required>
            <option value="" disabled>اختر الفئة</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name_ar}</option>
            ))}
          </Select>
        </Field>
        <Field label="وصف المنتج" htmlFor="pr-desc" error={errors.descriptionAr} hint="المواصفات، العبوة، بلد المنشأ، تاريخ الصلاحية إن وجد.">
          <Textarea id="pr-desc" name="descriptionAr" defaultValue={product?.descriptionAr} maxLength={4000} className="min-h-32" />
        </Field>
      </Card>

      <Card className="grid gap-5 sm:grid-cols-2">
        <h2 className="text-lg font-bold text-brand-950 sm:col-span-2">السعر والكميات</h2>
        <Field label="وحدة البيع" htmlFor="pr-unit" error={errors.unit}>
          <Select id="pr-unit" name="unit" defaultValue={product?.unit ?? 'carton'} required>
            {productUnits.map((u) => (
              <option key={u} value={u}>{productUnitLabelsAr[u]}</option>
            ))}
          </Select>
        </Field>
        <Field label="السعر للوحدة (دينار)" htmlFor="pr-price" error={errors.priceIqd} hint="أرقام صحيحة فقط، بدون فواصل عشرية.">
          <Input id="pr-price" name="priceIqd" inputMode="numeric" dir="ltr" defaultValue={product?.priceIqd} required />
        </Field>
        <Field label="سعر الخصم (اختياري)" htmlFor="pr-sale" error={errors.salePriceIqd} hint="يجب أن يكون أقل من السعر الأصلي.">
          <Input id="pr-sale" name="salePriceIqd" inputMode="numeric" dir="ltr" defaultValue={product?.salePriceIqd ?? ''} />
        </Field>
        <Field label="المخزون المتوفر" htmlFor="pr-stock" error={errors.stockQty}>
          <Input id="pr-stock" name="stockQty" inputMode="numeric" dir="ltr" defaultValue={product?.stockQty ?? 0} required />
        </Field>
        <Field label="الحد الأدنى للطلب" htmlFor="pr-min" error={errors.minOrderQty}>
          <Input id="pr-min" name="minOrderQty" inputMode="numeric" dir="ltr" defaultValue={product?.minOrderQty ?? 1} required />
        </Field>
        <Field label="الحد الأعلى للطلب (اختياري)" htmlFor="pr-max" error={errors.maxOrderQty}>
          <Input id="pr-max" name="maxOrderQty" inputMode="numeric" dir="ltr" defaultValue={product?.maxOrderQty ?? ''} />
        </Field>
      </Card>

      <Card className="space-y-5">
        <h2 className="text-lg font-bold text-brand-950">حالة النشر</h2>
        {product?.status === 'active' ? (
          <p className="text-sm text-slate-700">
            المنتج منشور حاليا. تعديل السعر والمخزون والتفاصيل يُحفظ مباشرة دون إعادة مراجعة.
          </p>
        ) : (
          <Field
            label="الحالة"
            htmlFor="pr-status"
            error={errors.status}
            hint="المنتج المرسل للمراجعة يظهر للعموم بعد اعتماد فريق VENDORA."
          >
            <Select
              id="pr-status"
              name="status"
              defaultValue={product?.status === 'rejected' || product?.status === 'pending_review' ? 'pending_review' : (product?.status ?? (canPublish ? 'pending_review' : 'draft'))}
            >
              <option value="draft">مسودة (غير منشورة)</option>
              <option value="pending_review" disabled={!canPublish}>إرسال للمراجعة</option>
              <option value="archived">مؤرشف</option>
            </Select>
          </Field>
        )}
        {product?.status === 'rejected' ? (
          <Alert tone="error">
            تم رفض هذا المنتج{product.moderationNote ? `: ${product.moderationNote}` : '.'} أصلح الملاحظة ثم أرسله للمراجعة من جديد.
          </Alert>
        ) : null}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-bold text-brand-950">صور المنتج</h2>
        <Field label="أضف صورا" htmlFor="pr-images" hint="حتى 8 صور، JPG أو PNG أو WebP، 3 ميغابايت كحد أقصى للصورة." error={errors.images}>
          <input
            id="pr-images"
            name="images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="block w-full rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-4 text-sm file:me-4 file:rounded-lg file:border-0 file:bg-brand-800 file:px-4 file:py-2 file:font-semibold file:text-white"
          />
        </Field>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <SubmitButton className="min-h-12 px-8 text-base">{product ? 'حفظ التعديلات' : 'إنشاء المنتج'}</SubmitButton>
      </div>
    </form>
  );
}
