import { requirePortal } from '@/lib/session';
import { PortalNav } from '@/components/PortalNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePortal('admin');
  return (
    <>
      <PortalNav
        title="لوحة الإدارة"
        links={[
          { href: '/admin', label: 'المؤشرات' },
          { href: '/admin/suppliers', label: 'الموردون' },
          { href: '/admin/buyers', label: 'التجار' },
          { href: '/admin/products', label: 'مراجعة المنتجات' },
          { href: '/admin/orders', label: 'الطلبات' },
          { href: '/admin/disputes', label: 'النزاعات' },
          { href: '/admin/commissions', label: 'العمولات' },
          { href: '/admin/categories', label: 'الفئات' },
          { href: '/admin/audit', label: 'سجل التدقيق' },
        ]}
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">{children}</div>
    </>
  );
}
