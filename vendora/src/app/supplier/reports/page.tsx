import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatIqd } from '@/lib/domain/money';
import { Card, EmptyState, PageHeader, formatDayAr } from '@/components/ui';

export const metadata: Metadata = { title: 'التقارير والعمولة' };

interface CommissionRow {
  id: string;
  eligible_base_iqd: number;
  commission_iqd: number;
  status: 'accrued' | 'settled';
  created_at: string;
}

export default async function SupplierReportsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: commissions } = await supabase
    .from('commissions')
    .select('id, eligible_base_iqd, commission_iqd, status, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  const rows = ((commissions ?? []) as unknown as CommissionRow[]).map((r) => ({
    ...r,
    eligible_base_iqd: Number(r.eligible_base_iqd),
    commission_iqd: Number(r.commission_iqd),
  }));

  const { data: adjustments } = await supabase.from('commission_adjustments').select('commission_id, amount_iqd');
  const adjustmentByCommission = new Map<string, number>();
  for (const a of (adjustments ?? []) as Array<{ commission_id: string; amount_iqd: number }>) {
    adjustmentByCommission.set(a.commission_id, (adjustmentByCommission.get(a.commission_id) ?? 0) + Number(a.amount_iqd));
  }

  const totals = rows.reduce(
    (acc, r) => {
      const adjusted = r.commission_iqd + (adjustmentByCommission.get(r.id) ?? 0);
      acc.sales += r.eligible_base_iqd;
      acc.commission += r.commission_iqd;
      acc.net += adjusted;
      if (r.status === 'accrued') acc.outstanding += adjusted;
      return acc;
    },
    { sales: 0, commission: 0, net: 0, outstanding: 0 },
  );

  const byMonth = new Map<string, { sales: number; net: number; orders: number }>();
  for (const r of rows) {
    const key = new Intl.DateTimeFormat('ar-IQ', { year: 'numeric', month: 'long', timeZone: 'Asia/Baghdad' }).format(new Date(r.created_at));
    const bucket = byMonth.get(key) ?? { sales: 0, net: 0, orders: 0 };
    bucket.sales += r.eligible_base_iqd;
    bucket.net += r.commission_iqd + (adjustmentByCommission.get(r.id) ?? 0);
    bucket.orders += 1;
    byMonth.set(key, bucket);
  }

  return (
    <>
      <PageHeader
        title="التقارير والعمولة"
        description="المبيعات المكتملة والعمولة المستحقة للمنصة. تُحسب العمولة على المنتجات بعد الخصم دون رسوم التوصيل، وتُعدل عند الإرجاع."
      />

      {rows.length === 0 ? (
        <EmptyState title="لا توجد طلبات مكتملة بعد" description="تظهر المبيعات هنا عند اكتمال الطلبات وتأكيد الاستلام." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card><p className="text-sm text-muted">مبيعات مكتملة</p><p className="ltr-num mt-2 text-xl font-black text-brand-900">{formatIqd(totals.sales)}</p></Card>
            <Card><p className="text-sm text-muted">العمولة الأصلية</p><p className="ltr-num mt-2 text-xl font-black text-brand-900">{formatIqd(totals.commission)}</p></Card>
            <Card><p className="text-sm text-muted">صافي العمولة بعد الإرجاع</p><p className="ltr-num mt-2 text-xl font-black text-brand-900">{formatIqd(totals.net)}</p></Card>
            <Card><p className="text-sm text-muted">بانتظار التسوية</p><p className="ltr-num mt-2 text-xl font-black text-amber-800">{formatIqd(totals.outstanding)}</p></Card>
          </div>

          <Card className="mt-8 overflow-x-auto p-0">
            <div className="border-b border-line px-5 py-4"><h2 className="font-bold text-brand-950">حسب الشهر</h2></div>
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-brand-50/70 text-brand-900">
                <tr>
                  <th scope="col" className="px-5 py-3 text-start font-bold">الشهر</th>
                  <th scope="col" className="px-5 py-3 text-end font-bold">الطلبات</th>
                  <th scope="col" className="px-5 py-3 text-end font-bold">المبيعات</th>
                  <th scope="col" className="px-5 py-3 text-end font-bold">العمولة الصافية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...byMonth.entries()].map(([month, v]) => (
                  <tr key={month}>
                    <td className="px-5 py-3 font-semibold">{month}</td>
                    <td className="ltr-num px-5 py-3 text-end">{v.orders}</td>
                    <td className="ltr-num px-5 py-3 text-end">{formatIqd(v.sales)}</td>
                    <td className="ltr-num px-5 py-3 text-end">{formatIqd(v.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <p className="mt-6 text-xs text-muted">
            آخر تحديث: {formatDayAr(new Date())}. التسوية تتم يدويا بين المنصة والمورد وفق الاتفاق؛ لا تحتفظ VENDORA بأموال المبيعات.
          </p>
        </>
      )}
    </>
  );
}
