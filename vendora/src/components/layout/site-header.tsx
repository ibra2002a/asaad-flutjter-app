import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/labels';
import type { Role } from '@/lib/types';
import { signOutAction } from '@/actions/auth';
import { CartBadge } from '@/components/cart/cart-badge';
import { buttonClass } from '@/components/ui/button-styles';

type NavItem = { href: string; label: string };

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  buyer: [
    { href: '/products', label: 'المنتجات' },
    { href: '/orders', label: 'طلباتي' },
    { href: '/account', label: 'حسابي' },
  ],
  supplier: [
    { href: '/supplier', label: 'لوحة المورد' },
    { href: '/supplier/products', label: 'منتجاتي' },
    { href: '/supplier/orders', label: 'الطلبات الواردة' },
    { href: '/supplier/profile', label: 'ملف النشاط' },
  ],
  ops: [
    { href: '/admin', label: 'لوحة العمليات' },
    { href: '/admin/orders', label: 'الطلبات' },
    { href: '/admin/disputes', label: 'النزاعات' },
  ],
  admin: [
    { href: '/admin', label: 'لوحة الإدارة' },
    { href: '/admin/orders', label: 'الطلبات' },
    { href: '/admin/disputes', label: 'النزاعات' },
    { href: '/admin/suppliers', label: 'الموردون' },
    { href: '/admin/users', label: 'المستخدمون' },
    { href: '/admin/categories', label: 'الفئات' },
    { href: '/admin/commissions', label: 'العمولات' },
    { href: '/admin/audit', label: 'سجل التدقيق' },
  ],
};

const GUEST_NAV: NavItem[] = [{ href: '/products', label: 'المنتجات' }];

export async function SiteHeader() {
  const session = await getSession();
  const role = session?.viewer.role;
  const items = role ? NAV_BY_ROLE[role] : GUEST_NAV;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href={role ? (role === 'supplier' ? '/supplier' : role === 'ops' || role === 'admin' ? '/admin' : '/products') : '/'} className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-brand-800 text-lg font-black text-lime-400" aria-hidden="true">
            V
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-black tracking-wide text-brand-900">VENDORA</span>
            <span className="hidden text-xs text-muted sm:block">Trade Smarter. Grow Faster.</span>
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav aria-label="القائمة الرئيسية" className="hidden items-center gap-1 lg:flex">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {role === 'buyer' ? <CartBadge /> : null}

          {/* Desktop: account actions inline */}
          <div className="hidden items-center gap-2 lg:flex">
            {session ? (
              <>
                <span className="hidden text-sm text-muted xl:block">
                  {session.viewer.fullName} · {ROLE_LABELS[session.viewer.role]}
                </span>
                <form action={signOutAction}>
                  <button type="submit" className={buttonClass('ghost', 'text-sm')}>
                    خروج
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className={buttonClass('ghost', 'text-sm')}>
                  تسجيل الدخول
                </Link>
                <Link href="/register" className={buttonClass('accent', 'text-sm')}>
                  إنشاء حساب
                </Link>
              </>
            )}
          </div>

          {/* Mobile and tablet: one disclosure menu (works without JavaScript) */}
          <details className="group relative lg:hidden">
            <summary className={buttonClass('secondary', 'cursor-pointer list-none')}>القائمة</summary>
            <nav aria-label="القائمة الرئيسية للجوال" className="absolute inset-x-0 top-full z-50 max-h-[80vh] overflow-y-auto border-b border-line bg-white p-4 shadow-lg">
              {session ? (
                <p className="px-3 pb-3 text-sm text-muted">
                  {session.viewer.fullName} · {ROLE_LABELS[session.viewer.role]}
                </p>
              ) : null}
              <ul className="grid gap-1">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="block rounded-lg px-3 py-3 font-semibold text-brand-900 hover:bg-brand-50">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid gap-2 border-t border-line pt-4">
                {session ? (
                  <form action={signOutAction}>
                    <button type="submit" className={buttonClass('secondary', 'w-full')}>
                      تسجيل الخروج
                    </button>
                  </form>
                ) : (
                  <>
                    <Link href="/login" className={buttonClass('secondary', 'w-full')}>
                      تسجيل الدخول
                    </Link>
                    <Link href="/register" className={buttonClass('accent', 'w-full')}>
                      إنشاء حساب
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
