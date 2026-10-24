import type { Metadata } from 'next';
import Link from 'next/link';
import { getProfile, getMyBusiness } from '@/lib/session';
import { listOrdersFor } from '@/lib/data/orders';
import { formatIqd } from '@/lib/domain/money';
import { OrderStatusBadge } from '@/components/StatusBadge';
import { buttonClass, Card, EmptyState, formatDateAr, PageHeader, Alert } from '@/components/ui';

export const metadata: Metadata = { title: 'لوحة التاجر' };

export default async function BuyerDashboard() {
  const [profile, business, orders] = await Promise.all([getProfile(), getMyBusiness(), listOrdersFor('buyer')]);
  const open = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  const spend = orders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + o.total_iqd, 0);

  return (
    <>
      <PageHeader eyebrow="مرحبا" title={profile?.full_name ?? 'لوحة التاجر'} description={business?.legal_name} actions={<Link href="/products" className={buttonClass('accent')}>طلب جديد</Link>} />
      {business?.verification_status === 'pending' ? <div className="mb-6"><Alert tone="warning">حسابك قيد المراجعة. ستتمكن من الطلب بعد اعتماده.</Alert></div> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-muted">طلبات قيد التنفيذ</p><p className="ltr-num mt-2 text-3xl font-black text-brand-900">{open.length}</p></Card>
        <Card><p className="text-sm text-muted">طلبات مكتملة</p><p className="ltr-num mt-2 text-3xl font-black text-brand-900">{orders.filter((o) => o.status === 'completed').length}</p></Card>
        <Card><p className="text-sm text-muted">إجمالي المشتريات المكتملة</p><p className="ltr-num mt-2 text-2xl font-black text-brand-900">{formatIqd(spend)}</p></Card>
      </div>

      <section className="mt-10" aria-labelledby="recent">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="recent" className="text-lg font-bold text-brand-950">أحدث الطلبات</h2>
          <Link href="/buyer/orders" className="text-sm font-semibold text-brand-700 hover:underline">كل الطلبات</Link>
        </div>
        {orders.length === 0 ? (
          <EmptyState title="لم تقم بأي طلب بعد" description="ابدأ بتصفح الكتالوج واختر منتجات من موردين معتمدين." action={<Link href="/products" className={buttonClass('primary')}>تصفح المنتجات</Link>} />
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {orders.slice(0, 5).map((o) => (
              <li key={o.id}>
                <Link href={`/buyer/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-brand-50/50">
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
