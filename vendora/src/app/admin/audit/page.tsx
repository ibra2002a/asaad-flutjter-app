import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';
import { PageHeader } from '@/components/ui/card';

export const metadata: Metadata = { title: 'سجل التدقيق' };

export default async function AuditPage() {
  await requireSession(['admin']);
  const supabase = await createClient();
  const { data } = await supabase
    .from('audit_logs')
    .select('id, actor_role, action, table_name, record_id, old_data, new_data, note, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  const rows = (data ?? []) as Array<{
    id: number;
    actor_role: string | null;
    action: string;
    table_name: string;
    record_id: string | null;
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    note: string | null;
    created_at: string;
  }>;

  return (
    <div className="space-y-6">
      <PageHeader title="سجل التدقيق" description="كل إجراء إداري حساس: الاعتماد، الأدوار، التفعيل، العمولات، النزاعات. آخر 200 سجل." />
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-brand-50 text-right">
              <tr>
                <th scope="col" className="px-4 py-3">الوقت</th>
                <th scope="col" className="px-4 py-3">المنفِّذ</th>
                <th scope="col" className="px-4 py-3">الجدول</th>
                <th scope="col" className="px-4 py-3">العملية</th>
                <th scope="col" className="px-4 py-3">الملاحظة</th>
                <th scope="col" className="px-4 py-3">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                  <td className="px-4 py-3">{r.actor_role ? ROLE_LABELS[r.actor_role as keyof typeof ROLE_LABELS] : 'النظام'}</td>
                  <td className="px-4 py-3 font-mono text-xs" dir="ltr">{r.table_name}</td>
                  <td className="px-4 py-3">{r.action}</td>
                  <td className="px-4 py-3">{r.note ?? '—'}</td>
                  <td className="px-4 py-3">
                    <details>
                      <summary className="cursor-pointer text-brand-700">عرض</summary>
                      <pre className="mt-2 max-w-md overflow-x-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs" dir="ltr">
                        {JSON.stringify({ id: r.record_id, old: r.old_data, new: r.new_data }, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
