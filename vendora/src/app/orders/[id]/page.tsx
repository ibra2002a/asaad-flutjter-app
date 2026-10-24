import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { loadOrderDetail } from '@/lib/orders/load';
import { ORDER_STATUS_LABELS } from '@/lib/orders/rules';
import { OrderSummary, OrderTimeline } from '@/components/orders/order-view';
import { OpenDisputeForm, OrderStatusActions } from '@/components/orders/order-actions';
import { Card, Notice, PageHeader } from '@/components/ui/card';
import { UUID_REGEX } from '@/lib/validation';
import { formatDateTime } from '@/lib/format';
import { buttonClass } from '@/components/ui/button-styles';

export const metadata: Metadata = { title: 'تفاصيل الطلب' };

export default async function BuyerOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const session = await requireSession(['buyer']);
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();
  const { placed } = await searchParams;

  const detail = await loadOrderDetail(id);
  if (!detail) notFound();
  const { order, disputes } = detail;
  const openDispute = disputes.find((d) => d.status === 'open');
  const completedAt = order.completed_at ? new Date(order.completed_at) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <nav aria-label="مسار التنقل" className="text-sm text-muted">
        <Link href="/orders" className="hover:text-brand-700">طلباتي</Link>
        <span className="mx-2">/</span>
        <span>{order.order_number}</span>
      </nav>
      <PageHeader title={`الطلب ${order.order_number}`} description={`الحالة الحالية: ${ORDER_STATUS_LABELS[order.status]}`} />

      {placed === '1' ? <Notice tone="success">تم إرسال طلبك بنجاح. سيؤكده المورد قريباً.</Notice> : null}
      {openDispute ? <Notice tone="warning">يوجد نزاع مفتوح على هذا الطلب. سيراجعه فريق VENDORA.</Notice> : null}
      {order.status === 'completed' && completedAt ? (
        <Notice tone="info">
          اكتمل الطلب في {formatDateTime(completedAt)}. يمكنك فتح نزاع خلال مدة الاعتراض المحددة من الإدارة.
        </Notice>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <OrderSummary detail={detail} showCounterparty="buyer" />
          {disputes.length > 0 ? (
            <Card className="space-y-3">
              <h2 className="text-lg font-bold text-brand-900">النزاعات</h2>
              {disputes.map((d) => (
                <div key={d.id} className="rounded-lg border border-line p-4 text-sm">
                  <p className="font-semibold">{d.status === 'open' ? 'مفتوح' : d.status === 'resolved_completed' ? 'مغلق: الطلب مستمر' : 'مغلق: تم إلغاء الطلب'}</p>
                  <p className="mt-1 whitespace-pre-line text-muted">{d.reason}</p>
                  {d.resolution_note ? <p className="mt-2"><span className="font-semibold">قرار الفريق:</span> {d.resolution_note}</p> : null}
                </div>
              ))}
            </Card>
          ) : null}
        </div>

        <aside className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-lg font-bold text-brand-900">إجراءات</h2>
            <OrderStatusActions orderId={order.id} role={session.viewer.role} status={order.status} />
            {!openDispute && (order.status === 'delivered' || order.status === 'completed') ? (
              <OpenDisputeForm orderId={order.id} role="buyer" status={order.status} />
            ) : null}
            {order.status === 'disputed' ? (
              <p className="text-sm text-muted">الطلب قيد المراجعة من فريق العمليات.</p>
            ) : null}
            <Link href="/products" className={buttonClass('ghost', 'w-full')}>
              متابعة التسوق
            </Link>
          </Card>
          <OrderTimeline detail={detail} />
        </aside>
      </div>
    </div>
  );
}
