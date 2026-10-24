import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMyBusiness, getProfile } from '@/lib/session';
import { homePathFor } from '@/lib/domain/authz';
import type { Address } from './types';

export type BuyerReadiness =
  | { kind: 'ready'; addresses: Address[] }
  | { kind: 'pending' };

/**
 * Buyers can check out only when signed in as a buyer with an approved business.
 * Anything else sends them to the correct page. place_order() repeats these checks.
 */
export async function requireBuyerReady(): Promise<BuyerReadiness | { kind: 'redirect'; to: string }> {
  const profile = await getProfile();
  if (!profile) return { kind: 'redirect', to: '/login?next=/checkout' };
  if (profile.role !== 'buyer' || !profile.is_active) {
    return { kind: 'redirect', to: homePathFor({ role: profile.role, isActive: profile.is_active }) };
  }

  const business = await getMyBusiness();
  if (!business || business.verification_status !== 'approved') {
    return { kind: 'pending' };
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('addresses')
    .select('id, profile_id, label, city_code, district, address_line, phone, is_default')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  return { kind: 'ready', addresses: (data ?? []) as Address[] };
}
