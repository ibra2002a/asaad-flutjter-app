import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, EmptyState, PageHeader, formatDateAr } from '@/components/ui';

export const metadata: Metadata = { title: 'سجل التدقيق' };

interface AuditRow {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  reason: string | null;
  created_at: string;
  actor: { full_name: string } | null;
}

const ACTION_LABEL: Record<string, string> = {
  'business.review': 'مراجعة حساب تجاري',
  'product.moderate': 'مراجعة منتج',
  'profile.suspend': 'تعليق مستخدم',
  'profile.reactivate': 'تفعيل مستخدم',
  'commission_rule.set': 'تغيير نسبة عمولة',
  'commission.settle': 'تسوية عمولة',
  'dispute.resolve': 'حل نزاع',
  'category.upsert': 'تعديل فئة',
};

export default async function AdminAuditPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, reason, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as AuditRow[];

  return (
    <>
      <PageHeader title="سجل التدقيق" description="كل تغيير حساس تقوم به الإدارة مسجل هنا مع الوقت والسبب. السجل للقراءة فقط." />
      {rows.length === 0 ? (
        <EmptyState title="لا توجد سجلات بعد" description="ستظهر هنا قرارات الاعتماد والتعليق والعمولة والنزاعات." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-brand-50/70 text-brand-900">
              <tr>
                <th scope="col" className="px-5 py-3 text-start font-bold">الوقت</th>
                <th scope="col" className="px-5 py-3 text-start font-bold">الإجراء</th>
                <th scope="col" className="px-5 py-3 text-start font-bold">المعرف</th>
                <th scope="col" className="px-5 py-3 text-start font-bold">بواسطة</th>
                <th scope="col" className="px-5 py-3 text-start font-bold">السبب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 text-muted">{formatDateAr(r.created_at)}</td>
                  <td className="px-5 py-3 font-semibold text-brand-950">{ACTION_LABEL[r.action] ?? r.action}</td>
                  <td className="ltr-num max-w-40 truncate px-5 py-3 text-xs text-muted">{r.entity_type}:{r.entity_id}</td>
                  <td className="px-5 py-3">{r.actor?.full_name ?? 'النظام'}</td>
                  <td className="px-5 py-3 text-slate-700">{r.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
