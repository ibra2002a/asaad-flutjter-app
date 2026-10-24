'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fail, type ActionResult } from '@/lib/action-result';
import { getSession } from '@/lib/auth';
import { messageForDbError } from '@/lib/errors';
import { percentToBps } from '@/lib/commission';
import {
  businessStatusSchema,
  categorySchema,
  commissionRuleSchema,
  fieldErrorsFrom,
  markPaidSchema,
  userRoleSchema,
  UUID_REGEX,
} from '@/lib/validation';

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.viewer.role !== 'admin') return null;
  return session;
}

export async function setBusinessStatusAction(input: unknown): Promise<ActionResult> {
  if (!(await requireAdmin())) return fail('ليست لديك صلاحية لهذا الإجراء.');
  const parsed = businessStatusSchema.safeParse(input);
  if (!parsed.success) return fail('تحقق من البيانات المدخلة.', fieldErrorsFrom(parsed.error));
  if (parsed.data.status !== 'approved' && parsed.data.note.length < 3) {
    return fail('اكتب سبب القرار (3 أحرف على الأقل).', { note: 'السبب مطلوب' });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_business_status', {
    p_business_id: parsed.data.businessId,
    p_status: parsed.data.status,
    p_note: parsed.data.note,
  });
  if (error) return fail(messageForDbError(error));
  revalidatePath('/admin/suppliers');
  revalidatePath('/admin');
  return { ok: true, message: 'تم تحديث حالة المورد.' };
}

export async function setUserRoleAction(input: unknown): Promise<ActionResult> {
  if (!(await requireAdmin())) return fail('ليست لديك صلاحية لهذا الإجراء.');
  const parsed = userRoleSchema.safeParse(input);
  if (!parsed.success) return fail('تحقق من البيانات المدخلة.', fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_user_role', {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
    p_note: parsed.data.note,
  });
  if (error) return fail(messageForDbError(error));
  revalidatePath('/admin/users');
  return { ok: true, message: 'تم تحديث الدور.' };
}

export async function setUserActiveAction(userId: string, active: boolean, note: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return fail('ليست لديك صلاحية لهذا الإجراء.');
  if (!UUID_REGEX.test(userId)) return fail('معرّف غير صالح.');
  if (note.trim().length < 3) return fail('اكتب سبب التغيير (3 أحرف على الأقل).');

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_user_active', {
    p_user_id: userId,
    p_active: active,
    p_note: note.trim(),
  });
  if (error) return fail(messageForDbError(error));
  revalidatePath('/admin/users');
  return { ok: true, message: active ? 'تم تفعيل الحساب.' : 'تم تعطيل الحساب.' };
}

export async function createCommissionRuleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await requireAdmin())) return fail('ليست لديك صلاحية لهذا الإجراء.');
  const parsed = commissionRuleSchema.safeParse(input);
  if (!parsed.success) return fail('تحقق من قاعدة العمولة.', fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_create_commission_rule', {
    p_name: parsed.data.name,
    p_rate_bps: percentToBps(parsed.data.ratePercent),
    p_dispute_window_hours: parsed.data.disputeWindowHours,
    p_delivery_fee_commissionable: parsed.data.deliveryFeeCommissionable,
    p_activate: parsed.data.activate,
    p_note: parsed.data.note ?? null,
  });
  if (error) return fail(messageForDbError(error));
  revalidatePath('/admin/commissions');
  return { ok: true, message: parsed.data.activate ? 'تم إنشاء القاعدة وتفعيلها.' : 'تم إنشاء القاعدة.', data: { id: data as string } };
}

export async function markCommissionsPaidAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  if (!(await requireAdmin())) return fail('ليست لديك صلاحية لهذا الإجراء.');
  const parsed = markPaidSchema.safeParse(input);
  if (!parsed.success) return fail('تحقق من البيانات المدخلة.', fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_mark_commissions_paid', {
    p_commission_ids: parsed.data.commissionIds,
    p_reference: parsed.data.reference,
  });
  if (error) return fail(messageForDbError(error));
  revalidatePath('/admin/commissions');
  return { ok: true, message: `تم تسديد ${data ?? 0} عمولة.`, data: { count: Number(data ?? 0) } };
}

export async function createCategoryAction(input: unknown): Promise<ActionResult> {
  if (!(await requireAdmin())) return fail('ليست لديك صلاحية لهذا الإجراء.');
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail('تحقق من بيانات الفئة.', fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from('categories').insert({
    slug: parsed.data.slug,
    name_ar: parsed.data.nameAr,
    sort_order: parsed.data.sortOrder,
  });
  if (error) return fail(error.code === '23505' ? 'معرّف الفئة مستخدم بالفعل.' : messageForDbError(error));
  revalidatePath('/admin/categories');
  revalidatePath('/products');
  return { ok: true, message: 'تمت إضافة الفئة.' };
}

export async function toggleCategoryAction(categoryId: string, isActive: boolean): Promise<ActionResult> {
  if (!(await requireAdmin())) return fail('ليست لديك صلاحية لهذا الإجراء.');
  if (!UUID_REGEX.test(categoryId)) return fail('معرّف غير صالح.');
  const supabase = await createClient();
  const { error } = await supabase.from('categories').update({ is_active: isActive }).eq('id', categoryId);
  if (error) return fail(messageForDbError(error));
  revalidatePath('/admin/categories');
  revalidatePath('/products');
  return { ok: true, message: isActive ? 'تم تفعيل الفئة.' : 'تم إخفاء الفئة.' };
}
