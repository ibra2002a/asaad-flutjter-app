import { requirePortal } from '@/lib/session';
import { PortalNav } from '@/components/PortalNav';

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  await requirePortal('buyer');
  return (
    <>
      <PortalNav
        title="بوابة التاجر"
        links={[
          { href: '/buyer', label: 'الرئيسية' },
          { href: '/buyer/orders', label: 'طلباتي' },
          { href: '/buyer/profile', label: 'الملف التجاري والعناوين' },
          { href: '/products', label: 'تسوق الآن' },
        ]}
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">{children}</div>
    </>
  );
}
