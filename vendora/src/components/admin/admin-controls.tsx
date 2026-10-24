'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  createCategoryAction,
  createCommissionRuleAction,
  markCommissionsPaidAction,
  setBusinessStatusAction,
  setUserActiveAction,
  setUserRoleAction,
  toggleCategoryAction,
} from '@/actions/admin';
import { SubmitButton } from '@/components/ui/button';
import { buttonClass } from '@/components/ui/button-styles';
import { Notice } from '@/components/ui/card';
import { Field, TextArea, TextInput } from '@/components/ui/field';
import { useAction } from '@/components/forms/use-action';
import { formatIQD } from '@/lib/format';

/** Supplier approval controls. Reject and suspend require a written reason. */
export function SupplierDecisionButtons({ businessId, status }: { businessId: string; status: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { run, pending } = useAction(setBusinessStatusAction);

  function decide(next: 'approved' | 'rejected' | 'suspended') {
    setError(null);
    if (next !== 'approved' && note.trim().length < 3) {
      setError('اكتب سبب القرار (3 أحرف على الأقل).');
      return;
    }
    run({ businessId, status: next, note: note.trim() }, () => {
      setNote('');
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Field label="سبب القرار (إلزامي للرفض والإيقاف)" name={`note-${businessId}`} error={error ?? undefined}>
        <TextInput name={`note-${businessId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {status !== 'approved' ? (
          <button type="button" disabled={pending} onClick={() => decide('approved')} className={buttonClass('accent', 'min-h-9 px-3 text-xs')}>
            اعتماد
          </button>
        ) : null}
        {status !== 'rejected' ? (
          <button type="button" disabled={pending} onClick={() => decide('rejected')} className={buttonClass('danger', 'min-h-9 px-3 text-xs')}>
            رفض
          </button>
        ) : null}
        {status === 'approved' ? (
          <button type="button" disabled={pending} onClick={() => decide('suspended')} className={buttonClass('danger', 'min-h-9 px-3 text-xs')}>
            إيقاف
          </button>
        ) : null}
        {status === 'suspended' ? (
          <button type="button" disabled={pending} onClick={() => decide('approved')} className={buttonClass('secondary', 'min-h-9 px-3 text-xs')}>
            إعادة التفعيل
          </button>
        ) : null}
      </div>
      {pending ? <p className="text-xs text-muted">جارٍ الحفظ…</p> : null}
    </div>
  );
}

/** Change a user's role (buyer, ops, admin) and activate or deactivate the account. */
export function UserControls({ userId, role, isActive, isSelf }: { userId: string; role: string; isActive: boolean; isSelf: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const roleAction = useAction(setUserRoleAction);
  const activeAction = useAction(async () => setUserActiveAction(userId, !isActive, note));

  if (role === 'supplier') {
    return <p className="text-xs text-muted">حساب مورد: تغيير الدور أو الحالة يتم من صفحة الموردين.</p>;
  }

  return (
    <div className="space-y-3">
      <Field label="سبب التغيير (إلزامي)" name={`note-${userId}`}>
        <TextInput name={`note-${userId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Field>
      {message ? <Notice tone={message.tone === 'success' ? 'success' : 'error'}>{message.text}</Notice> : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-muted">الدور</span>
          <select
            defaultValue={role}
            disabled={isSelf || roleAction.pending}
            onChange={(e) => {
              if (note.trim().length < 3) {
                setMessage({ tone: 'error', text: 'اكتب سبب التغيير أولاً.' });
                e.target.value = role;
                return;
              }
              roleAction.run({ userId, role: e.target.value, note: note.trim() }, () => {
                setMessage({ tone: 'success', text: 'تم تحديث الدور.' });
                router.refresh();
              });
            }}
            className="min-h-9 rounded-lg border border-line px-2 text-sm"
          >
            <option value="buyer">مشتري</option>
            <option value="ops">فريق العمليات</option>
            <option value="admin">مدير</option>
          </select>
        </label>
        <button
          type="button"
          disabled={isSelf || activeAction.pending}
          onClick={() => {
            if (note.trim().length < 3) {
              setMessage({ tone: 'error', text: 'اكتب سبب التغيير أولاً.' });
              return;
            }
            activeAction.run(undefined, () => router.refresh());
          }}
          className={buttonClass(isActive ? 'danger' : 'secondary', 'min-h-9 px-3 text-xs')}
        >
          {isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
        </button>
      </div>
      {isSelf ? <p className="text-xs text-muted">لا يمكنك تغيير دور حسابك أو تعطيله.</p> : null}
      {activeAction.result && !activeAction.result.ok ? <p className="text-xs text-danger">{activeAction.result.message}</p> : null}
    </div>
  );
}

export function CommissionRuleForm() {
  const router = useRouter();
  const { run, pending, result } = useAction(createCommissionRuleAction);
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  return (
    <form
      className="grid gap-5 sm:grid-cols-2"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        run(
          {
            name: String(form.get('name') ?? ''),
            ratePercent: String(form.get('ratePercent') ?? ''),
            disputeWindowHours: String(form.get('disputeWindowHours') ?? '48'),
            deliveryFeeCommissionable: form.get('deliveryFeeCommissionable') === 'on',
            activate: form.get('activate') === 'on',
            note: String(form.get('note') ?? ''),
          },
          () => router.refresh(),
        );
      }}
    >
      {result ? <div className="sm:col-span-2"><Notice tone={result.ok ? 'success' : 'error'}>{result.message}</Notice></div> : null}
      <Field label="اسم القاعدة" name="name" error={errors.name}>
        <TextInput name="name" required error={errors.name} />
      </Field>
      <Field label="نسبة العمولة %" name="ratePercent" error={errors.ratePercent} hint="مثال: 4 أو 4.5 (الحد الأقصى 30)">
        <TextInput name="ratePercent" type="number" inputMode="decimal" step="0.01" min={0} max={30} dir="ltr" required error={errors.ratePercent} />
      </Field>
      <Field label="مدة نافذة الاعتراض (ساعة)" name="disputeWindowHours" error={errors.disputeWindowHours} hint="تبدأ عند اكتمال الطلب">
        <TextInput name="disputeWindowHours" type="number" min={0} max={720} defaultValue={48} dir="ltr" required error={errors.disputeWindowHours} />
      </Field>
      <div className="space-y-3">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="deliveryFeeCommissionable" className="size-5 accent-brand-700" />
          احتساب رسوم التوصيل ضمن العمولة (الافتراضي: لا)
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="activate" defaultChecked className="size-5 accent-brand-700" />
          تفعيل هذه القاعدة فوراً (تُلغى القاعدة النشطة الحالية للطلبات الجديدة فقط)
        </label>
      </div>
      <div className="sm:col-span-2">
        <Field label="ملاحظة التغيير" name="note" error={errors.note}>
          <TextArea name="note" rows={2} maxLength={1000} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel="جارٍ الحفظ…" disabled={pending}>
          إنشاء القاعدة
        </SubmitButton>
      </div>
    </form>
  );
}

export function MarkPaidForm({ commissions }: { commissions: Array<{ id: string; order_number: string; supplier: string; commission_iqd: number }> }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reference, setReference] = useState('');
  const { run, pending, result } = useAction(markCommissionsPaidAction);
  const total = commissions.filter((c) => selected.has(c.id)).reduce((s, c) => s + c.commission_iqd, 0);

  if (commissions.length === 0) {
    return <p className="text-sm text-muted">لا توجد عمولات مستحقة حالياً.</p>;
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run({ commissionIds: [...selected], reference }, () => {
          setSelected(new Set());
          setReference('');
          router.refresh();
        });
      }}
    >
      {result ? <Notice tone={result.ok ? 'success' : 'error'}>{result.message}</Notice> : null}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-brand-50 text-right">
            <tr>
              <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">اختيار</span></th>
              <th scope="col" className="px-3 py-2">الطلب</th>
              <th scope="col" className="px-3 py-2">المورد</th>
              <th scope="col" className="px-3 py-2 text-left">العمولة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {commissions.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`اختيار الطلب ${c.order_number}`}
                    checked={selected.has(c.id)}
                    onChange={(e) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (e.target.checked) next.add(c.id);
                        else next.delete(c.id);
                        return next;
                      })
                    }
                    className="size-4 accent-brand-700"
                  />
                </td>
                <td className="px-3 py-2 font-mono" dir="ltr">{c.order_number}</td>
                <td className="px-3 py-2">{c.supplier}</td>
                <td className="px-3 py-2 text-left font-semibold tabular">{formatIQD(c.commission_iqd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label={`المرجع (تحويل/إيصال) · المحدد: ${formatIQD(total)}`} name="reference">
          <TextInput name="reference" value={reference} onChange={(e) => setReference(e.target.value)} required minLength={3} maxLength={100} />
        </Field>
        <SubmitButton pendingLabel="جارٍ التسديد…" disabled={pending || selected.size === 0 || reference.trim().length < 3}>
          تعليم المحدد كمُسدَّد
        </SubmitButton>
      </div>
      <p className="text-xs text-muted">
        تسجيل التسديد يوثّق تحويلاً حدث خارج المنصة. المنصة لا تحتفظ بأموال المشترين، وتظهر هنا العمولات التي انتهت نافذة اعتراضها فقط.
      </p>
    </form>
  );
}

export function CategoryForm() {
  const router = useRouter();
  const { run, pending, result } = useAction(createCategoryAction);
  const errors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  return (
    <form
      className="grid gap-4 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-end"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        run(
          { slug: String(form.get('slug') ?? ''), nameAr: String(form.get('nameAr') ?? ''), sortOrder: String(form.get('sortOrder') ?? '0') },
          () => {
            e.currentTarget.reset();
            router.refresh();
          },
        );
      }}
    >
      <Field label="المعرّف (إنجليزي)" name="slug" error={errors.slug}>
        <TextInput name="slug" dir="ltr" required error={errors.slug} />
      </Field>
      <Field label="الاسم بالعربية" name="nameAr" error={errors.nameAr}>
        <TextInput name="nameAr" required error={errors.nameAr} />
      </Field>
      <Field label="الترتيب" name="sortOrder" error={errors.sortOrder}>
        <TextInput name="sortOrder" type="number" min={0} defaultValue={10} dir="ltr" error={errors.sortOrder} />
      </Field>
      <SubmitButton pendingLabel="جارٍ…" disabled={pending}>
        إضافة
      </SubmitButton>
      {result ? <div className="sm:col-span-4"><Notice tone={result.ok ? 'success' : 'error'}>{result.message}</Notice></div> : null}
    </form>
  );
}

export function CategoryToggle({ categoryId, isActive }: { categoryId: string; isActive: boolean }) {
  const router = useRouter();
  const { run, pending } = useAction(() => toggleCategoryAction(categoryId, !isActive));
  return (
    <button type="button" disabled={pending} onClick={() => run(undefined, () => router.refresh())} className={buttonClass('secondary', 'min-h-9 px-3 text-xs')}>
      {isActive ? 'إخفاء' : 'تفعيل'}
    </button>
  );
}

