'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { businessProfileSchema, addressSchema, profileSchema, uuidSchema } from '@/lib/validation/schemas';
import { userMessageFor } from '@/lib/domain/errors';
import { flattenZodErrors, type FormState } from './types';
import { currentUserId } from './helpers';

export async function updateProfileAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = profileSchema.safeParse({ fullName: formData.get('fullName'), phone: formData.get('phone') });
  if (!parsed.success) return { fieldErrors: flattenZodErrors(parsed.error) };

  const userId = await currentUserId();
  if (!userId) return { error: 'يجب تسجيل الدخول أولا.' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq('id', userId);
  if (error) return { error: userMessageFor(error) };

  revalidatePath('/', 'layout');
  return { success: 'تم حفظ بيانات الحساب.' };
}

export async function updateBusinessAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = businessProfileSchema.safeParse({
    legalName: formData.get('legalName'),
    descriptionAr: formData.get('descriptionAr') ?? undefined,
    taxNumber: formData.get('taxNumber') ?? undefined,
    cityCode: formData.get('cityCode'),
    streetAddress: formData.get('streetAddress') ?? undefined,
    phone: formData.get('phone'),
  });
  if (!parsed.success) return { fieldErrors: flattenZodErrors(parsed.error) };

  const userId = await currentUserId();
  if (!userId) return { error: 'يجب تسجيل الدخول أولا.' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('businesses')
    .update({
      legal_name: parsed.data.legalName,
      description_ar: parsed.data.descriptionAr,
      tax_number: parsed.data.taxNumber,
      city_code: parsed.data.cityCode,
      street_address: parsed.data.streetAddress,
      phone: parsed.data.phone,
    })
    .eq('owner_id', userId);
  if (error) return { error: userMessageFor(error) };

  revalidatePath('/', 'layout');
  return { success: 'تم حفظ الملف التجاري.' };
}

export async function saveAddressAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = addressSchema.safeParse({
    label: formData.get('label'),
    cityCode: formData.get('cityCode'),
    district: formData.get('district'),
    addressLine: formData.get('addressLine'),
    phone: formData.get('phone'),
    isDefault: formData.get('isDefault') === 'on',
  });
  if (!parsed.success) return { fieldErrors: flattenZodErrors(parsed.error) };

  const userId = await currentUserId();
  if (!userId) return { error: 'يجب تسجيل الدخول أولا.' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('addresses').insert({
    profile_id: userId,
    label: parsed.data.label,
    city_code: parsed.data.cityCode,
    district: parsed.data.district,
    address_line: parsed.data.addressLine,
    phone: parsed.data.phone,
    is_default: parsed.data.isDefault,
  });
  if (error) return { error: userMessageFor(error) };

  revalidatePath('/buyer/profile');
  revalidatePath('/checkout');
  return { success: 'تمت إضافة العنوان.' };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const id = uuidSchema.safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from('addresses').delete().eq('id', id.data);
  revalidatePath('/buyer/profile');
  revalidatePath('/checkout');
}

export async function setDefaultAddressAction(formData: FormData): Promise<void> {
  const id = uuidSchema.safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from('addresses').update({ is_default: true }).eq('id', id.data);
  revalidatePath('/buyer/profile');
  revalidatePath('/checkout');
}

export async function markNotificationsReadAction(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const supabase = await createSupabaseServerClient();
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('profile_id', userId)
    .is('read_at', null);
  revalidatePath('/notifications');
  revalidatePath('/', 'layout');
}

