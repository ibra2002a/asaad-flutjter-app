import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime, formatIQD } from '@/lib/format';
import { ORDER_STATUS_LABELS } from '@/lib/orders/rules';
import { Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui/card';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'الطلبات الواردة' };

export default async function SupplierOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireSession(['supplier']);
  const { status } = await searchParams;
  const filter = (ORDER_STATUSES as readonly string[]).includes(status ?? '') ? (status as OrderStatus) : null;

  const supabase = await createClient();
  let query = supabase
    .from('orders')
    .select('id, order_number, status, total_iqd, created_at, delivery_city_code, cities:delivery_city_code(name_ar)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (filter) query = query.eq('status', filter);
  const { data } = await query;
  const orders = (data ?? []) as unknown as Array<{ id: string; order_number: string; status: OrderStatus; total_iqd: number; created_at: string; cities: { name_ar: string } | null }>;

  return (
    <div className="space-y-6">
      <PageHeader title="الطلبات الواردة" description="الطلبات المسندة إليك فقط. غيّر الحالة عند كل مرحلة." />
      <nav aria-label="تصفية الحالات" className="flex flex-wrap gap-2 text-sm">
        <Link href="/supplier/orders" className={`rounded-full border px-3 py-1 ${!filter ? 'border-brand-700 bg-brand-50 font-semibold' : 'border-line'}`}>
          الكل
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/supplier/orders?status=${s}`}
            className={`rounded-full border px-3 py-1 ${filter === s ? 'border-brand-700 bg-brand-50 font-semibold' : 'border-line'}`}
          >
            {ORDER_STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <EmptyState title="لا توجد طلبات" description="ستظهر هنا الطلبات التي يرسلها المشترون إليك." />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/supplier/orders/${o.id}`}>
                <Card className="flex flex-col gap-2 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono font-semibold text-brand-900" dir="ltr">{o.order_number}</p>
                    <p className="text-sm text-muted">
                      {o.cities?.name_ar ?? ''} · {formatDateTime(o.created_at)}
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
