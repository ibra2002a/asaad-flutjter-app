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

export const metadata: Metadata = { title: 'تفاصيل الطلب الوارد' };

export default async function SupplierOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(['supplier']);
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();

  // RLS limits this to orders assigned to this supplier.
  const detail = await loadOrderDetail(id);
  if (!detail) notFound();
  const { order } = detail;

  return (
    <div className="space-y-6">
      <nav aria-label="مسار التنقل" className="text-sm text-muted">
        <Link href="/supplier/orders" className="hover:text-brand-700">الطلبات الواردة</Link>
        <span className="mx-2">/</span>
        <span>{order.order_number}</span>
      </nav>
      <PageHeader title={`الطلب ${order.order_number}`} description={`الحالة الحالية: ${ORDER_STATUS_LABELS[order.status]}`} />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <OrderSummary detail={detail} showCounterparty="supplier" />
        <aside className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-lg font-bold text-brand-900">تحديث الحالة</h2>
            {order.status === 'disputed' ? (
              <p className="text-sm text-muted">الطلب تحت النزاع. سيحدّث فريق العمليات الحالة.</p>
            ) : (
              <OrderStatusActions orderId={order.id} role={session.viewer.role} status={order.status} />
            )}
            {order.status === 'completed' ? <p className="text-sm text-muted">اكتمل الطلب.</p> : null}
          </Card>
          <OrderTimeline detail={detail} />
        </aside>
      </div>
    </div>
  );
}
