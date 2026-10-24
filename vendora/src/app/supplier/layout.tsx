import { requirePortal } from '@/lib/session';
import { PortalNav } from '@/components/PortalNav';

export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  await requirePortal('supplier');
  return (
    <>
      <PortalNav
        title="بوابة المورد"
        links={[
          { href: '/supplier', label: 'الرئيسية' },
          { href: '/supplier/products', label: 'المنتجات' },
          { href: '/supplier/orders', label: 'الطلبات الواردة' },
          { href: '/supplier/reports', label: 'التقارير والعمولة' },
          { href: '/supplier/profile', label: 'الملف التجاري' },
        ]}
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">{children}</div>
    </>
  );
}
