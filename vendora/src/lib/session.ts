import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase/server';
import { canAccessPortal, homePathFor, type AppRole, type Portal, type ProfileState } from './domain/authz';
import type { Business, Profile } from './data/types';

/** Current signed-in user, or null. Cached per request. */
export const getAuthUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, role, full_name, phone, is_active')
    .eq('id', user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
});

export const getMyBusiness = cache(async (): Promise<Business | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('businesses')
    .select(
      'id, owner_id, kind, legal_name, description_ar, tax_number, city_code, street_address, phone, verification_status, review_note',
    )
    .eq('owner_id', user.id)
    .maybeSingle();
  return (data as Business | null) ?? null;
});

/** Maps a database profile row to the domain shape used by the authorization rules. */
export function profileState(profile: Profile): ProfileState {
  return { role: profile.role, isActive: profile.is_active };
}

/**
 * Guards a portal layout or page. Redirects anonymous visitors to login and
 * users of the wrong role to their own portal. The database still enforces
 * every privilege independently of this check.
 */
export async function requirePortal(portal: Portal): Promise<{ profile: Profile }> {
  const profile = await getProfile();
  if (!profile) {
    redirect('/login');
  }
  const state = profileState(profile);
  if (!canAccessPortal(state, portal)) {
    redirect(homePathFor(state));
  }
  return { profile };
}

export function roleLabelAr(role: AppRole): string {
  return role === 'admin' ? 'مدير النظام' : role === 'supplier' ? 'مورد' : 'تاجر';
}
