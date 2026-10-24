import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Business, Role, Viewer } from '@/lib/types';

export type Session = { viewer: Viewer; business: Business | null };

/**
 * The signed-in user with their profile and business. Returns null when signed out
 * or when the profile is missing or deactivated (RLS hides the row in that case).
 * Cached per request, so layouts and pages can both call it.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const [profileResult, businessResult] = await Promise.all([
    supabase.from('profiles').select('role, full_name, phone').eq('id', user.id).maybeSingle(),
    supabase.from('businesses').select('*').eq('owner_id', user.id).maybeSingle(),
  ]);
  const profile = profileResult.data;
  if (!profile) return null;

  return {
    viewer: {
      userId: user.id,
      email: user.email,
      role: profile.role as Role,
      fullName: profile.full_name as string,
      phone: profile.phone as string,
    },
    business: (businessResult.data as Business | null) ?? null,
  };
});

/** Use in server components and layouts. Redirects when the viewer is not signed in or not allowed. */
export async function requireSession(allowedRoles?: readonly Role[]): Promise<Session> {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (allowedRoles && !allowedRoles.includes(session.viewer.role)) {
    redirect(homePathFor(session.viewer.role));
  }
  return session;
}

export function homePathFor(role: Role): string {
  switch (role) {
    case 'supplier':
      return '/supplier';
    case 'ops':
    case 'admin':
      return '/admin';
    default:
      return '/products';
  }
}
