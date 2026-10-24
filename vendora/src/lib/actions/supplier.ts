'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { userMessageFor } from '@/lib/domain/errors';
import { productSchema, uuidSchema } from '@/lib/validation/schemas';
import { flattenZodErrors, type FormState } from './types';
import { currentUserId, redirectWithError, redirectWithNotice } from './helpers';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_IMAGES_PER_PRODUCT = 8;
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const BUCKET = 'product-images';

function productFields(formData: FormData) {
  return productSchema.safeParse({
    categoryId: formData.get('categoryId'),
    nameAr: formData.get('nameAr'),
    descriptionAr: formData.get('descriptionAr') ?? undefined,
    unit: formData.get('unit'),
    priceIqd: formData.get('priceIqd'),
    salePriceIqd: formData.get('salePriceIqd') ?? undefined,
    minOrderQty: formData.get('minOrderQty'),
    maxOrderQty: formData.get('maxOrderQty') ?? undefined,
    stockQty: formData.get('stockQty'),
    status: formData.get('status') ?? undefined,
  });
}

async function attachImages(productId: string, supplierBusinessId: string, files: File[]): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from('product_images')
    .select('id', { count: 'exact' })
    .eq('product_id', productId);
  let position = existing?.length ?? 0;

  for (const file of files) {
    if (file.size === 0) continue;
    const extension = IMAGE_TYPES[file.type];
    if (!extension) return 'الصور يجب أن تكون بصيغة JPG أو PNG أو WebP.';
    if (file.size > MAX_IMAGE_BYTES) return 'حجم الصورة يجب ألا يتجاوز 3 ميغابايت.';
    if (position >= MAX_IMAGES_PER_PRODUCT) return 'الحد الأقصى ٨ صور لكل منتج.';

    const path = `${supplierBusinessId}/${productId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
    });
    if (uploadError) return 'تعذر رفع الصورة. حاول مرة أخرى.';

    const { error } = await supabase.from('product_images').insert({ product_id: productId, storage_path: path, position });
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      return userMessageFor(error);
    }
    position += 1;
  }
  return null;
}

async function myBusinessId(): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('businesses').select('id').eq('owner_id', userId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function createProductAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = productFields(formData);
  if (!parsed.success) return { fieldErrors: flattenZodErrors(parsed.error) };

  const businessId = await myBusinessId();
  if (!businessId) return { error: 'لا يوجد حساب مورد مرتبط بهذا المستخدم.' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('products')
    .insert({
      supplier_id: businessId,
      category_id: parsed.data.categoryId,
      name_ar: parsed.data.nameAr,
      description_ar: parsed.data.descriptionAr,
      unit: parsed.data.unit,
      price_iqd: parsed.data.priceIqd,
      sale_price_iqd: parsed.data.salePriceIqd,
      min_order_qty: parsed.data.minOrderQty,
      max_order_qty: parsed.data.maxOrderQty,
      stock_qty: parsed.data.stockQty,
      status: parsed.data.status ?? 'draft',
    })
    .select('id')
    .single();
  if (error || !data) return { error: userMessageFor(error) };

  const files = formData.getAll('images').filter((v): v is File => v instanceof File);
  const imageError = await attachImages(data.id as string, businessId, files);
  revalidatePath('/supplier/products');
  if (imageError) {
    redirectWithError(`/supplier/products/${data.id}`, imageError);
  }
  redirectWithNotice(`/supplier/products/${data.id}`, 'created');
}

export async function updateProductAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidSchema.safeParse(formData.get('id'));
  if (!id.success) return { error: 'المنتج غير صالح.' };
  const parsed = productFields(formData);
  if (!parsed.success) return { fieldErrors: flattenZodErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('products')
    .update({
      category_id: parsed.data.categoryId,
      name_ar: parsed.data.nameAr,
      description_ar: parsed.data.descriptionAr,
      unit: parsed.data.unit,
      price_iqd: parsed.data.priceIqd,
      sale_price_iqd: parsed.data.salePriceIqd,
      min_order_qty: parsed.data.minOrderQty,
      max_order_qty: parsed.data.maxOrderQty,
      stock_qty: parsed.data.stockQty,
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    })
    .eq('id', id.data);
  if (error) return { error: userMessageFor(error) };

  const businessId = await myBusinessId();
  const files = formData.getAll('images').filter((v): v is File => v instanceof File);
  if (businessId && files.length > 0) {
    const imageError = await attachImages(id.data, businessId, files);
    if (imageError) return { error: imageError };
  }

  revalidatePath(`/supplier/products/${id.data}`);
  revalidatePath('/supplier/products');
  return { success: 'تم حفظ المنتج.' };
}

export async function deleteProductImageAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidSchema.safeParse(formData.get('imageId'));
  const productId = uuidSchema.safeParse(formData.get('productId'));
  if (!id.success || !productId.success) return { error: 'الصورة غير صالحة.' };
  const supabase = await createSupabaseServerClient();
  const { data: image } = await supabase.from('product_images').select('storage_path').eq('id', id.data).maybeSingle();
  if (!image) return { error: 'الصورة غير موجودة.' };
  const { error } = await supabase.from('product_images').delete().eq('id', id.data);
  if (error) return { error: userMessageFor(error) };
  await supabase.storage.from(BUCKET).remove([image.storage_path as string]);
  revalidatePath(`/supplier/products/${productId.data}`);
  return { success: 'تم حذف الصورة.' };
}

export async function setSupplierCoverageAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const businessId = await myBusinessId();
  if (!businessId) return { error: 'لا يوجد حساب مورد مرتبط بهذا المستخدم.' };

  const cities = formData
    .getAll('cities')
    .map(String)
    .filter((code) => /^[a-z]+(-[a-z]+)*$/.test(code));

  const supabase = await createSupabaseServerClient();
  const { error: clearError } = await supabase.from('supplier_coverage').delete().eq('business_id', businessId);
  if (clearError) return { error: userMessageFor(clearError) };
  if (cities.length > 0) {
    const { error } = await supabase
      .from('supplier_coverage')
      .insert(cities.map((city_code) => ({ business_id: businessId, city_code })));
    if (error) return { error: userMessageFor(error) };
  }
  revalidatePath('/supplier/onboarding');
  revalidatePath('/supplier/profile');
  return { success: 'تم حفظ مناطق التغطية.' };
}

export async function supplierTransitionAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidSchema.safeParse(formData.get('orderId'));
  const to = String(formData.get('to') ?? '');
  const reason = String(formData.get('reason') ?? '').trim() || null;
  if (!id.success) return { error: 'الطلب غير صالح.' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('transition_order', { p_order_id: id.data, p_to: to, p_reason: reason });
  revalidatePath(`/supplier/orders/${id.data}`);
  revalidatePath('/supplier/orders');
  revalidatePath('/supplier');
  if (error) return { error: userMessageFor(error) };
  return { success: 'تم تحديث حالة الطلب.' };
}
