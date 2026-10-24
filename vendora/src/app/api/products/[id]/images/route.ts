import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import { messageForDbError } from '@/lib/errors';
import { validateImageFile } from '@/lib/image';
import { UUID_REGEX } from '@/lib/validation';

export const runtime = 'nodejs';

const BUCKET = 'product-images';
const MAX_IMAGES_PER_PRODUCT = 5;

/**
 * Uploads one product image.
 * Checks: signed-in approved supplier, owner of the product (RLS), file size, real image signature,
 * and a per-user upload rate limit. The file is stored in the uploader's own folder.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: productId } = await context.params;
  if (!UUID_REGEX.test(productId)) {
    return NextResponse.json({ message: 'معرّف المنتج غير صالح.' }, { status: 400 });
  }

  const session = await getSession();
  if (!session || session.viewer.role !== 'supplier') {
    return NextResponse.json({ message: 'هذا الإجراء متاح للموردين فقط.' }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: allowed, error: limitError } = await supabase.rpc('consume_rate_limit', {
    p_action: 'upload_image',
    p_max: 60,
    p_window_seconds: 3600,
  });
  if (limitError) return NextResponse.json({ message: messageForDbError(limitError) }, { status: 500 });
  if (allowed === false) {
    return NextResponse.json({ message: 'عدد الرفعات كبير. حاول لاحقاً.' }, { status: 429 });
  }

  // RLS: this returns nothing unless the product belongs to this supplier.
  const { data: product } = await supabase.from('products').select('id').eq('id', productId).maybeSingle();
  if (!product) {
    return NextResponse.json({ message: 'المنتج غير موجود أو لا تملك صلاحية تعديله.' }, { status: 404 });
  }

  const { count } = await supabase
    .from('product_images')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);
  if ((count ?? 0) >= MAX_IMAGES_PER_PRODUCT) {
    return NextResponse.json({ message: 'الحد الأقصى 5 صور لكل منتج.' }, { status: 409 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ message: 'لم يتم إرسال ملف.' }, { status: 400 });
  }

  // Read the bytes ourselves: size and signature are checked on the server, never trusted from the client.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateImageFile(file, bytes);
  if (!check.ok) {
    return NextResponse.json({ message: check.message }, { status: 415 });
  }

  const path = `${session.viewer.userId}/${randomUUID()}.${check.type.ext}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: check.type.mime, upsert: false, cacheControl: '31536000' });
  if (uploadError) {
    return NextResponse.json({ message: 'تعذر رفع الصورة. تحقق من الاعتماد وحاول مرة أخرى.' }, { status: 403 });
  }

  const { data: row, error: insertError } = await supabase
    .from('product_images')
    .insert({ product_id: productId, storage_path: path, sort_order: count ?? 0 })
    .select('id, storage_path')
    .single();
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ message: messageForDbError(insertError) }, { status: 400 });
  }

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ id: row.id, storagePath: row.storage_path, url: publicUrl.publicUrl }, { status: 201 });
}
