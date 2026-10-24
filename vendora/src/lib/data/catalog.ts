import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Category, City } from './types';

export const PAGE_SIZE = 12;

export interface ProductCardData {
  id: string;
  nameAr: string;
  unit: string;
  priceIqd: number;
  salePriceIqd: number | null;
  minOrderQty: number;
  stockQty: number;
  supplierId: string;
  supplierName: string;
  supplierCity: string;
  categoryName: string;
  imageUrl: string | null;
}

export interface ProductFilters {
  q?: string;
  category?: string;
  supplierId?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc';
  page?: number;
}

/** Strips characters that have special meaning in SQL LIKE patterns. */
export function sanitizeSearch(value: string | undefined): string {
  return (value ?? '').replace(/[%_\\,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export async function listCategories(): Promise<Category[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('categories')
    .select('id, slug, name_ar, description_ar, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order');
  return (data ?? []) as Category[];
}

export async function listCities(): Promise<City[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('cities').select('code, name_ar').eq('is_active', true).order('name_ar');
  return (data ?? []) as City[];
}

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Public storage URL for a product image. Bucket is public-read; no network call is needed. */
export function imageUrlFor(supabase: SupabaseServer, path: string): string {
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}

type ProductRow = {
  id: string;
  name_ar: string;
  unit: string;
  price_iqd: number;
  sale_price_iqd: number | null;
  min_order_qty: number;
  stock_qty: number;
  supplier_id: string;
  supplier: { legal_name: string; city_code: string } | null;
  category: { name_ar: string; slug: string } | null;
  images: Array<{ storage_path: string; position: number }> | null;
};

export async function listProducts(filters: ProductFilters): Promise<{ items: ProductCardData[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('products')
    .select(
      'id, name_ar, unit, price_iqd, sale_price_iqd, min_order_qty, stock_qty, supplier_id, supplier:businesses!products_supplier_id_fkey(legal_name, city_code), category:categories!products_category_id_fkey(name_ar, slug), images:product_images(storage_path, position)',
      { count: 'exact' },
    )
    .eq('status', 'active');

  const q = sanitizeSearch(filters.q);
  if (q) {
    query = query.ilike('name_ar', `%${q}%`);
  }
  if (filters.supplierId) {
    query = query.eq('supplier_id', filters.supplierId);
  }
  if (filters.category) {
    const cat = (await listCategories()).find((c) => c.slug === filters.category);
    if (cat) query = query.eq('category_id', cat.id);
  }

  if (filters.sort === 'price_asc') query = query.order('price_iqd', { ascending: true });
  else if (filters.sort === 'price_desc') query = query.order('price_iqd', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as ProductRow[];

  const items: ProductCardData[] = rows.map((row) => ({
      id: row.id,
      nameAr: row.name_ar,
      unit: row.unit,
      priceIqd: Number(row.price_iqd),
      salePriceIqd: row.sale_price_iqd === null ? null : Number(row.sale_price_iqd),
      minOrderQty: Number(row.min_order_qty),
      stockQty: Number(row.stock_qty),
      supplierId: row.supplier_id,
      supplierName: row.supplier?.legal_name ?? '',
      supplierCity: row.supplier?.city_code ?? '',
      categoryName: row.category?.name_ar ?? '',
      imageUrl: row.images && row.images.length > 0 ? imageUrlFor(supabase, firstImagePath(row.images)) : null,
  }));

  return { items, total: count ?? 0 };
}

function firstImagePath(images: Array<{ storage_path: string; position: number }>): string {
  return [...images].sort((a, b) => a.position - b.position)[0]!.storage_path;
}

export async function getPublicProduct(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('products')
    .select(
      'id, name_ar, description_ar, unit, price_iqd, sale_price_iqd, min_order_qty, max_order_qty, stock_qty, supplier_id, status, supplier:businesses!products_supplier_id_fkey(id, legal_name, city_code, description_ar, verification_status), category:categories!products_category_id_fkey(name_ar, slug), images:product_images(storage_path, position)',
    )
    .eq('id', id)
    .maybeSingle();
  if (!data || data.status !== 'active') return null;
  const row = data as unknown as ProductRow & {
    description_ar: string | null;
    max_order_qty: number | null;
    supplier: { id: string; legal_name: string; city_code: string; description_ar: string | null } | null;
  };
  const images = [...(row.images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((img) => imageUrlFor(supabase, img.storage_path));
  return {
    id: row.id,
    nameAr: row.name_ar,
    descriptionAr: row.description_ar,
    unit: row.unit,
    priceIqd: Number(row.price_iqd),
    salePriceIqd: row.sale_price_iqd === null ? null : Number(row.sale_price_iqd),
    minOrderQty: Number(row.min_order_qty),
    maxOrderQty: row.max_order_qty === null ? null : Number(row.max_order_qty),
    stockQty: Number(row.stock_qty),
    supplierId: row.supplier_id,
    supplier: row.supplier,
    categoryName: row.category?.name_ar ?? '',
    images,
  };
}

export async function listApprovedSuppliers() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('businesses')
    .select('id, legal_name, description_ar, city_code')
    .eq('kind', 'supplier')
    .eq('verification_status', 'approved')
    .order('legal_name')
    .limit(60);
  const suppliers = (data ?? []) as Array<{ id: string; legal_name: string; description_ar: string | null; city_code: string }>;
  const coverage = await supabase.from('supplier_coverage').select('business_id, city_code');
  const coverageRows = (coverage.data ?? []) as Array<{ business_id: string; city_code: string }>;
  return suppliers.map((s) => ({
    ...s,
    cities: coverageRows.filter((c) => c.business_id === s.id).map((c) => c.city_code),
  }));
}

export async function getApprovedSupplier(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('businesses')
    .select('id, legal_name, description_ar, city_code, verification_status')
    .eq('id', id)
    .eq('kind', 'supplier')
    .maybeSingle();
  if (!data || data.verification_status !== 'approved') return null;
  const { data: cov } = await supabase.from('supplier_coverage').select('city_code').eq('business_id', id);
  return {
    id: data.id as string,
    legalName: data.legal_name as string,
    descriptionAr: data.description_ar as string | null,
    cityCode: data.city_code as string,
    coverage: ((cov ?? []) as Array<{ city_code: string }>).map((c) => c.city_code),
  };
}

