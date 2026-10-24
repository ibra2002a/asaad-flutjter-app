'use client';

import { useActionState } from 'react';
import { adminSetCommissionRuleAction } from '@/lib/actions/admin';
import { INITIAL_FORM_STATE } from '@/lib/actions/types';
import { Alert, Card, Field, Input, Select, Textarea } from '../ui';
import { SubmitButton } from '../SubmitButton';

export function CommissionRuleForm({
  categories,
  suppliers,
}: {
  categories: Array<{ id: string; name_ar: string }>;
  suppliers: Array<{ id: string; legal_name: string }>;
}) {
  const [state, action] = useActionState(adminSetCommissionRuleAction, INITIAL_FORM_STATE);
  return (
    <Card>
      <h2 className="text-lg font-bold text-brand-950">تحديد نسبة عمولة جديدة</h2>
      <p className="mt-1 text-sm text-muted">الأولوية: اتفاق المورد الخاص، ثم الفئة، ثم النسبة العامة. الطلبات السابقة تحتفظ بالنسبة التي طُبقت وقت إنشائها.</p>
      <form action={action} className="mt-5 grid gap-5 sm:grid-cols-2" noValidate>
        {state.error ? <div className="sm:col-span-2"><Alert tone="error">{state.error}</Alert></div> : null}
        {state.success ? <div className="sm:col-span-2"><Alert tone="success">{state.success}</Alert></div> : null}
        <Field label="النطاق" htmlFor="cr-scope">
          <Select id="cr-scope" name="scope" defaultValue="global">
            <option value="global">النسبة العامة</option>
            <option value="category">فئة محددة</option>
            <option value="supplier">مورد محدد (اتفاق خاص)</option>
          </Select>
        </Field>
        <Field label="النسبة المئوية %" htmlFor="cr-percent" hint="مثال: 4 أو 3.5 — الحد الأعلى 30%." error={state.fieldErrors?.percent}>
          <Input id="cr-percent" name="percent" inputMode="decimal" dir="ltr" required />
        </Field>
        <Field label="الفئة (عند اختيار نطاق الفئة)" htmlFor="cr-category">
          <Select id="cr-category" name="categoryId" defaultValue="">
            <option value="">—</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
          </Select>
        </Field>
        <Field label="المورد (عند اختيار نطاق المورد)" htmlFor="cr-supplier">
          <Select id="cr-supplier" name="supplierId" defaultValue="">
            <option value="">—</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.legal_name}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="سبب التغيير (مطلوب)" htmlFor="cr-note" error={state.fieldErrors?.note}>
            <Textarea id="cr-note" name="note" maxLength={300} required />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <SubmitButton>حفظ النسبة</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
