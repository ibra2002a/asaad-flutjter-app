import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { Notice } from '@/components/ui/card';
import { BUSINESS_STATUS_LABELS } from '@/lib/labels';

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(['supplier']);
  const status = session.business?.status ?? 'pending';

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      {status === 'approved' ? null : (
        <Notice tone={status === 'pending' ? 'warning' : 'error'}>
          حالة النشاط: <strong>{BUSINESS_STATUS_LABELS[status]}</strong>.{' '}
          {status === 'pending'
            ? 'حسابك قيد المراجعة. يمكنك إعداد المنتجات كمسودات، ولن تُنشر ولن تستقبل طلبات قبل الاعتماد.'
            : 'تواصل مع فريق VENDORA لمعرفة التفاصيل.'}
        </Notice>
      )}
      <nav aria-label="قائمة المورد" className="flex flex-wrap gap-2 text-sm font-semibold">
        <Link href="/supplier" className="rounded-lg px-3 py-2 hover:bg-brand-50">لوحة المورد</Link>
        <Link href="/supplier/products" className="rounded-lg px-3 py-2 hover:bg-brand-50">المنتجات</Link>
        <Link href="/supplier/orders" className="rounded-lg px-3 py-2 hover:bg-brand-50">الطلبات الواردة</Link>
        <Link href="/supplier/profile" className="rounded-lg px-3 py-2 hover:bg-brand-50">ملف النشاط والتغطية</Link>
      </nav>
      {children}
    </div>
  );
}
