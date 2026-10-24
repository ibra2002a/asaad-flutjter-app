import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime, formatIQD } from '@/lib/format';
import { ORDER_STATUS_LABELS } from '@/lib/orders/rules';
import { Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui/card';
import { buttonClass } from '@/components/ui/button-styles';
import type { OrderRow } from '@/lib/types';

export const metadata: Metadata = { title: 'طلباتي' };

export default async function BuyerOrdersPage() {
  await requireSession(['buyer']);
  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, status, total_iqd, created_at, supplier_business_id')
    .order('created_at', { ascending: false })
    .limit(100);
  const orders = (data ?? []) as Pick<OrderRow, 'id' | 'order_number' | 'status' | 'total_iqd' | 'created_at' | 'supplier_business_id'>[];

  const supplierIds = [...new Set(orders.map((o) => o.supplier_business_id))];
  const { data: suppliers } = supplierIds.length
    ? await supabase.from('businesses').select('id, name').in('id', supplierIds)
    : { data: [] as { id: string; name: string }[] };
  const names = new Map((suppliers ?? []).map((s) => [s.id as string, s.name as string]));

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <PageHeader title="طلباتي" description="تابع حالة كل طلب من الإرسال حتى التسليم." />
      {orders.length === 0 ? (
        <EmptyState
          title="لا توجد طلبات بعد"
          description="ابدأ بتصفح المنتجات وإرسال أول طلب."
          action={
            <Link href="/products" className={buttonClass('primary')}>
              تصفح المنتجات
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id}>
              <Link href={`/orders/${order.id}`} className="block">
                <Card className="flex flex-col gap-3 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-mono text-sm font-semibold text-brand-900" dir="ltr">
                      {order.order_number}
                    </p>
                    <p className="text-sm text-muted">
                      {names.get(order.supplier_business_id) ?? 'مورد'} · {formatDateTime(order.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 sm:justify-end">
                    <span className="font-bold tabular">{formatIQD(order.total_iqd)}</span>
                    <StatusBadge status={order.status} label={ORDER_STATUS_LABELS[order.status]} />
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
