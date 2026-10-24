import type { Metadata } from 'next';
import Link from 'next/link';
import { listCategories, listProducts, PAGE_SIZE, sanitizeSearch, type ProductFilters } from '@/lib/data/catalog';
import { ProductCard } from '@/components/ProductCard';
import { EmptyState, Input, PageHeader, Select, buttonClass } from '@/components/ui';

export const metadata: Metadata = { title: 'المنتجات' };

type SearchParams = Promise<{ q?: string; category?: string; sort?: string; page?: string }>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const sort = params.sort === 'price_asc' || params.sort === 'price_desc' ? params.sort : 'newest';
  const filters: ProductFilters = {
    q: sanitizeSearch(params.q),
    category: params.category,
    sort,
    page: Math.max(1, Number(params.page) || 1),
  };

  const [categories, { items, total }] = await Promise.all([listCategories(), listProducts(filters)]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (page: number) => {
    const search = new URLSearchParams();
    if (filters.q) search.set('q', filters.q);
    if (filters.category) search.set('category', filters.category);
    if (sort !== 'newest') search.set('sort', sort);
    if (page > 1) search.set('page', String(page));
    const query = search.toString();
    return query ? `/products?${query}` : '/products';
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader eyebrow="كتالوج الجملة" title="المنتجات" description={`${total.toLocaleString('ar-IQ')} منتج معتمد من موردين موثقين`} />

      <form method="get" role="search" aria-label="بحث وتصفية المنتجات" className="mb-8 grid gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm sm:grid-cols-[1fr_200px_180px_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-semibold text-brand-950">ابحث باسم المنتج</label>
          <Input id="q" name="q" type="search" defaultValue={filters.q} placeholder="مثال: زيت، رز، منظفات" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-sm font-semibold text-brand-950">الفئة</label>
          <Select id="category" name="category" defaultValue={filters.category ?? ''}>
            <option value="">كل الفئات</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name_ar}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sort" className="text-sm font-semibold text-brand-950">ترتيب</label>
          <Select id="sort" name="sort" defaultValue={sort}>
            <option value="newest">الأحدث</option>
            <option value="price_asc">السعر: من الأقل</option>
            <option value="price_desc">السعر: من الأعلى</option>
          </Select>
        </div>
        <button type="submit" className={buttonClass('primary', 'w-full sm:w-auto')}>تطبيق</button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="لا توجد منتجات تطابق بحثك"
          description="جرّب كلمات أخرى أو اختر فئة مختلفة. يتم اعتماد المنتجات الجديدة من فريق المراجعة قبل نشرها."
          action={<Link href="/products" className={buttonClass('secondary')}>عرض كل المنتجات</Link>}
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {totalPages > 1 ? (
            <nav aria-label="تنقل الصفحات" className="mt-10 flex items-center justify-center gap-3">
              {filters.page! > 1 ? <Link href={pageHref(filters.page! - 1)} className={buttonClass('secondary')}>السابق</Link> : null}
              <span className="ltr-num text-sm font-semibold text-muted">{filters.page} / {totalPages}</span>
              {filters.page! < totalPages ? <Link href={pageHref(filters.page! + 1)} className={buttonClass('secondary')}>التالي</Link> : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
