import { NextResponse, type NextRequest } from 'next/server';
import { refreshSession } from '@/lib/supabase/proxy';

// Routes that need a signed-in user. This is a convenience redirect only:
// every page and action checks the role again, and the database enforces access.
const PROTECTED_PREFIXES = ['/account', '/checkout', '/orders', '/supplier', '/admin'];

export async function proxy(request: NextRequest) {
  const { response, user } = await refreshSession(request);
  const { pathname, search } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
