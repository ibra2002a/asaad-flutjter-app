'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fail, type ActionResult } from '@/lib/action-result';
import { getSession } from '@/lib/auth';
import { messageForDbError } from '@/lib/errors';
import { UUID_REGEX, fieldErrorsFrom, productSchema } from '@/lib/validation';

function productPayload(data: ReturnType<typeof productSchema.parse>) {
  return {
    category_id: data.categoryId,
    name: data.name,
    description: data.description,
    unit: data.unit,
    price_iqd: data.priceIqd,
    min_quantity: data.minQuantity,
    stock_status: data.stockStatus,
    is_published: data.isPublished,
  };
}

function revalidateCatalog(productId?: string) {
  revalidatePath('/products');
  revalidatePath('/supplier/products');
  if (productId) revalidatePath(`/products/${productId}`);
}

export async function createProductAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const session = await getSession();
  if (!session || session.viewer.role !== 'supplier' || !session.business) return fail('هذا الإجراء متاح للموردين فقط.');
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail('تحقق من بيانات المنتج.', fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .insert({ business_id: session.business.id, ...productPayload(parsed.data) })
    .select('id')
    .single();
  if (error) {
    // The database refuses to publish while the supplier is not approved (RLS policy).
    if (/row-level security/i.test(error.message)) {
      return fail('لا يمكن نشر المنتجات قبل اعتماد حسابك. يمكنك حفظها كمسودة.', { isPublished: 'يتطلب اعتماد المورد' });
    }
    return fail(messageForDbError(error));
  }
  revalidateCatalog(data.id as string);
  return { ok: true, message: 'تم حفظ المنتج.', data: { id: data.id as string } };
}

export async function updateProductAction(productId: string, input: unknown): Promise<ActionResult> {
  if (!UUID_REGEX.test(productId)) return fail('معرّف المنتج غير صالح.');
  const session = await getSession();
  if (!session || session.viewer.role !== 'supplier') return fail('هذا الإجراء متاح للموردين فقط.');
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail('تحقق من بيانات المنتج.', fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .update(productPayload(parsed.data))
    .eq('id', productId)
    .select('id');
  if (error) {
    if (/row-level security/i.test(error.message)) {
      return fail('لا يمكن نشر المنتج قبل اعتماد حسابك. احفظه كمسودة.', { isPublished: 'يتطلب اعتماد المورد' });
    }
    return fail(messageForDbError(error));
  }
  if (!data || data.length === 0) return fail('المنتج غير موجود أو لا تملك صلاحية تعديله.');
  revalidateCatalog(productId);
  return { ok: true, message: 'تم تحديث المنتج.' };
}

export async function deleteProductAction(productId: string): Promise<ActionResult> {
  if (!UUID_REGEX.test(productId)) return fail('معرّف المنتج غير صالح.');
  const supabase = await createClient();
  const { error } = await supabase.from('products').delete().eq('id', productId);
  if (error) return fail(messageForDbError(error));
  revalidateCatalog(productId);
  return { ok: true, message: 'تم حذف المنتج.' };
}

export async function deleteProductImageAction(imageId: string): Promise<ActionResult> {
  if (!UUID_REGEX.test(imageId)) return fail('معرّف الصورة غير صالح.');
  const supabase = await createClient();
  const { data: image, error: readError } = await supabase
    .from('product_images')
    .select('id, product_id, storage_path')
    .eq('id', imageId)
    .maybeSingle();
  if (readError || !image) return fail('الصورة غير موجودة.');

  const { error } = await supabase.from('product_images').delete().eq('id', imageId);
  if (error) return fail(messageForDbError(error));
  // Storage removal runs with the supplier's session, so the storage policy limits it to their own folder.
  await supabase.storage.from('product-images').remove([image.storage_path as string]);

  revalidateCatalog(image.product_id as string);
  return { ok: true, message: 'تم حذف الصورة.' };
}
