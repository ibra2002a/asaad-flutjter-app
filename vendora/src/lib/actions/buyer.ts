'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { MAX_CART_LINES, MAX_LINE_QUANTITY, type ProductConstraints } from '@/lib/domain/cart';
import { userMessageFor } from '@/lib/domain/errors';
import { disputeSchema, uuidSchema } from '@/lib/validation/schemas';
import { flattenZodErrors, type FormState } from './types';

const cartLinesSchema = z
  .array(
    z.object({
      productId: uuidSchema,
      quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
    }),
  )
  .min(1)
  .max(MAX_CART_LINES);

/**
 * Current prices and limits for the products in a cart. Read-only, and it runs
 * as the visitor, so only products the public can buy are returned.
 */
export interface CartProductView extends ProductConstraints {
  unit: string;
  supplierName: string;
}

export async function getCartProductsAction(productIds: string[]): Promise<CartProductView[]> {
  const ids = productIds.filter((id) => uuidSchema.safeParse(id).success).slice(0, MAX_CART_LINES);
  if (ids.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name_ar, price_iqd, sale_price_iqd, min_order_qty, max_order_qty, stock_qty, supplier_id, unit, supplier:businesses!products_supplier_id_fkey(legal_name)')
    .in('id', ids);
  if (error || !data) return [];

  return data.map((row) => {
    const supplier = row.supplier as unknown as { legal_name: string } | null;
    return {
      id: row.id as string,
      nameAr: row.name_ar as string,
      priceIqd: Number(row.price_iqd),
      salePriceIqd: row.sale_price_iqd === null ? null : Number(row.sale_price_iqd),
      minOrderQty: Number(row.min_order_qty),
      maxOrderQty: row.max_order_qty === null ? null : Number(row.max_order_qty),
      stockQty: Number(row.stock_qty),
      supplierId: row.supplier_id as string,
      unit: row.unit as string,
      supplierName: supplier?.legal_name ?? '',
    };
  });
}

export interface PlacedOrder {
  order_id: string;
  order_number: string;
  supplier_business_id: string;
  total_iqd: number;
  duplicate: boolean;
}

/**
 * Checkout. The client sends only product ids, quantities, the address and an
 * idempotency key. Prices, stock and eligibility are decided in place_order().
 */
export async function placeOrderAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const addressId = uuidSchema.safeParse(formData.get('addressId'));
  const key = String(formData.get('idempotencyKey') ?? '');
  let lines: unknown;
  try {
    lines = JSON.parse(String(formData.get('items') ?? '[]'));
  } catch {
    return { error: 'السلة غير صالحة. حدّث الصفحة وحاول مجددا.' };
  }
  const parsedLines = cartLinesSchema.safeParse(lines);

  if (!addressId.success) return { error: 'اختر عنوان التوصيل.' };
  if (!parsedLines.success) return { error: 'السلة فارغة أو تحتوي بيانات غير صالحة.' };
  if (key.length < 8 || key.length > 100) return { error: 'تعذر تأكيد الطلب. حدّث الصفحة وحاول مجددا.' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('place_order', {
    p_address_id: addressId.data,
    p_items: parsedLines.data.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
    p_idempotency_key: key,
  });
  if (error) return { error: userMessageFor(error) };

  const orders = (data ?? []) as PlacedOrder[];
  revalidatePath('/buyer/orders');
  revalidatePath('/buyer');
  return {
    success: `تم تأكيد ${orders.length === 1 ? 'طلبك' : `${orders.length} طلبات`}.`,
    redirectTo: orders.length === 1 ? `/buyer/orders/${orders[0]!.order_id}?notice=placed` : '/buyer/orders?notice=placed',
  };
}

export async function confirmReceiptAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidSchema.safeParse(formData.get('orderId'));
  if (!id.success) return { error: 'الطلب غير صالح.' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('transition_order', { p_order_id: id.data, p_to: 'completed', p_reason: null });
  revalidatePath(`/buyer/orders/${id.data}`);
  revalidatePath('/buyer/orders');
  revalidatePath('/buyer');
  if (error) return { error: userMessageFor(error) };
  return { success: 'شكرا لتأكيد الاستلام. اكتمل الطلب.' };
}

export async function cancelOrderAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidSchema.safeParse(formData.get('orderId'));
  if (!id.success) return { error: 'الطلب غير صالح.' };
  const reason = String(formData.get('reason') ?? '').trim() || null;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('transition_order', { p_order_id: id.data, p_to: 'cancelled', p_reason: reason });
  revalidatePath(`/buyer/orders/${id.data}`);
  revalidatePath('/buyer/orders');
  revalidatePath('/buyer');
  if (error) return { error: userMessageFor(error) };
  return { success: 'تم إلغاء الطلب.' };
}

export async function openDisputeAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = disputeSchema.safeParse({
    orderId: formData.get('orderId'),
    kind: formData.get('kind'),
    orderItemId: formData.get('orderItemId') || undefined,
    requestedQuantity: formData.get('requestedQuantity') || undefined,
    reason: formData.get('reason'),
  });
  if (!parsed.success) return { fieldErrors: flattenZodErrors(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('open_dispute', {
    p_order_id: parsed.data.orderId,
    p_kind: parsed.data.kind,
    p_order_item_id: parsed.data.kind === 'return' ? parsed.data.orderItemId ?? null : null,
    p_requested_quantity: parsed.data.kind === 'return' ? parsed.data.requestedQuantity ?? null : null,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: userMessageFor(error) };

  revalidatePath(`/buyer/orders/${parsed.data.orderId}`);
  return { success: 'تم فتح النزاع. سيراجعه فريق VENDORA مع المورد.' };
}
