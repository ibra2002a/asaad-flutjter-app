import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import { BUSINESS_STATUS_LABELS } from '@/lib/labels';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/card';
import { SupplierDecisionButtons } from '@/components/admin/admin-controls';
import { BUSINESS_STATUSES } from '@/lib/types';

export const metadata: Metadata = { title: 'الموردون' };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireSession(['admin']);
  const { status } = await searchParams;
  const filter = (BUSINESS_STATUSES as readonly string[]).includes(status ?? '') ? status! : 'pending';

  const supabase = await createClient();
  const { data } = await supabase
    .from('businesses')
    .select('id, name, phone, city_code, status, created_at, reviewed_at, cities:city_code(name_ar)')
    .eq('kind', 'supplier')
    .eq('status', filter)
    .order('created_at', { ascending: true })
    .limit(200);
  const suppliers = (data ?? []) as unknown as Array<{
    id: string;
    name: string;
    phone: string;
    status: string;
    created_at: string;
    cities: { name_ar: string } | null;
  }>;

  return (
    <div className="space-y-6">
      <PageHeader title="الموردون" description="اعتماد الموردين قبل نشر منتجاتهم أو استقبال طلباتهم. كل قرار يُسجَّل في سجل التدقيق." />
      <nav aria-label="تصفية الحالة" className="flex flex-wrap gap-2 text-sm">
        {BUSINESS_STATUSES.map((s) => (
          <a
            key={s}
            href={`/admin/suppliers?status=${s}`}
            className={`rounded-full border px-3 py-1 ${filter === s ? 'border-brand-700 bg-brand-50 font-semibold' : 'border-line'}`}
          >
            {BUSINESS_STATUS_LABELS[s]}
          </a>
        ))}
      </nav>
      {suppliers.length === 0 ? (
        <EmptyState title="لا يوجد موردون في هذه الحالة" />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {suppliers.map((s) => (
            <li key={s.id}>
              <Card className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-brand-900">{s.name}</p>
                    <p className="text-sm text-muted" dir="ltr">
                      {s.phone} · {s.cities?.name_ar ?? ''} · سُجِّل {formatDate(s.created_at)}
                    </p>
                  </div>
                  <Badge tone={s.status === 'approved' ? 'success' : s.status === 'pending' ? 'warning' : 'danger'}>
                    {BUSINESS_STATUS_LABELS[s.status as keyof typeof BUSINESS_STATUS_LABELS]}
                  </Badge>
                </div>
                <SupplierDecisionButtons businessId={s.id} status={s.status} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
