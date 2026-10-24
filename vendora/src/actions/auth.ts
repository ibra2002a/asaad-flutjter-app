'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPublicEnv } from '@/lib/env';
import { fail, type ActionResult } from '@/lib/action-result';
import { fieldErrorsFrom, loginSchema, registerSchema } from '@/lib/validation';
import { homePathFor, getSession } from '@/lib/auth';
import { messageForDbError } from '@/lib/errors';

export async function signInAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return fail('تحقق من البيانات المدخلة.', fieldErrorsFrom(parsed.error));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Same message for unknown email and wrong password (no account enumeration).
    return fail('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  }

  const session = await getSession();
  if (!session) {
    await supabase.auth.signOut();
    return fail('الحساب غير مفعّل. تواصل مع فريق VENDORA.');
  }

  const next = String(formData.get('next') ?? '');
  // Only same-site relative paths are allowed (blocks //host and /\\host open redirects).
  const isSafePath = /^\/(?![\/\\])/.test(next);
  const safeNext = isSafePath ? next : homePathFor(session.viewer.role);
  redirect(safeNext);
}

export async function signUpAction(_prev: ActionResult<{ needsConfirmation: boolean }>, formData: FormData): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = registerSchema.safeParse({
    role: formData.get('role'),
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
    phone: formData.get('phone'),
    businessName: formData.get('businessName'),
    cityCode: formData.get('cityCode'),
    businessAddress: formData.get('businessAddress') ?? '',
  });
  if (!parsed.success) {
    return fail('تحقق من البيانات المدخلة.', fieldErrorsFrom(parsed.error));
  }
  const input = parsed.data;
  const env = getPublicEnv();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      // Metadata is read by the database trigger handle_new_user(). Its role is whitelisted there.
      data: {
        role: input.role,
        full_name: input.fullName,
        phone: input.phone,
        business_name: input.businessName,
        city_code: input.cityCode,
        business_address: input.businessAddress ?? '',
      },
    },
  });

  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return fail('هذا البريد مسجل بالفعل. سجّل الدخول بدلاً من ذلك.', { email: 'مسجل بالفعل' });
    }
    if (/password/i.test(error.message)) {
      return fail('كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.', { password: 'كلمة مرور ضعيفة' });
    }
    return fail(messageForDbError(error));
  }

  // With email confirmation enabled, there is no session yet.
  const needsConfirmation = !data.session;
  if (!needsConfirmation) {
    redirect(input.role === 'supplier' ? '/supplier' : '/products');
  }
  return { ok: true, data: { needsConfirmation } };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
