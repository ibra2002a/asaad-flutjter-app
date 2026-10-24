'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fail, type ActionResult } from '@/lib/action-result';
import { getSession } from '@/lib/auth';
import { messageForDbError } from '@/lib/errors';
import { businessProfileSchema, fieldErrorsFrom, addressSchema, profileSchema, UUID_REGEX } from '@/lib/validation';

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail('يجب تسجيل الدخول أولاً.');
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail('تحقق من البيانات المدخلة.', fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq('id', session.viewer.userId);
  if (error) return fail(messageForDbError(error));
  revalidatePath('/account');
  return { ok: true, message: 'تم حفظ بيانات الحساب.' };
}

export async function updateBusinessAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.business) return fail('لا يوجد نشاط تجاري مرتبط بالحساب.');
  const parsed = businessProfileSchema.safeParse(input);
  if (!parsed.success) return fail('تحقق من البيانات المدخلة.', fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from('businesses')
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      city_code: parsed.data.cityCode,
      address: parsed.data.address,
      phone: parsed.data.phone,
    })
    .eq('id', session.business.id);
  if (error) return fail(messageForDbError(error));
  revalidatePath('/account');
  revalidatePath('/supplier/profile');
  return { ok: true, message: 'تم حفظ بيانات النشاط التجاري.' };
}

export async function addAddressAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session || session.viewer.role !== 'buyer') return fail('هذا الإجراء متاح للمشترين فقط.');
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return fail('تحقق من البيانات المدخلة.', fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('addresses')
    .insert({
      owner_id: session.viewer.userId,
      label: parsed.data.label,
      city_code: parsed.data.cityCode,
      address_line: parsed.data.addressLine,
      landmark: parsed.data.landmark,
    })
    .select('id')
    .single();
  if (error) return fail(messageForDbError(error));
  revalidatePath('/account');
  revalidatePath('/checkout');
  return { ok: true, data: { id: data.id as string } };
}

export async function deleteAddressAction(addressId: string): Promise<ActionResult> {
  if (!UUID_REGEX.test(addressId)) return fail('معرّف غير صالح.');
  const supabase = await createClient();
  const { error } = await supabase.from('addresses').delete().eq('id', addressId);
  if (error) return fail(messageForDbError(error));
  revalidatePath('/account');
  revalidatePath('/checkout');
  return { ok: true, message: 'تم حذف العنوان.' };
}
