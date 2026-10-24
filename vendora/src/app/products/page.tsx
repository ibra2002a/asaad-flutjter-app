import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatIQD } from '@/lib/format';
import { STOCK_LABELS } from '@/lib/labels';
import { Badge, EmptyState, PageHeader } from '@/components/ui/card';
import { inputClass } from '@/components/ui/field';
import { buttonClass } from '@/components/ui/button-styles';
import { productImageUrl } from '@/lib/storage';
import type { ProductImage, ProductRow } from '@/lib/types';

export const metadata: Metadata = { title: 'المنتجات' };

type SearchParams = { q?: string; category?: string; city?: string };

/** Removes characters that have meaning in PostgREST filter syntax before using a search term. */
function cleanSearch(value: string | undefined): string {
  return (value ?? '').replace(/[%_,()*\\]/g, '').trim().slice(0, 60);
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = cleanSearch(params.q);
  const supabase = await createClient();

  const [categoriesResult, citiesResult] = await Promise.all([
    supabase.from('categories').select('id, slug, name_ar').eq('is_active', true).order('sort_order'),
    supabase.from('cities').select('code, name_ar').order('sort_order'),
  ]);
  const categories = (categoriesResult.data ?? []) as { id: string; slug: string; name_ar: string }[];
  const cities = (citiesResult.data ?? []) as { code: string; name_ar: string }[];

  let query = supabase
    .from('products')
    .select('id, name, unit, price_iqd, min_quantity, stock_status, business_id, category_id, is_published, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(60);

  if (q) query = query.ilike('name', `%${q}%`);

  const selectedCategory = categories.find((c) => c.slug === params.category);
  if (selectedCategory) query = query.eq('category_id', selectedCategory.id);

  if (params.city && cities.some((c) => c.code === params.city)) {
    const { data: coverage } = await supabase.from('supplier_coverage').select('business_id').eq('city_code', params.city);
    const businessIds = [...new Set((coverage ?? []).map((c) => c.business_id as string))];
    if (businessIds.length === 0) {
      query = query.in('business_id', ['00000000-0000-0000-0000-000000000000']);
    } else {
      query = query.in('business_id', businessIds);
    }
  }

  const { data: productData } = await query;
  const products = (productData ?? []) as ProductRow[];

  const productIds = products.map((p) => p.id);
  const businessIds = [...new Set(products.map((p) => p.business_id))];
  const [suppliersResult, imagesResult] = await Promise.all([
    businessIds.length
      ? supabase.from('supplier_directory').select('id, name').in('id', businessIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    productIds.length
      ? supabase.from('product_images').select('id, product_id, storage_path, sort_order').in('product_id', productIds).order('sort_order')
      : Promise.resolve({ data: [] as ProductImage[] }),
  ]);
  const supplierNames = new Map((suppliersResult.data ?? []).map((s) => [s.id as string, s.name as string]));
  const firstImage = new Map<string, ProductImage>();
  for (const image of (imagesResult.data ?? []) as ProductImage[]) {
    if (!firstImage.has(image.product_id)) firstImage.set(image.product_id, image);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <PageHeader title="المنتجات" description="تصفّح منتجات الجملة من الموردين المعتمدين. الأسعار بالدينار العراقي." />

      <form className="grid gap-4 rounded-2xl border border-line bg-brand-50/40 p-4 sm:grid-cols-[1fr_200px_200px_auto] sm:items-end">
        <label className="space-y-1.5">
          <span className="block text-sm font-semibold">ابحث باسم المنتج</span>
          <input name="q" defaultValue={q} placeholder="مثال: رز، زيت، شاي" className={inputClass} type="search" />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-semibold">الفئة</span>
          <select name="category" defaultValue={selectedCategory?.slug ?? ''} className={inputClass}>
            <option value="">كل الفئات</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name_ar}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-semibold">التوصيل إلى</span>
          <select name="city" defaultValue={params.city ?? ''} className={inputClass}>
            <option value="">كل المحافظات</option>
            {cities.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name_ar}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass('primary')}>
          بحث
        </button>
      </form>

      {products.length === 0 ? (
        <EmptyState title="لا توجد منتجات مطابقة" description="جرّب كلمات بحث أخرى أو غيّر المحافظة أو الفئة." />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="قائمة المنتجات">
          {products.map((product) => {
            const image = firstImage.get(product.id);
            return (
              <li key={product.id}>
                <Link
                  href={`/products/${product.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-lg"
                >
                  <div className="relative aspect-4/3 bg-brand-50">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL; avoids image-optimizer quota
                      <img src={productImageUrl(image.storage_path)} alt={product.name} loading="lazy" className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center text-sm text-muted">بدون صورة</div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted">{supplierNames.get(product.business_id) ?? 'مورد معتمد'}</p>
                      <h2 className="line-clamp-2 font-semibold text-brand-900 group-hover:text-brand-600">{product.name}</h2>
                    </div>
                    <div className="mt-auto flex items-end justify-between gap-2">
                      <p className="text-lg font-bold text-brand-900 tabular">
                        {formatIQD(product.price_iqd)}
                        <span className="text-xs font-normal text-muted"> / {product.unit}</span>
                      </p>
                      <Badge tone={product.stock_status === 'out_of_stock' ? 'danger' : product.stock_status === 'limited' ? 'warning' : 'success'}>
                        {STOCK_LABELS[product.stock_status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted">الحد الأدنى للطلب: {product.min_quantity}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-center text-xs text-muted">يعرض الكتالوج أحدث 60 منتجاً مطابقاً.</p>
    </div>
  );
}
