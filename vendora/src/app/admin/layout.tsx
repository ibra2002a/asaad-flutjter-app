import Link from 'next/link';
import { requireSession } from '@/lib/auth';

/** Operations staff (ops) and administrators can enter this area. Admin-only pages check again. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(['ops', 'admin']);
  const isAdmin = session.viewer.role === 'admin';

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <nav aria-label="قائمة الإدارة" className="flex flex-wrap gap-2 text-sm font-semibold">
        <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-brand-50">لوحة التحكم</Link>
        <Link href="/admin/orders" className="rounded-lg px-3 py-2 hover:bg-brand-50">الطلبات</Link>
        <Link href="/admin/disputes" className="rounded-lg px-3 py-2 hover:bg-brand-50">النزاعات</Link>
        {isAdmin ? (
          <>
            <Link href="/admin/suppliers" className="rounded-lg px-3 py-2 hover:bg-brand-50">الموردون</Link>
            <Link href="/admin/users" className="rounded-lg px-3 py-2 hover:bg-brand-50">المستخدمون</Link>
            <Link href="/admin/categories" className="rounded-lg px-3 py-2 hover:bg-brand-50">الفئات</Link>
            <Link href="/admin/commissions" className="rounded-lg px-3 py-2 hover:bg-brand-50">العمولات</Link>
            <Link href="/admin/audit" className="rounded-lg px-3 py-2 hover:bg-brand-50">سجل التدقيق</Link>
          </>
        ) : null}
      </nav>
      {children}
    </div>
  );
}
