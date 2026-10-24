import Link from 'next/link';
import { getAuthUser, getProfile } from '@/lib/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { CartBadge } from './CartBadge';
import { logoutAction } from '@/lib/actions/auth';

const PUBLIC_LINKS = [
  { href: '/categories', label: 'الفئات' },
  { href: '/products', label: 'المنتجات' },
  { href: '/suppliers', label: 'الموردون' },
];

async function unreadCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  return count ?? 0;
}

export async function Header() {
  const configured = isSupabaseConfigured();
  const user = configured ? await getAuthUser() : null;
  const profile = user ? await getProfile() : null;
  const dashboard =
    profile?.role === 'admin' ? '/admin' : profile?.role === 'supplier' ? '/supplier' : profile?.role === 'buyer' ? '/buyer' : null;
  const notices = profile && profile.is_active ? await unreadCount() : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-brand-900/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="VENDORA — الصفحة الرئيسية">
          <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-xl bg-brand-900">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="#a3e635" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 6l7 12 7-12" />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-lg font-black tracking-wide text-brand-950">VENDORA</span>
            <span className="hidden text-[11px] font-medium text-muted sm:block">Trade Smarter. Grow Faster.</span>
          </span>
        </Link>

        <nav aria-label="القائمة الرئيسية" className="hidden flex-1 items-center gap-1 md:flex">
          {PUBLIC_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-50">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <CartBadge />
          {user && profile ? (
            <>
              {dashboard ? (
                <Link href={dashboard} className="hidden min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-brand-900 hover:bg-brand-50 sm:flex">
                  لوحتي
                </Link>
              ) : null}
              <Link
                href="/notifications"
                className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl text-brand-900 hover:bg-brand-50"
                aria-label={notices > 0 ? `الإشعارات، ${notices} غير مقروءة` : 'الإشعارات'}
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {notices > 0 ? (
                  <span className="ltr-num absolute -end-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {notices > 9 ? '9+' : notices}
                  </span>
                ) : null}
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="min-h-11 rounded-xl px-3 text-sm font-semibold text-brand-900 hover:bg-brand-50">
                  خروج
                </button>
              </form>
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="min-h-11 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-900 hover:bg-brand-50">
                تسجيل الدخول
              </Link>
              <Link href="/register" className="inline-flex min-h-11 items-center rounded-xl bg-lime-400 px-4 text-sm font-bold text-brand-950 hover:bg-lime-500">
                إنشاء حساب
              </Link>
            </div>
          )}

          <details className="group relative md:hidden">
            <summary className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-xl text-brand-900 hover:bg-brand-50 [&::-webkit-details-marker]:hidden" aria-label="القائمة">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </summary>
            <div className="absolute end-0 top-12 w-64 rounded-2xl border border-line bg-white p-2 shadow-xl">
              {PUBLIC_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="block rounded-xl px-4 py-3 text-sm font-semibold text-brand-900 hover:bg-brand-50">
                  {link.label}
                </Link>
              ))}
              <div className="my-2 border-t border-line" />
              {user && dashboard ? (
                <Link href={dashboard} className="block rounded-xl px-4 py-3 text-sm font-semibold text-brand-900 hover:bg-brand-50">
                  لوحتي
                </Link>
              ) : (
                <>
                  <Link href="/login" className="block rounded-xl px-4 py-3 text-sm font-semibold text-brand-900 hover:bg-brand-50">
                    تسجيل الدخول
                  </Link>
                  <Link href="/register" className="block rounded-xl px-4 py-3 text-sm font-semibold text-brand-900 hover:bg-brand-50">
                    إنشاء حساب
                  </Link>
                </>
              )}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
