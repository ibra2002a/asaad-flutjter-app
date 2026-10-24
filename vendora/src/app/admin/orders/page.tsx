import type { Metadata } from 'next';
import Link from 'next/link';
import { listOrdersFor } from '@/lib/data/orders';
import { formatIqd } from '@/lib/domain/money';
import { ORDER_STATUSES, ORDER_STATUS_LABEL_AR } from '@/lib/domain/order-status';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { Card, PageHeader, Select, buttonClass, formatDateAr, EmptyState } from '@/components/ui';

export const metadata: Metadata = { title: 'الطلبات' };

type SearchParams = Promise<{ status?: string }>;

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = (ORDER_STATUSES as readonly string[]).includes(params.status ?? '') ? params.status : undefined;
  const orders = await listOrdersFor('admin', status);

  return (
    <>
      <PageHeader
        title="كل الطلبات"
        description="عرض جميع الطلبات عبر المنصة (آخر 100 طلب)."
        actions={<Link href="/admin/exports/orders" className={buttonClass('secondary')}>تصدير CSV</Link>}
      />
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <label htmlFor="status" className="text-sm font-semibold text-brand-950">الحالة</label>
        <Select id="status" name="status" defaultValue={status ?? ''} className="max-w-xs">
          <option value="">كل الحالات</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL_AR[s]}</option>)}
        </Select>
        <button type="submit" className={buttonClass('secondary')}>تطبيق</button>
      </form>
      {orders.length === 0 ? (
        <EmptyState title="لا توجد طلبات" description="لا توجد طلبات تطابق هذا الفلتر." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-brand-50/70 text-brand-900">
              <tr>
                <th scope="col" className="px-5 py-3 text-start font-bold">الطلب</th>
                <th scope="col" className="px-5 py-3 text-start font-bold">التاجر</th>
                <th scope="col" className="px-5 py-3 text-start font-bold">التاريخ</th>
                <th scope="col" className="px-5 py-3 text-start font-bold">الحالة</th>
                <th scope="col" className="px-5 py-3 text-end font-bold">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-5 py-3"><span className="ltr-num font-bold text-brand-900">{o.order_number}</span></td>
                  <td className="px-5 py-3">{o.counterparty}</td>
                  <td className="px-5 py-3 text-muted">{formatDateAr(o.created_at)}</td>
                  <td className="px-5 py-3"><OrderStatusBadge status={o.status} /></td>
                  <td className="ltr-num px-5 py-3 text-end font-bold">{formatIqd(o.total_iqd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
