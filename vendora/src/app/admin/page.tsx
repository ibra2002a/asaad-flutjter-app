import type { Metadata } from 'next';
import Link from 'next/link';
import { getAdminMetrics } from '@/lib/data/admin';
import { formatIqd } from '@/lib/domain/money';
import { ORDER_STATUSES, ORDER_STATUS_LABEL_AR } from '@/lib/domain/order-status';
import { Card, PageHeader, buttonClass } from '@/components/ui';

export const metadata: Metadata = { title: 'لوحة الإدارة' };
export const revalidate = 0;

function Metric({ label, value, href, tone }: { label: string; value: string | number; href?: string; tone?: 'default' | 'alert' }) {
  const body = (
    <Card className={`h-full transition ${href ? 'hover:-translate-y-0.5 hover:shadow-md' : ''}`}>
      <p className="text-sm text-muted">{label}</p>
      <p className={`ltr-num mt-2 text-2xl font-black ${tone === 'alert' ? 'text-amber-700' : 'text-brand-900'}`}>{value}</p>
    </Card>
  );
  return href ? <Link href={href} className="focus-visible:outline-none">{body}</Link> : body;
}

export default async function AdminDashboard() {
  const m = await getAdminMetrics();

  return (
    <>
      <PageHeader
        eyebrow="نظرة عامة"
        title="مؤشرات المنصة"
        description="أرقام محسوبة مباشرة من قاعدة البيانات."
        actions={<Link href="/admin/exports/orders" className={buttonClass('secondary')}>تصدير الطلبات CSV</Link>}
      />

      <h2 className="mb-3 text-sm font-bold text-brand-700">ما يحتاج إجراء</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="موردون بانتظار الاعتماد" value={m.pendingSuppliers} href="/admin/suppliers?status=pending" tone={m.pendingSuppliers > 0 ? 'alert' : 'default'} />
        <Metric label="منتجات بانتظار المراجعة" value={m.pendingProducts} href="/admin/products" tone={m.pendingProducts > 0 ? 'alert' : 'default'} />
        <Metric label="نزاعات مفتوحة" value={m.openDisputes} href="/admin/disputes" tone={m.openDisputes > 0 ? 'alert' : 'default'} />
        <Metric label="عمولة مستحقة غير مسوّاة" value={formatIqd(m.commissionAccrued)} href="/admin/commissions" />
      </div>

      <h2 className="mb-3 mt-10 text-sm font-bold text-brand-700">المنصة</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="موردون معتمدون" value={m.approvedSuppliers} href="/admin/suppliers?status=approved" />
        <Metric label="تجار نشطون" value={m.activeBuyers} href="/admin/buyers" />
        <Metric label="منتجات منشورة" value={m.activeProducts} href="/admin/products?status=active" />
        <Metric label="إجمالي الطلبات" value={m.ordersTotal} href="/admin/orders" />
        <Metric label="طلبات اليوم" value={m.ordersToday} />
        <Metric label="مبيعات مكتملة" value={formatIqd(m.grossCompletedSales)} />
        <Metric label="إجمالي المبيعات المحتسبة للعمولة" value={formatIqd(m.eligibleSales)} />
        <Metric label="عمولة مسوّاة" value={formatIqd(m.commissionSettled)} />
      </div>

      <section className="mt-10" aria-labelledby="by-status">
        <h2 id="by-status" className="mb-4 text-lg font-bold text-brand-950">الطلبات حسب الحالة</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {ORDER_STATUSES.map((status) => (
                <tr key={status}>
                  <td className="px-5 py-3 font-semibold text-brand-950">{ORDER_STATUS_LABEL_AR[status]}</td>
                  <td className="ltr-num px-5 py-3 text-end font-bold">{m.ordersByStatus[status] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </>
  );
}
