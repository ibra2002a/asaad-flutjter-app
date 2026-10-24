import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, PageHeader, Stat } from '@/components/ui/card';
import { buttonClass } from '@/components/ui/button-styles';
import { formatIQD } from '@/lib/format';

export const metadata: Metadata = { title: 'لوحة المورد' };

export default async function SupplierDashboard() {
  const session = await requireSession(['supplier']);
  const supabase = await createClient();

  const [productsCount, openOrdersCount, deliveredCount, recentOrders] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'accepted', 'preparing', 'out_for_delivery']),
    supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['delivered', 'completed', 'disputed']),
    supabase.from('orders').select('id, order_number, total_iqd, status, created_at').order('created_at', { ascending: false }).limit(5),
  ]);

  const approved = session.business?.status === 'approved';

  return (
    <div className="space-y-8">
      <PageHeader
        title={`أهلاً، ${session.viewer.fullName}`}
        description={session.business?.name}
        actions={
          approved ? (
            <Link href="/supplier/products/new" className={buttonClass('accent')}>
              إضافة منتج
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="عدد المنتجات" value={productsCount.count ?? 0} hint="منشورة ومسودات" />
        <Stat label="طلبات قيد التنفيذ" value={openOrdersCount.count ?? 0} hint="تحتاج متابعتك" />
        <Stat label="طلبات مُسلَّمة أو مكتملة" value={deliveredCount.count ?? 0} />
      </div>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-900">أحدث الطلبات</h2>
          <Link href="/supplier/orders" className="text-sm font-semibold text-brand-700 underline">
            عرض الكل
          </Link>
        </div>
        {(recentOrders.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">لا توجد طلبات واردة بعد.</p>
        ) : (
          <ul className="divide-y divide-line">
            {(recentOrders.data ?? []).map((o) => (
              <li key={o.id as string} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link href={`/supplier/orders/${o.id}`} className="font-mono text-sm font-semibold text-brand-900 hover:underline" dir="ltr">
                  {o.order_number as string}
                </Link>
                <span className="text-sm tabular">{formatIQD(o.total_iqd as number)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
