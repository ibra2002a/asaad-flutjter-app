'use server';

import { createClient } from '@/lib/supabase/server';
import { fail, type ActionResult } from '@/lib/action-result';
import { UUID_REGEX } from '@/lib/validation';

export type CartProduct = {
  id: string;
  name: string;
  unit: string;
  price_iqd: number;
  min_quantity: number;
  stock_status: 'in_stock' | 'limited' | 'out_of_stock';
  business_id: string;
  supplier_name: string;
};

/**
 * Current price and availability for products in the cart. Reads through RLS, so only
 * published products of approved suppliers are returned. Used for display only.
 */
export async function getCartProductsAction(productIds: string[]): Promise<ActionResult<CartProduct[]>> {
  const ids = productIds.filter((id) => UUID_REGEX.test(id)).slice(0, 50);
  if (ids.length === 0) return { ok: true, data: [] };

  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, unit, price_iqd, min_quantity, stock_status, business_id')
    .in('id', ids);
  if (error) return fail('تعذر تحميل بيانات السلة.');

  const businessIds = [...new Set((products ?? []).map((p) => p.business_id as string))];
  const { data: suppliers } = await supabase.from('supplier_directory').select('id, name').in('id', businessIds);
  const names = new Map((suppliers ?? []).map((s) => [s.id as string, s.name as string]));

  return {
    ok: true,
    data: (products ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      unit: p.unit as string,
      price_iqd: p.price_iqd as number,
      min_quantity: p.min_quantity as number,
      stock_status: p.stock_status as CartProduct['stock_status'],
      business_id: p.business_id as string,
      supplier_name: names.get(p.business_id as string) ?? '',
    })),
  };
}
