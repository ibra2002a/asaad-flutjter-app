import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/format';
import { Card, EmptyState, PageHeader } from '@/components/ui/card';
import { ResolveDisputeForm } from '@/components/orders/order-actions';

export const metadata: Metadata = { title: 'النزاعات' };

export default async function DisputesPage() {
  await requireSession(['ops', 'admin']);
  const supabase = await createClient();
  const { data } = await supabase
    .from('disputes')
    .select('id, reason, status, created_at, resolution_note, resolved_at, order_id, orders:order_id(order_number, status)')
    .order('created_at', { ascending: false })
    .limit(100);
  const disputes = (data ?? []) as unknown as Array<{
    id: string;
    reason: string;
    status: 'open' | 'resolved_completed' | 'resolved_cancelled';
    created_at: string;
    resolution_note: string | null;
    resolved_at: string | null;
    order_id: string;
    orders: { order_number: string; status: string } | null;
  }>;

  return (
    <div className="space-y-6">
      <PageHeader title="النزاعات" description="راجع السبب والطلب ثم سجّل القرار بملاحظة. القرار يُسجَّل في سجل الطلب." />
      {disputes.length === 0 ? (
        <EmptyState title="لا توجد نزاعات" />
      ) : (
        <ul className="space-y-4">
          {disputes.map((d) => (
            <li key={d.id}>
              <Card className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/admin/orders/${d.order_id}`} className="font-mono font-semibold text-brand-900 underline" dir="ltr">
                    {d.orders?.order_number}
                  </Link>
                  <span className="text-sm text-muted">{formatDateTime(d.created_at)}</span>
                </div>
                <p className="whitespace-pre-line">{d.reason}</p>
                {d.status === 'open' ? (
                  <ResolveDisputeForm disputeId={d.id} />
                ) : (
                  <p className="text-sm">
                    <span className="font-semibold">{d.status === 'resolved_completed' ? 'تم الإبقاء على الطلب.' : 'تم إلغاء الطلب.'}</span>{' '}
                    {d.resolution_note}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
