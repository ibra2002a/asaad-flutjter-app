import type { Metadata } from 'next';
import { ActionForm } from '@/components/ActionForm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrderDetail } from '@/lib/data/orders';
import { formatIqd } from '@/lib/domain/money';
import { canOpenDispute, allowedNextStatuses, ORDER_STATUS_LABEL_AR } from '@/lib/domain/order-status';
import { productUnitLabelsAr } from '@/lib/validation/schemas';
import { OrderTimeline } from '@/components/OrderTimeline';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { DisputeForm } from '@/components/forms/DisputeForm';
import { SubmitButton } from '@/components/SubmitButton';
import { QueryNotice } from '@/components/FormMessage';
import { Badge, Card, formatDateAr, PageHeader } from '@/components/ui';
import { cancelOrderAction, confirmReceiptAction } from '@/lib/actions/buyer';
import { getProfile } from '@/lib/session';

export const metadata: Metadata = { title: 'تفاصيل الطلب' };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ notice?: string; error?: string }>;

export default async function BuyerOrderDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const [detail, profile] = await Promise.all([getOrderDetail(id), getProfile()]);
  if (!detail || !profile) notFound();

  const { order, items, events, disputes } = detail;
  const actions = allowedNextStatuses(order.status, 'buyer');
  const canCancel = actions.includes('cancelled');
  const canConfirm = actions.includes('completed');
  const openDispute = disputes.find((d) => d.status === 'open');

  const itemRows = items.map((item) => ({
    id: item.id,
    name: item.product_name_snapshot,
    remaining: item.quantity - item.returned_quantity,
  }));

  return (
    <>
      <nav aria-label="مسار التنقل" className="mb-4 text-sm text-muted">
        <Link href="/buyer/orders" className="hover:text-brand-800">طلباتي</Link>
      </nav>
      <PageHeader
        title={order.order_number}
        description={`المورد: ${order.supplier?.legal_name ?? ''} · ${formatDateAr(order.created_at)}`}
        actions={<OrderStatusBadge status={order.status} />}
      />
      <div className="mb-6">
        <QueryNotice notice={query.notice} error={query.error} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <Card>
            <h2 className="mb-6 text-lg font-bold text-brand-950">تتبع الطلب</h2>
            <OrderTimeline status={order.status} events={events} />
          </Card>

          {disputes.length > 0 ? (
            <Card>
              <h2 className="mb-4 text-lg font-bold text-brand-950">النزاعات</h2>
              <ul className="space-y-4">
                {disputes.map((d) => (
                  <li key={d.id} className="rounded-xl border border-line p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={d.status === 'open' ? 'danger' : 'neutral'}>{d.status === 'open' ? 'مفتوح' : 'مغلق'}</Badge>
                      {d.resolution ? <Badge tone="brand">{d.resolution === 'partial_return' ? 'إرجاع جزئي' : d.resolution === 'refund_full' ? 'استرداد كامل' : 'بدون تعديل'}</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-800">{d.reason}</p>
                    {d.resolution_note ? <p className="mt-2 text-sm text-brand-800">قرار الإدارة: {d.resolution_note}</p> : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {!openDispute && canOpenDispute(order.status) ? (
            <DisputeForm orderId={order.id} items={itemRows} />
          ) : null}
        </div>

        <aside className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-bold text-brand-950">إجراءات</h2>
            <div className="space-y-4">
              {canConfirm ? (
                <ActionForm action={confirmReceiptAction} className="space-y-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <p className="text-sm text-slate-700">استلمت الطلب كاملا وبحالة جيدة؟ أكد الاستلام لإغلاق الطلب.</p>
                  <SubmitButton variant="accent" className="w-full">تأكيد الاستلام</SubmitButton>
                </ActionForm>
              ) : null}
              {canCancel ? (
                <ActionForm action={cancelOrderAction} className="space-y-2 border-t border-line pt-4">
                  <input type="hidden" name="orderId" value={order.id} />
                  <label htmlFor="cancel-reason" className="text-sm font-semibold text-brand-950">سبب الإلغاء (اختياري)</label>
                  <textarea id="cancel-reason" name="reason" maxLength={500} className="min-h-20 w-full rounded-xl border border-line p-3 text-sm" />
                  <SubmitButton variant="danger" className="w-full">إلغاء الطلب</SubmitButton>
                </ActionForm>
              ) : null}
              {!canCancel && !canConfirm && !openDispute && !canOpenDispute(order.status) ? (
                <p className="text-sm text-muted">لا توجد إجراءات متاحة لهذه المرحلة. يمكنك متابعة الطلب هنا حتى يتم تحديثه.</p>
              ) : null}
              {openDispute ? <p className="text-sm font-semibold text-red-700">هناك نزاع مفتوح على هذا الطلب. سيتم إشعارك عند الحل.</p> : null}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-bold text-brand-950">المنتجات</h2>
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-semibold text-brand-950">{item.product_name_snapshot}</span>
                    <span className="ltr-num block text-muted">
                      {item.quantity} {productUnitLabelsAr[item.unit_snapshot as keyof typeof productUnitLabelsAr] ?? item.unit_snapshot} × {formatIqd(Number(item.unit_price_iqd))}
                    </span>
                    {item.returned_quantity > 0 ? <span className="block text-xs font-semibold text-amber-800">أُرجع منه {item.returned_quantity}</span> : null}
                  </span>
                  <span className="ltr-num font-bold">{formatIqd(Number(item.line_total_iqd))}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">المجموع الفرعي</dt><dd className="ltr-num">{formatIqd(Number(order.subtotal_iqd))}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">رسوم التوصيل</dt><dd className="ltr-num">{formatIqd(Number(order.delivery_fee_iqd))}</dd></div>
              <div className="flex justify-between text-base"><dt className="font-bold">الإجمالي</dt><dd className="ltr-num font-black text-brand-900">{formatIqd(Number(order.total_iqd))}</dd></div>
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-bold text-brand-950">عنوان التوصيل</h2>
            <p className="text-sm text-slate-700">{order.delivery_address.label} — {order.delivery_address.district}</p>
            <p className="text-sm text-slate-700">{order.delivery_address.address_line}</p>
            <p className="ltr-num mt-1 text-xs text-muted">{order.delivery_address.phone}</p>
          </Card>
        </aside>
      </div>
      <p className="mt-8 text-xs text-muted">الحالة الحالية: {ORDER_STATUS_LABEL_AR[order.status]}</p>
    </>
  );
}
