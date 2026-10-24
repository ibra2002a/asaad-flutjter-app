import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime, formatIQD } from '@/lib/format';
import { ORDER_STATUS_LABELS } from '@/lib/orders/rules';
import { Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui/card';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'الطلبات' };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireSession(['ops', 'admin']);
  const { status } = await searchParams;
  const filter = (ORDER_STATUSES as readonly string[]).includes(status ?? '') ? (status as OrderStatus) : null;

  const supabase = await createClient();
  let query = supabase.from('orders').select('id, order_number, status, total_iqd, created_at, supplier_business_id, buyer_business_id').order('created_at', { ascending: false }).limit(100);
  if (filter) query = query.eq('status', filter);
  const { data } = await query;
  const orders = (data ?? []) as Array<{ id: string; order_number: string; status: OrderStatus; total_iqd: number; created_at: string; supplier_business_id: string; buyer_business_id: string }>;

  const ids = [...new Set(orders.flatMap((o) => [o.supplier_business_id, o.buyer_business_id]))];
  const { data: businesses } = ids.length ? await supabase.from('businesses').select('id, name').in('id', ids) : { data: [] as { id: string; name: string }[] };
  const names = new Map((businesses ?? []).map((b) => [b.id as string, b.name as string]));

  return (
    <div className="space-y-6">
      <PageHeader title="الطلبات" description="متابعة كل الطلبات ودعم العمليات. كل تغيير في الحالة يُسجَّل بالمنفِّذ والوقت." />
      <nav aria-label="تصفية الحالات" className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/orders" className={`rounded-full border px-3 py-1 ${!filter ? 'border-brand-700 bg-brand-50 font-semibold' : 'border-line'}`}>الكل</Link>
        {ORDER_STATUSES.map((s) => (
          <Link key={s} href={`/admin/orders?status=${s}`} className={`rounded-full border px-3 py-1 ${filter === s ? 'border-brand-700 bg-brand-50 font-semibold' : 'border-line'}`}>
            {ORDER_STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <EmptyState title="لا توجد طلبات" />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/orders/${o.id}`}>
                <Card className="flex flex-col gap-2 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono font-semibold text-brand-900" dir="ltr">{o.order_number}</p>
                    <p className="text-sm text-muted">
                      {names.get(o.buyer_business_id)} ← {names.get(o.supplier_business_id)} · {formatDateTime(o.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold tabular">{formatIQD(o.total_iqd)}</span>
                    <StatusBadge status={o.status} label={ORDER_STATUS_LABELS[o.status]} />
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
