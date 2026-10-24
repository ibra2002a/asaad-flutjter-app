import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Dashboard metrics computed directly from the database. */
export async function getAdminMetrics() {
  const supabase = await createSupabaseServerClient();

  const [pendingSuppliers, approvedSuppliers, activeBuyers, activeProducts, pendingProducts, openDisputes, orders, commissions] =
    await Promise.all([
      supabase.from('businesses').select('id', { count: 'exact', head: true }).eq('kind', 'supplier').eq('verification_status', 'pending'),
      supabase.from('businesses').select('id', { count: 'exact', head: true }).eq('kind', 'supplier').eq('verification_status', 'approved'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'buyer').eq('is_active', true),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
      supabase.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('orders').select('status, total_iqd, created_at'),
      supabase.from('commissions').select('commission_iqd, eligible_base_iqd, status'),
    ]);

  const orderRows = (orders.data ?? []) as Array<{ status: string; total_iqd: number; created_at: string }>;
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const statusCounts: Record<string, number> = {};
  for (const o of orderRows) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;

  const commissionRows = (commissions.data ?? []) as Array<{ commission_iqd: number; eligible_base_iqd: number; status: string }>;
  const sum = (rows: typeof commissionRows, key: 'commission_iqd' | 'eligible_base_iqd') => rows.reduce((s, r) => s + Number(r[key]), 0);

  return {
    pendingSuppliers: pendingSuppliers.count ?? 0,
    approvedSuppliers: approvedSuppliers.count ?? 0,
    activeBuyers: activeBuyers.count ?? 0,
    activeProducts: activeProducts.count ?? 0,
    pendingProducts: pendingProducts.count ?? 0,
    openDisputes: openDisputes.count ?? 0,
    ordersTotal: orderRows.length,
    ordersToday: orderRows.filter((o) => new Date(o.created_at) >= startOfToday).length,
    ordersByStatus: statusCounts,
    grossCompletedSales: orderRows
      .filter((o) => o.status === 'completed')
      .reduce((s, o) => s + Number(o.total_iqd), 0),
    commissionAccrued: sum(commissionRows.filter((r) => r.status === 'accrued'), 'commission_iqd'),
    commissionSettled: sum(commissionRows.filter((r) => r.status === 'settled'), 'commission_iqd'),
    eligibleSales: sum(commissionRows, 'eligible_base_iqd'),
  };
}
