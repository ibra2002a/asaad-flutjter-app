import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatIQD } from '@/lib/format';
import { PageHeader, Stat } from '@/components/ui/card';
import { daysAgoIso } from '@/lib/time';

export const metadata: Metadata = { title: 'لوحة التحكم' };

export default async function AdminDashboard() {
  const session = await requireSession(['ops', 'admin']);
  const supabase = await createClient();
  const since = await daysAgoIso(7);

  const [pendingSuppliers, openDisputes, recentOrders, openOrders] = await Promise.all([
    supabase.from('businesses').select('id', { count: 'exact', head: true }).eq('kind', 'supplier').eq('status', 'pending'),
    supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('orders').select('total_iqd').gte('created_at', since),
    supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'accepted', 'preparing', 'out_for_delivery', 'delivered']),
  ]);
  const recentRows = recentOrders.data ?? [];
  const recentTotal = recentRows.reduce((sum, r) => sum + Number(r.total_iqd), 0);

  return (
    <div className="space-y-8">
      <PageHeader title="لوحة التحكم" description={`مرحباً ${session.viewer.fullName}. ملخص العمليات اليوم.`} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="موردون بانتظار الاعتماد" value={pendingSuppliers.count ?? 0} />
        <Stat label="نزاعات مفتوحة" value={openDisputes.count ?? 0} />
        <Stat label="طلبات نشطة" value={openOrders.count ?? 0} hint="لم تكتمل بعد" />
        <Stat label="طلبات آخر 7 أيام" value={recentRows.length} hint={formatIQD(recentTotal)} />
      </div>
    </div>
  );
}
