import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatDateTime, formatIQD } from '@/lib/format';
import { Card, PageHeader, Stat } from '@/components/ui/card';
import { buttonClass } from '@/components/ui/button-styles';
import { CommissionRuleForm, MarkPaidForm } from '@/components/admin/admin-controls';

export const metadata: Metadata = { title: 'العمولات' };

const DAY_MS = 24 * 3600 * 1000;

function isoDate(value: string | undefined, fallback: Date): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return fallback.toISOString().slice(0, 10);
}

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireSession(['admin']);
  const params = await searchParams;
  const now = new Date();
  const from = isoDate(params.from, new Date(now.getTime() - 30 * DAY_MS));
  const to = isoDate(params.to, now);
  // Report window is [from, to) by completion date, so the end date is included by adding one day.
  const toExclusive = new Date(new Date(`${to}T00:00:00Z`).getTime() + DAY_MS).toISOString();
  const fromIso = new Date(`${from}T00:00:00Z`).toISOString();

  const supabase = await createClient();
  const [rulesResult, reportResult, payableResult] = await Promise.all([
    supabase.from('commission_rules').select('id, name, rate_bps, dispute_window_hours, delivery_fee_commissionable, is_active, is_demo, created_at').order('created_at', { ascending: false }),
    supabase.rpc('commission_summary', { p_from: fromIso, p_to: toExclusive }),
    supabase
      .from('commissions')
      .select('id, commission_iqd, completed_at, payable_at, orders:order_id(order_number), businesses:supplier_business_id(name)')
      .eq('status', 'pending')
      .lte('payable_at', now.toISOString())
      .order('payable_at', { ascending: true })
      .limit(500),
  ]);

  const rules = (rulesResult.data ?? []) as Array<{ id: string; name: string; rate_bps: number; dispute_window_hours: number; delivery_fee_commissionable: boolean; is_active: boolean; is_demo: boolean; created_at: string }>;
  const active = rules.find((r) => r.is_active);
  const report = (reportResult.data ?? []) as Array<Record<string, number | string>>;
  const totals = report.reduce<Record<'orders' | 'eligible' | 'payable' | 'awaiting' | 'onHold' | 'paid', number>>(
    (acc, row) => ({
      orders: acc.orders + Number(row.orders_count),
      eligible: acc.eligible + Number(row.eligible_subtotal_iqd),
      payable: acc.payable + Number(row.payable_iqd),
      awaiting: acc.awaiting + Number(row.awaiting_window_iqd),
      onHold: acc.onHold + Number(row.on_hold_iqd),
      paid: acc.paid + Number(row.paid_iqd),
    }),
    { orders: 0, eligible: 0, payable: 0, awaiting: 0, onHold: 0, paid: 0 },
  );
  const payable = (payableResult.data ?? []) as unknown as Array<{ id: string; commission_iqd: number; payable_at: string; orders: { order_number: string } | null; businesses: { name: string } | null }>;

  return (
    <div className="space-y-10">
      <PageHeader
        title="العمولات"
        description="قواعد العمولة، وتقرير التسوية اليدوية. المنصة لا تحتفظ بأموال المشترين؛ التسديد يتم خارج النظام ويُوثَّق هنا."
      />

      {active?.is_demo ? (
        <Card className="border-amber-300 bg-amber-50/60">
          <p className="font-semibold text-warning">تنبيه: القاعدة النشطة تجريبية ({active.rate_bps / 100}%).</p>
          <p className="text-sm text-muted">أنشئ قاعدة بالنسبة المتفق عليها وفعّلها قبل بدء التشغيل الفعلي.</p>
        </Card>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-brand-900">القاعدة النشطة</h2>
        {active ? (
          <Card className="grid gap-4 sm:grid-cols-4">
            <Stat label="اسم القاعدة" value={<span className="text-base">{active.name}</span>} />
            <Stat label="النسبة" value={`${active.rate_bps / 100}%`} hint={`${active.rate_bps} نقطة أساس`} />
            <Stat label="نافذة الاعتراض" value={`${active.dispute_window_hours} ساعة`} />
            <Stat label="رسوم التوصيل" value={active.delivery_fee_commissionable ? 'ضمن العمولة' : 'مستثناة'} />
          </Card>
        ) : (
          <Card>
            <p className="text-danger">لا توجد قاعدة نشطة. لن تُنشأ عمولات للطلبات المكتملة حتى تفعّل قاعدة.</p>
          </Card>
        )}
        <details className="rounded-2xl border border-line bg-white p-5">
          <summary className="cursor-pointer font-semibold text-brand-800">إنشاء قاعدة جديدة</summary>
          <div className="mt-5">
            <CommissionRuleForm />
          </div>
        </details>
        <p className="text-xs text-muted">
          القواعد السابقة: {rules.length}. كل عمولة تحتفظ بنسبتها وقت الإنشاء، لذلك لا يغيّر تعديل لاحق القيم التاريخية.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-xl font-bold text-brand-900">تقرير التسوية حسب المورد</h2>
          <form className="flex flex-wrap items-end gap-3 text-sm" method="get">
            <label className="space-y-1">
              <span className="block text-muted">من</span>
              <input type="date" name="from" defaultValue={from} className="min-h-10 rounded-lg border border-line px-2" />
            </label>
            <label className="space-y-1">
              <span className="block text-muted">إلى</span>
              <input type="date" name="to" defaultValue={to} className="min-h-10 rounded-lg border border-line px-2" />
            </label>
            <button type="submit" className={buttonClass('secondary', 'min-h-10')}>
              عرض
            </button>
            <a href={`/admin/commissions/export?from=${from}&to=${to}`} className={buttonClass('primary', 'min-h-10')}>
              تصدير CSV
            </a>
          </form>
        </div>
        <p className="text-xs text-muted">حسب تاريخ اكتمال الطلب بتوقيت بغداد. {reportResult.error ? 'تعذر تحميل التقرير.' : ''}</p>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="طلبات" value={totals.orders} />
          <Stat label="مبيعات مؤهلة" value={formatIQD(totals.eligible)} />
          <Stat label="بانتظار النافذة" value={formatIQD(totals.awaiting)} />
          <Stat label="مستحقة" value={formatIQD(totals.payable)} />
          <Stat label="معلّقة (نزاع)" value={formatIQD(totals.onHold)} />
          <Stat label="مُسددة" value={formatIQD(totals.paid)} />
        </div>
        {report.length > 0 ? (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-brand-50 text-right">
                  <tr>
                    <th scope="col" className="px-4 py-3">المورد</th>
                    <th scope="col" className="px-4 py-3">طلبات</th>
                    <th scope="col" className="px-4 py-3">مبيعات مؤهلة</th>
                    <th scope="col" className="px-4 py-3">بانتظار النافذة</th>
                    <th scope="col" className="px-4 py-3">مستحقة</th>
                    <th scope="col" className="px-4 py-3">معلّقة</th>
                    <th scope="col" className="px-4 py-3">مُسددة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.map((row) => (
                    <tr key={String(row.supplier_business_id)}>
                      <td className="px-4 py-3 font-semibold">{String(row.supplier_name)}</td>
                      <td className="px-4 py-3 tabular">{String(row.orders_count)}</td>
                      <td className="px-4 py-3 tabular">{formatIQD(Number(row.eligible_subtotal_iqd))}</td>
                      <td className="px-4 py-3 tabular">{formatIQD(Number(row.awaiting_window_iqd))}</td>
                      <td className="px-4 py-3 tabular font-semibold">{formatIQD(Number(row.payable_iqd))}</td>
                      <td className="px-4 py-3 tabular">{formatIQD(Number(row.on_hold_iqd))}</td>
                      <td className="px-4 py-3 tabular">{formatIQD(Number(row.paid_iqd))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <p className="text-sm text-muted">لا توجد عمولات مكتملة في هذه الفترة.</p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-brand-900">عمولات مستحقة للتسديد</h2>
        <p className="text-sm text-muted">تظهر العمولة بعد انتهاء نافذة الاعتراض، ولا تُعلَّم مُسددة إلا بعد التحويل الفعلي.</p>
        <Card>
          <MarkPaidForm
            commissions={payable.map((c) => ({
              id: c.id,
              order_number: c.orders?.order_number ?? '',
              supplier: c.businesses?.name ?? '',
              commission_iqd: c.commission_iqd,
            }))}
          />
        </Card>
        {payable.length > 0 ? (
          <p className="text-xs text-muted">
            أقدم استحقاق: {formatDateTime(payable[0]!.payable_at)} ·{' '}
            <Link href="/admin/orders?status=completed" className="underline">
              الطلبات المكتملة
            </Link>
          </p>
        ) : null}
      </section>
      <p className="text-xs text-muted">آخر تحديث: {formatDate(now)}</p>
    </div>
  );
}
