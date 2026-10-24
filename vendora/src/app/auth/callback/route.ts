import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPublicEnv } from '@/lib/env';

/** Email confirmation / magic-link landing: exchanges the code for a session cookie. */
export async function GET(request: NextRequest) {
  const { NEXT_PUBLIC_SITE_URL } = getPublicEnv();
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL('/products', NEXT_PUBLIC_SITE_URL));
    }
  }
  return NextResponse.redirect(new URL('/login?error=confirm', NEXT_PUBLIC_SITE_URL));
}
