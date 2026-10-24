'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fail, type ActionResult } from '@/lib/action-result';
import { getSession } from '@/lib/auth';
import { messageForDbError } from '@/lib/errors';
import { checkoutSchema, disputeSchema, fieldErrorsFrom, resolveDisputeSchema, statusChangeSchema } from '@/lib/validation';

/**
 * Places an order. The browser sends only product ids, quantities and delivery choices.
 * Prices, names, stock, minimums and coverage are all checked by the database function place_order().
 */
export async function placeOrderAction(input: unknown): Promise<ActionResult<{ orderId: string }>> {
  const session = await getSession();
  if (!session || session.viewer.role !== 'buyer') return fail('هذا الإجراء متاح للمشترين فقط.');

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return fail('تحقق من بيانات الطلب.', fieldErrorsFrom(parsed.error));
  const data = parsed.data;

  const supabase = await createClient();

  // Separate transaction: the attempt is counted even if the order is rejected.
  const { data: allowed, error: limitError } = await supabase.rpc('consume_rate_limit', {
    p_action: 'place_order',
    p_max: 20,
    p_window_seconds: 600,
  });
  if (limitError) return fail(messageForDbError(limitError));
  if (allowed === false) return fail('عدد الطلبات كبير في وقت قصير. حاول بعد قليل.');

  const { data: orderId, error } = await supabase.rpc('place_order', {
    p_items: data.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
    p_address_id: data.addressId,
    p_payment_method: data.paymentMethod,
    p_contact_phone: data.contactPhone,
    p_buyer_notes: data.buyerNotes ?? null,
    p_idempotency_key: data.idempotencyKey,
  });
  if (error) return fail(messageForDbError(error));

  revalidatePath('/orders');
  return { ok: true, data: { orderId: orderId as string } };
}

/** Generic status change for the roles allowed by the transition matrix (checked again in the database). */
export async function transitionOrderAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail('يجب تسجيل الدخول أولاً.');
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return fail('بيانات غير صالحة.', fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc('transition_order', {
    p_order_id: parsed.data.orderId,
    p_to_status: parsed.data.toStatus,
    p_note: parsed.data.note ?? null,
  });
  if (error) return fail(messageForDbError(error));

  revalidatePath('/orders');
  revalidatePath('/supplier/orders');
  revalidatePath('/admin/orders');
  revalidatePath('/admin');
  return { ok: true, message: 'تم تحديث حالة الطلب.' };
}

export async function openDisputeAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return fail('يجب تسجيل الدخول أولاً.');
  const parsed = disputeSchema.safeParse(input);
  if (!parsed.success) return fail('تحقق من سبب النزاع.', fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc('open_dispute', {
    p_order_id: parsed.data.orderId,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(messageForDbError(error));

  revalidatePath('/orders');
  revalidatePath(`/orders/${parsed.data.orderId}`);
  revalidatePath('/admin/disputes');
  return { ok: true, message: 'تم فتح النزاع. سيراجعه فريق العمليات.' };
}

export async function resolveDisputeAction(input: unknown): Promise<ActionResult> {
  const session = await getSession();
  if (!session || !['ops', 'admin'].includes(session.viewer.role)) return fail('ليست لديك صلاحية لهذا الإجراء.');
  const parsed = resolveDisputeSchema.safeParse(input);
  if (!parsed.success) return fail('تحقق من بيانات القرار.', fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc('resolve_dispute', {
    p_dispute_id: parsed.data.disputeId,
    p_outcome: parsed.data.outcome,
    p_note: parsed.data.note,
  });
  if (error) return fail(messageForDbError(error));

  revalidatePath('/admin/disputes');
  revalidatePath('/admin/orders');
  revalidatePath('/admin/commissions');
  return { ok: true, message: 'تم تسجيل قرار النزاع.' };
}
