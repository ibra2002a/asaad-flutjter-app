import type { Metadata } from 'next';
import { ActionForm } from '@/components/ActionForm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrderDetail } from '@/lib/data/orders';
import { formatIqd } from '@/lib/domain/money';
import { allowedNextStatuses, ORDER_STATUS_LABEL_AR, type OrderStatus } from '@/lib/domain/order-status';
import { getProfile } from '@/lib/session';
import { supplierTransitionAction } from '@/lib/actions/supplier';
import { OrderTimeline } from '@/components/OrderTimeline';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { SubmitButton } from '@/components/SubmitButton';
import { QueryNotice } from '@/components/FormMessage';
import { Card, PageHeader, formatDateAr, Textarea } from '@/components/ui';

export const metadata: Metadata = { title: 'تفاصيل الطلب الوارد' };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ notice?: string; error?: string }>;

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  accepted: 'قبول الطلب',
  preparing: 'بدء التجهيز',
  out_for_delivery: 'بدء التوصيل (في الطريق)',
  delivered: 'تأكيد التسليم للتاجر',
};

export default async function SupplierOrderDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const [detail, profile] = await Promise.all([getOrderDetail(id), getProfile()]);
  if (!detail || !profile) notFound();

  const { order, items, events } = detail;
  const next = allowedNextStatuses(order.status, 'supplier');
  const canReject = next.includes('cancelled');
  const advance = next.filter((s) => s !== 'cancelled');

  return (
    <>
      <nav className="mb-4 text-sm text-muted">
        <Link href="/supplier/orders" className="hover:text-brand-800">الطلبات الواردة</Link>
      </nav>
      <PageHeader
        title={order.order_number}
        description={`التاجر: ${order.buyer?.legal_name ?? ''} · ${formatDateAr(order.created_at)}`}
        actions={<OrderStatusBadge status={order.status} />}
      />
      <div className="mb-6"><QueryNotice notice={query.notice} error={query.error} /></div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <Card>
            <h2 className="mb-6 text-lg font-bold text-brand-950">مراحل الطلب</h2>
            <OrderTimeline status={order.status} events={events} />
          </Card>

          <Card className="p-0">
            <div className="border-b border-line px-5 py-4"><h2 className="font-bold text-brand-950">المنتجات المطلوبة</h2></div>
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="font-semibold text-brand-950">{item.product_name_snapshot}</p>
                    <p className="ltr-num text-sm text-muted">{item.quantity} × {formatIqd(Number(item.unit_price_iqd))} / {item.unit_snapshot}</p>
                    {item.returned_quantity > 0 ? <p className="text-xs font-semibold text-amber-800">أُرجع منه {item.returned_quantity}</p> : null}
                  </div>
                  <p className="ltr-num font-bold">{formatIqd(Number(item.line_total_iqd))}</p>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-line px-5 py-4 text-base">
              <span className="font-bold">إجمالي الطلب</span>
              <span className="ltr-num font-black text-brand-900">{formatIqd(Number(order.total_iqd))}</span>
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-bold text-brand-950">إجراءات الطلب</h2>
            {advance.length === 0 && !canReject ? (
              <p className="text-sm text-muted">لا توجد إجراءات متاحة. الحالة الحالية: {ORDER_STATUS_LABEL_AR[order.status]}.</p>
            ) : (
              <div className="space-y-3">
                {advance.map((to) => (
                  <ActionForm key={to} action={supplierTransitionAction}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="to" value={to} />
                    <SubmitButton variant={to === 'accepted' ? 'accent' : 'primary'} className="w-full">
                      {NEXT_LABEL[to] ?? ORDER_STATUS_LABEL_AR[to]}
                    </SubmitButton>
                  </ActionForm>
                ))}
                {canReject ? (
                  <ActionForm action={supplierTransitionAction} className="space-y-2 border-t border-line pt-4">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="to" value="cancelled" />
                    <label htmlFor="reject-reason" className="text-sm font-semibold text-brand-950">سبب الرفض (مطلوب)</label>
                    <Textarea id="reject-reason" name="reason" required minLength={3} maxLength={500} className="min-h-20" />
                    <SubmitButton variant="danger" className="w-full">رفض الطلب</SubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-bold text-brand-950">بيانات التسليم</h2>
            <p className="text-sm font-semibold text-brand-950">{order.delivery_address.label}</p>
            <p className="text-sm text-slate-700">{order.delivery_address.district} — {order.delivery_address.address_line}</p>
            <p className="ltr-num mt-2 text-sm text-muted">{order.delivery_address.phone}</p>
            <p className="mt-3 text-xs text-muted">هاتف التاجر: <span className="ltr-num">{order.buyer?.phone}</span></p>
          </Card>
        </aside>
      </div>
    </>
  );
}
