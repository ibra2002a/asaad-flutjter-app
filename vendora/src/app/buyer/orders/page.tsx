import type { Metadata } from 'next';
import Link from 'next/link';
import { listOrdersFor } from '@/lib/data/orders';
import { formatIqd } from '@/lib/domain/money';
import { ORDER_STATUSES, ORDER_STATUS_LABEL_AR } from '@/lib/domain/order-status';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { Card, EmptyState, PageHeader, buttonClass, formatDateAr, Select, Alert } from '@/components/ui';

export const metadata: Metadata = { title: 'طلباتي' };

type SearchParams = Promise<{ status?: string; notice?: string }>;

export default async function BuyerOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = (ORDER_STATUSES as readonly string[]).includes(params.status ?? '') ? params.status : undefined;
  const orders = await listOrdersFor('buyer', status);

  return (
    <>
      <PageHeader title="طلباتي" description="تابع حالة كل طلب من التجهيز حتى الاستلام." />
      {params.notice === 'placed' ? <div className="mb-6"><Alert tone="success">تم تأكيد طلبك بنجاح.</Alert></div> : null}

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <label htmlFor="status" className="text-sm font-semibold text-brand-950">فلترة حسب الحالة</label>
        <Select id="status" name="status" defaultValue={status ?? ''} className="max-w-xs">
          <option value="">كل الحالات</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{ORDER_STATUS_LABEL_AR[s]}</option>
          ))}
        </Select>
        <button type="submit" className={buttonClass('secondary')}>تطبيق</button>
      </form>

      {orders.length === 0 ? (
        <EmptyState title="لا توجد طلبات" description="عند تأكيد أول طلب ستجده هنا مع تتبع كامل لحالته." action={<Link href="/products" className={buttonClass('primary')}>تصفح المنتجات</Link>} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-brand-50/70 text-start text-brand-900">
              <tr>
                <th scope="col" className="px-5 py-3 text-start font-bold">رقم الطلب</th>
                <th scope="col" className="px-5 py-3 text-start font-bold">المورد</th>
                <th scope="col" className="px-5 py-3 text-start font-bold">التاريخ</th>
                <th scope="col" className="px-5 py-3 text-start font-bold">الحالة</th>
                <th scope="col" className="px-5 py-3 text-end font-bold">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-brand-50/40">
                  <td className="px-5 py-4"><Link href={`/buyer/orders/${o.id}`} className="ltr-num font-bold text-brand-800 hover:underline">{o.order_number}</Link></td>
                  <td className="px-5 py-4">{o.counterparty}</td>
                  <td className="px-5 py-4 text-muted">{formatDateAr(o.created_at)}</td>
                  <td className="px-5 py-4"><OrderStatusBadge status={o.status} /></td>
                  <td className="ltr-num px-5 py-4 text-end font-bold">{formatIqd(o.total_iqd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
