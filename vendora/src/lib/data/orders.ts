import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DisputeRow, OrderEventRow, OrderItemRow, OrderRow } from './types';

export interface OrderListItem {
  id: string;
  order_number: string;
  status: OrderRow['status'];
  total_iqd: number;
  created_at: string;
  counterparty: string;
}

/** Orders visible to the signed-in user. RLS limits the rows to the caller's own orders. */
export async function listOrdersFor(role: 'buyer' | 'supplier' | 'admin', status?: string): Promise<OrderListItem[]> {
  const supabase = await createSupabaseServerClient();
  const counterpartyColumn =
    role === 'buyer'
      ? 'counterparty:businesses!orders_supplier_business_id_fkey(legal_name)'
      : 'counterparty:businesses!orders_buyer_business_id_fkey(legal_name)';
  let query = supabase
    .from('orders')
    .select(`id, order_number, status, total_iqd, created_at, ${counterpartyColumn}`)
    .order('created_at', { ascending: false })
    .limit(100);
  if (status) query = query.eq('status', status);
  const { data } = await query;
  return ((data ?? []) as unknown as Array<Omit<OrderListItem, 'counterparty'> & { total_iqd: number; counterparty: { legal_name: string } | null }>).map((row) => ({
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    total_iqd: Number(row.total_iqd),
    created_at: row.created_at,
    counterparty: row.counterparty?.legal_name ?? '',
  }));
}

export async function getOrderDetail(orderId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase
    .from('orders')
    .select(
      'id, order_number, buyer_id, buyer_business_id, supplier_business_id, status, delivery_city_code, delivery_address, subtotal_iqd, delivery_fee_iqd, total_iqd, cancellation_reason, created_at, updated_at, buyer:businesses!orders_buyer_business_id_fkey(legal_name, phone), supplier:businesses!orders_supplier_business_id_fkey(legal_name, phone)',
    )
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return null;

  const [items, events, disputes] = await Promise.all([
    supabase
      .from('order_items')
      .select('id, order_id, product_id, product_name_snapshot, unit_snapshot, unit_price_iqd, quantity, returned_quantity, line_total_iqd, commission_rate_bp')
      .eq('order_id', orderId)
      .order('created_at'),
    supabase
      .from('order_events')
      .select('id, order_id, from_status, to_status, actor_role, reason, created_at')
      .eq('order_id', orderId)
      .order('created_at'),
    supabase
      .from('disputes')
      .select('id, order_id, kind, order_item_id, requested_quantity, reason, status, resolution, resolution_note, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false }),
  ]);

  return {
    order: order as unknown as OrderRow & {
      buyer: { legal_name: string; phone: string } | null;
      supplier: { legal_name: string; phone: string } | null;
    },
    items: (items.data ?? []) as OrderItemRow[],
    events: (events.data ?? []) as OrderEventRow[],
    disputes: (disputes.data ?? []) as DisputeRow[],
  };
}
