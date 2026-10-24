import type { Metadata } from 'next';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMyBusiness, getProfile } from '@/lib/session';
import { canSellProducts } from '@/lib/domain/authz';
import { listOrdersFor } from '@/lib/data/orders';
import { formatIqd } from '@/lib/domain/money';
import { OrderStatusBadge, VerificationBadge } from '@/components/StatusBadge';
import { Alert, Card, EmptyState, PageHeader, buttonClass, formatDateAr } from '@/components/ui';

export const metadata: Metadata = { title: 'لوحة المورد' };

const ACTIONABLE = ['submitted', 'accepted', 'preparing', 'out_for_delivery'];

export default async function SupplierDashboard() {
  const [profile, business, orders] = await Promise.all([getProfile(), getMyBusiness(), listOrdersFor('supplier')]);
  const supabase = await createSupabaseServerClient();
  const { count: activeProducts } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active');
  const { count: reviewProducts } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'pending_review');
  const needsAction = orders.filter((o) => ACTIONABLE.includes(o.status)).length;
  const approved = canSellProducts(business ? { kind: business.kind, verificationStatus: business.verification_status } : null);

  return (
    <>
      <PageHeader
        eyebrow="مرحبا"
        title={profile?.full_name ?? 'لوحة المورد'}
        description={business?.legal_name}
        actions={business ? <VerificationBadge status={business.verification_status} /> : null}
      />

      {!approved ? (
        <div className="mb-8">
          <Alert tone="warning">
            حسابك بانتظار الاعتماد. بعد مراجعة الهوية التجارية ستتمكن من نشر المنتجات واستقبال الطلبات. <Link href="/supplier/onboarding" className="font-bold underline">تفاصيل الاعتماد</Link>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">طلبات تحتاج إجراء</p>
          <p className="ltr-num mt-2 text-3xl font-black text-brand-900">{needsAction}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">منتجات منشورة</p>
          <p className="ltr-num mt-2 text-3xl font-black text-brand-900">{activeProducts ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">منتجات قيد المراجعة</p>
          <p className="ltr-num mt-2 text-3xl font-black text-brand-900">{reviewProducts ?? 0}</p>
        </Card>
      </div>

      <section className="mt-10" aria-labelledby="incoming">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="incoming" className="text-lg font-bold text-brand-950">أحدث الطلبات الواردة</h2>
          <Link href="/supplier/orders" className="text-sm font-semibold text-brand-700 hover:underline">كل الطلبات</Link>
        </div>
        {orders.length === 0 ? (
          <EmptyState title="لا توجد طلبات واردة" description="ستظهر الطلبات هنا فور استلامها من التجار." action={<Link href="/supplier/products" className={buttonClass('primary')}>إدارة المنتجات</Link>} />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {orders.slice(0, 6).map((o) => (
              <li key={o.id}>
                <Link href={`/supplier/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-brand-50/50">
                  <div>
                    <p className="ltr-num font-bold text-brand-950">{o.order_number}</p>
                    <p className="text-sm text-muted">{o.counterparty} · {formatDateAr(o.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderStatusBadge status={o.status} />
                    <span className="ltr-num font-bold">{formatIqd(o.total_iqd)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
