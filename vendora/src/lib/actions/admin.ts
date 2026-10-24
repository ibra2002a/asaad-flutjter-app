'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { userMessageFor } from '@/lib/domain/errors';
import { commissionPercentSchema, uuidSchema } from '@/lib/validation/schemas';
import { flattenZodErrors, type FormState } from './types';
import { redirectWithError, redirectWithNotice } from './helpers';

const VERIFICATION = ['approved', 'rejected', 'suspended'] as const;
const PRODUCT_STATUS = ['active', 'rejected', 'pending_review', 'archived'] as const;
const RESOLUTIONS = ['partial_return', 'refund_full', 'no_action'] as const;
const SAFE_RETURN_PATHS = ['/admin/suppliers', '/admin/buyers', '/admin/products', '/admin/disputes', '/admin/commissions'];

function safeReturnPath(value: FormDataEntryValue | null, fallback: string): string {
  const path = String(value ?? '');
  return SAFE_RETURN_PATHS.includes(path) ? path : fallback;
}

export async function adminReviewBusinessAction(formData: FormData): Promise<void> {
  const returnTo = safeReturnPath(formData.get('returnTo'), '/admin/suppliers');
  const id = uuidSchema.safeParse(formData.get('businessId'));
  const status = String(formData.get('status') ?? '');
  if (!id.success || !(VERIFICATION as readonly string[]).includes(status)) {
    redirectWithError(returnTo, 'بيانات غير صالحة.');
  }
  const note = String(formData.get('note') ?? '').trim() || null;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('admin_review_business', {
    p_business_id: id.data,
    p_status: status,
    p_note: note,
  });
  revalidatePath(returnTo);
  if (error) redirectWithError(returnTo, userMessageFor(error));
  redirectWithNotice(returnTo, 'saved');
}

export async function adminSetProfileActiveAction(formData: FormData): Promise<void> {
  const returnTo = safeReturnPath(formData.get('returnTo'), '/admin/buyers');
  const id = uuidSchema.safeParse(formData.get('profileId'));
  const active = formData.get('active') === 'true';
  const reason = String(formData.get('reason') ?? '').trim();
  if (!id.success) redirectWithError(returnTo, 'المستخدم غير صالح.');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('admin_set_profile_active', {
    p_profile_id: id.data,
    p_active: active,
    p_reason: reason,
  });
  revalidatePath(returnTo);
  if (error) redirectWithError(returnTo, userMessageFor(error));
  redirectWithNotice(returnTo, 'saved');
}

export async function adminReviewProductAction(formData: FormData): Promise<void> {
  const returnTo = safeReturnPath(formData.get('returnTo'), '/admin/products');
  const id = uuidSchema.safeParse(formData.get('productId'));
  const status = String(formData.get('status') ?? '');
  if (!id.success || !(PRODUCT_STATUS as readonly string[]).includes(status)) {
    redirectWithError(returnTo, 'بيانات غير صالحة.');
  }
  const note = String(formData.get('note') ?? '').trim() || null;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('admin_review_product', {
    p_product_id: id.data,
    p_status: status,
    p_note: note,
  });
  revalidatePath(returnTo);
  if (error) redirectWithError(returnTo, userMessageFor(error));
  redirectWithNotice(returnTo, 'saved');
}

export async function adminUpsertCategoryAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const idRaw = String(formData.get('id') ?? '');
  const id = idRaw ? uuidSchema.safeParse(idRaw) : null;
  if (id && !id.success) return { error: 'الفئة غير صالحة.' };

  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
  const nameAr = String(formData.get('nameAr') ?? '').trim();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { fieldErrors: { slug: 'الرابط المختصر بالأحرف الإنجليزية والأرقام والشرطات فقط' } };
  if (nameAr.length < 2) return { fieldErrors: { nameAr: 'اسم الفئة مطلوب' } };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('admin_upsert_category', {
    p_id: id?.data ?? null,
    p_slug: slug,
    p_name_ar: nameAr,
    p_description_ar: String(formData.get('descriptionAr') ?? '').trim() || null,
    p_sort_order: Number(formData.get('sortOrder') ?? 0) || 0,
    p_is_active: formData.get('isActive') === 'on',
  });
  if (error) return { error: userMessageFor(error) };

  revalidatePath('/admin/categories');
  revalidatePath('/categories');
  return { success: 'تم حفظ الفئة.' };
}

export async function adminSetCommissionRuleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const scope = String(formData.get('scope') ?? '');
  if (!['global', 'category', 'supplier'].includes(scope)) return { error: 'نطاق القاعدة غير صالح.' };

  const percent = commissionPercentSchema.safeParse(formData.get('percent'));
  if (!percent.success) return { fieldErrors: flattenZodErrors(percent.error) };

  const categoryRaw = String(formData.get('categoryId') ?? '');
  const supplierRaw = String(formData.get('supplierId') ?? '');
  const categoryId = scope === 'category' ? uuidSchema.safeParse(categoryRaw) : null;
  const supplierId = scope === 'supplier' ? uuidSchema.safeParse(supplierRaw) : null;
  if ((categoryId && !categoryId.success) || (supplierId && !supplierId.success)) {
    return { error: 'اختر الفئة أو المورد المستهدف.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('admin_set_commission_rule', {
    p_scope: scope,
    p_category_id: categoryId?.success ? categoryId.data : null,
    p_supplier_business_id: supplierId?.success ? supplierId.data : null,
    p_rate_bp: percent.data,
    p_note: String(formData.get('note') ?? '').trim(),
  });
  if (error) return { error: userMessageFor(error) };

  revalidatePath('/admin/commissions');
  return { success: 'تم تحديث نسبة العمولة. الطلبات السابقة تحتفظ بنسبتها الأصلية.' };
}

export async function adminSettleCommissionAction(formData: FormData): Promise<void> {
  const id = uuidSchema.safeParse(formData.get('commissionId'));
  if (!id.success) redirectWithError('/admin/commissions', 'السجل غير صالح.');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('admin_mark_commission_settled', { p_commission_id: id.data });
  revalidatePath('/admin/commissions');
  if (error) redirectWithError('/admin/commissions', userMessageFor(error));
  redirectWithNotice('/admin/commissions', 'settled');
}

export async function adminResolveDisputeAction(formData: FormData): Promise<void> {
  const id = uuidSchema.safeParse(formData.get('disputeId'));
  const path = `/admin/disputes`;
  if (!id.success) redirectWithError(path, 'النزاع غير صالح.');

  const resolution = String(formData.get('resolution') ?? '');
  if (!(RESOLUTIONS as readonly string[]).includes(resolution)) redirectWithError(path, 'اختر نوع الحل.');

  const quantityRaw = String(formData.get('returnedQuantity') ?? '').trim();
  const quantity = quantityRaw === '' ? null : Number(quantityRaw);
  if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1)) {
    redirectWithError(path, 'كمية الإرجاع غير صحيحة.');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('admin_resolve_dispute', {
    p_dispute_id: id.data,
    p_resolution: resolution,
    p_note: String(formData.get('note') ?? '').trim(),
    p_returned_quantity: quantity,
  });
  revalidatePath(path);
  if (error) redirectWithError(path, userMessageFor(error));
  redirectWithNotice(path, 'resolved');
}

