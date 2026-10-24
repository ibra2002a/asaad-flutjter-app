import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { loadOrderDetail } from '@/lib/orders/load';
import { OrderSummary, OrderTimeline } from '@/components/orders/order-view';
import { OrderStatusActions } from '@/components/orders/order-actions';
import { Card, PageHeader } from '@/components/ui/card';
import { ORDER_STATUS_LABELS } from '@/lib/orders/rules';
import { UUID_REGEX } from '@/lib/validation';

export const metadata: Metadata = { title: 'تفاصيل الطلب' };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(['ops', 'admin']);
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();
  const detail = await loadOrderDetail(id);
  if (!detail) notFound();
  const { order, disputes } = detail;
  const open = disputes.find((d) => d.status === 'open');

  return (
    <div className="space-y-6">
      <nav aria-label="مسار التنقل" className="text-sm text-muted">
        <Link href="/admin/orders" className="hover:text-brand-700">الطلبات</Link>
        <span className="mx-2">/</span>
        <span>{order.order_number}</span>
      </nav>
      <PageHeader title={`الطلب ${order.order_number}`} description={`الحالة الحالية: ${ORDER_STATUS_LABELS[order.status]}`} />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <OrderSummary detail={detail} showCounterparty="staff" />
          {open ? (
            <Card className="space-y-2 border-amber-300">
              <h2 className="font-bold text-warning">نزاع مفتوح</h2>
              <p className="whitespace-pre-line text-sm">{open.reason}</p>
              <Link href="/admin/disputes" className="text-sm font-semibold text-brand-700 underline">انتقل إلى صفحة النزاعات للبت فيه</Link>
            </Card>
          ) : null}
        </div>
        <aside className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-lg font-bold text-brand-900">إجراءات الدعم</h2>
            <p className="text-xs text-muted">الإلغاء والإكمال يتطلبان ملاحظة. الإجراءات المتاحة تتبع مصفوفة الحالات المعتمدة.</p>
            {order.status === 'disputed' ? (
              <p className="text-sm text-muted">الطلب تحت النزاع. استخدم صفحة النزاعات لإغلاقه.</p>
            ) : (
              <OrderStatusActions orderId={order.id} role={session.viewer.role} status={order.status} />
            )}
          </Card>
          <OrderTimeline detail={detail} />
        </aside>
      </div>
    </div>
  );
}
