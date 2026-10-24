import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { OrderRow, OrderStatus, Role } from '@/lib/types';

export type OrderItemRow = {
  id: string;
  product_name: string;
  product_unit: string;
  unit_price_iqd: number;
  quantity: number;
  line_total_iqd: number;
};

export type OrderEventRow = {
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor_role: Role;
  note: string | null;
  created_at: string;
};

export type DisputeRow = {
  id: string;
  reason: string;
  status: 'open' | 'resolved_completed' | 'resolved_cancelled';
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type OrderDetail = {
  order: OrderRow & { delivery_city_name: string };
  items: OrderItemRow[];
  events: OrderEventRow[];
  disputes: DisputeRow[];
  buyerBusiness: { name: string; city_name: string } | null;
  supplierBusiness: { name: string; city_name: string } | null;
};

/**
 * Loads everything shown on an order page. Row visibility comes from RLS, so a buyer, supplier
 * or staff member gets null for orders they are not allowed to see.
 */
export async function loadOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const { data: orderData } = await supabase
    .from('orders')
    .select('*, cities:delivery_city_code(name_ar)')
    .eq('id', orderId)
    .maybeSingle();
  if (!orderData) return null;

  const [itemsResult, eventsResult, disputesResult, businessesResult] = await Promise.all([
    supabase.from('order_items').select('id, product_name, product_unit, unit_price_iqd, quantity, line_total_iqd').eq('order_id', orderId).order('product_name'),
    supabase.from('order_events').select('from_status, to_status, actor_role, note, created_at').eq('order_id', orderId).order('created_at'),
    supabase.from('disputes').select('id, reason, status, resolution_note, created_at, resolved_at').eq('order_id', orderId).order('created_at', { ascending: false }),
    supabase
      .from('businesses')
      .select('id, name, cities:city_code(name_ar)')
      .in('id', [orderData.buyer_business_id as string, orderData.supplier_business_id as string]),
  ]);

  const city = (value: unknown) => (value as { name_ar: string } | null)?.name_ar ?? '';
  const businesses = (businessesResult.data ?? []) as Array<{ id: string; name: string; cities: unknown }>;
  const toBusiness = (id: string) => {
    const b = businesses.find((x) => x.id === id);
    return b ? { name: b.name, city_name: city(b.cities) } : null;
  };

  const { cities, ...order } = orderData as Record<string, unknown> & { cities: unknown };
  return {
    order: { ...(order as unknown as OrderRow), delivery_city_name: city(cities) },
    items: (itemsResult.data ?? []) as OrderItemRow[],
    events: (eventsResult.data ?? []) as OrderEventRow[],
    disputes: (disputesResult.data ?? []) as DisputeRow[],
    buyerBusiness: toBusiness(orderData.buyer_business_id as string),
    supplierBusiness: toBusiness(orderData.supplier_business_id as string),
  };
}
