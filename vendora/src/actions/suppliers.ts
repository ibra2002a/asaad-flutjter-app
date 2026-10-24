'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fail, type ActionResult } from '@/lib/action-result';
import { getSession } from '@/lib/auth';
import { messageForDbError } from '@/lib/errors';
import { coverageSchema, fieldErrorsFrom } from '@/lib/validation';

export async function addCoverageAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.viewer.role !== 'supplier' || !session.business) return fail('هذا الإجراء متاح للموردين فقط.');
  const parsed = coverageSchema.safeParse(input);
  if (!parsed.success) return fail('اختر محافظة صالحة.', fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from('supplier_coverage')
    .insert({ business_id: session.business.id, city_code: parsed.data.cityCode });
  if (error && error.code !== '23505') return fail(messageForDbError(error));
  revalidatePath('/supplier/profile');
  return { ok: true, message: 'تمت إضافة المحافظة.' };
}

export async function removeCoverageAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.viewer.role !== 'supplier' || !session.business) return fail('هذا الإجراء متاح للموردين فقط.');
  const parsed = coverageSchema.safeParse(input);
  if (!parsed.success) return fail('محافظة غير صالحة.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('supplier_coverage')
    .delete()
    .eq('business_id', session.business.id)
    .eq('city_code', parsed.data.cityCode);
  if (error) return fail(messageForDbError(error));
  revalidatePath('/supplier/profile');
  return { ok: true, message: 'تمت إزالة المحافظة.' };
}
