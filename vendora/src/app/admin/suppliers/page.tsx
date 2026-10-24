import type { Metadata } from 'next';
import { ActionForm } from '@/components/ActionForm';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { adminReviewBusinessAction } from '@/lib/actions/admin';
import { formatDateAr, Card, PageHeader, Select, buttonClass, Textarea } from '@/components/ui';
import { VerificationBadge } from '@/components/StatusBadge';
import { SubmitButton } from '@/components/SubmitButton';
import { QueryNotice } from '@/components/FormMessage';
import { listCities } from '@/lib/data/catalog';

export const metadata: Metadata = { title: 'إدارة الموردين' };

type SearchParams = Promise<{ status?: string; notice?: string; error?: string }>;
const STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const;

interface SupplierRow {
  id: string;
  legal_name: string;
  city_code: string;
  phone: string;
  tax_number: string | null;
  verification_status: (typeof STATUSES)[number];
  review_note: string | null;
  created_at: string;
  profiles: { full_name: string; is_active: boolean } | null;
}

export default async function AdminSuppliersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = (STATUSES as readonly string[]).includes(params.status ?? '') ? params.status! : 'pending';
  const supabase = await createSupabaseServerClient();
  const [{ data }, cities] = await Promise.all([
    supabase
      .from('businesses')
      .select('id, legal_name, city_code, phone, tax_number, verification_status, review_note, created_at, profiles:owner_id(full_name, is_active)')
      .eq('kind', 'supplier')
      .eq('verification_status', status)
      .order('created_at', { ascending: true })
      .limit(200),
    listCities(),
  ]);
  const rows = (data ?? []) as unknown as SupplierRow[];
  const cityName = new Map(cities.map((c) => [c.code, c.name_ar]));

  return (
    <>
      <PageHeader
        title="إدارة الموردين"
        description="اعتمد الموردين بعد التحقق من هويتهم التجارية. الرفض والتعليق يتطلبان سببا يظهر للمورد."
        actions={
          <form method="get" className="flex items-center gap-2">
            <Select name="status" defaultValue={status} aria-label="تصفية حسب الحالة" className="min-w-44">
              <option value="pending">بانتظار الاعتماد</option>
              <option value="approved">معتمدون</option>
              <option value="rejected">مرفوضون</option>
              <option value="suspended">معلّقون</option>
            </Select>
            <button type="submit" className={buttonClass('secondary')}>عرض</button>
          </form>
        }
      />
      <div className="mb-6"><QueryNotice notice={params.notice} error={params.error} /></div>

      {rows.length === 0 ? (
        <Card><p className="text-center text-muted">لا توجد سجلات بهذه الحالة.</p></Card>
      ) : (
        <ul className="space-y-4">
          {rows.map((s) => (
            <li key={s.id}>
              <Card className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-brand-950">{s.legal_name}</h2>
                    <p className="text-sm text-muted">{s.profiles?.full_name} · {cityName.get(s.city_code) ?? s.city_code} · <span className="ltr-num">{s.phone}</span></p>
                    <p className="text-xs text-muted">تاريخ التسجيل: {formatDateAr(s.created_at)} {s.tax_number ? <>· الرقم الضريبي <span className="ltr-num">{s.tax_number}</span></> : null}</p>
                  </div>
                  <VerificationBadge status={s.verification_status} />
                </div>
                {s.review_note ? <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">ملاحظة المراجعة: {s.review_note}</p> : null}

                <ActionForm action={adminReviewBusinessAction} className="space-y-3 border-t border-line pt-4">
                  <input type="hidden" name="businessId" value={s.id} />
                  <input type="hidden" name="returnTo" value="/admin/suppliers" />
                  <label htmlFor={`note-${s.id}`} className="text-sm font-semibold text-brand-950">ملاحظة للمورد</label>
                  <Textarea id={`note-${s.id}`} name="note" className="min-h-20" maxLength={1000} placeholder="مطلوبة عند الرفض أو التعليق" />
                  <div className="flex flex-wrap gap-2">
                    <SubmitButton name="status" value="approved" variant="accent" pendingLabel="…" className="min-h-11">اعتماد</SubmitButton>
                    <SubmitButton name="status" value="rejected" variant="secondary" pendingLabel="…" className="min-h-11">رفض</SubmitButton>
                    <SubmitButton name="status" value="suspended" variant="danger" pendingLabel="…" className="min-h-11">تعليق</SubmitButton>
                  </div>
                </ActionForm>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
