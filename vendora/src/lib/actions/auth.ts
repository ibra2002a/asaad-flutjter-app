'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/supabase/env';
import { homePathFor, type ProfileState } from '@/lib/domain/authz';
import { loginSchema, registerSchema } from '@/lib/validation/schemas';
import { flattenZodErrors, safeNextPath, translateAuthError, type FormState } from './types';

export async function registerAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    role: formData.get('role'),
    fullName: formData.get('fullName'),
    legalName: formData.get('legalName'),
    cityCode: formData.get('cityCode'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    password: formData.get('password'),
    acceptTerms: formData.get('acceptTerms') === 'on' ? true : undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: flattenZodErrors(parsed.error) };
  }
  const input = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback`,
      data: {
        role: input.role,
        full_name: input.fullName,
        legal_name: input.legalName,
        city_code: input.cityCode,
        phone: input.phone,
      },
    },
  });

  if (error) {
    return { error: translateAuthError(error.message) };
  }
  if (!data.session) {
    return {
      success: 'أرسلنا رابط التفعيل إلى بريدك الإلكتروني. افتح الرابط ثم سجّل الدخول لإكمال ملفك التجاري.',
    };
  }

  revalidatePath('/', 'layout');
  redirect(input.role === 'supplier' ? '/supplier/onboarding' : '/buyer');
}

export async function loginAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { fieldErrors: flattenZodErrors(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { error: translateAuthError(error?.message ?? 'invalid login credentials') };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .maybeSingle();

  const state: ProfileState | null = profile
    ? { role: profile.role as ProfileState['role'], isActive: profile.is_active as boolean }
    : null;

  if (state && !state.isActive) {
    await supabase.auth.signOut();
    return { error: 'حسابك معلق حاليا. تواصل مع فريق الدعم.' };
  }

  const next = safeNextPath(formData.get('next') as string | null, '');
  revalidatePath('/', 'layout');
  redirect(next || homePathFor(state));
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
