import type { Metadata } from 'next';
import Link from 'next/link';
import { listCategories } from '@/lib/data/catalog';
import { Card, EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'الفئات' };

export default async function CategoriesPage() {
  const categories = await listCategories();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="تصفح حسب النشاط"
        title="فئات المنتجات"
        description="اختر الفئة المناسبة لتجارتك لتجد موردين معتمدين ومنتجات بأسعار الجملة."
      />
      {categories.length === 0 ? (
        <EmptyState title="لا توجد فئات بعد" description="ستظهر الفئات هنا فور تفعيلها من لوحة الإدارة." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <Link key={category.id} href={`/products?category=${category.slug}`} className="group focus-visible:outline-none">
              <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-brand-300 group-hover:shadow-md">
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-lime-300 text-brand-900" aria-hidden="true">
                  <span className="text-lg font-black">{category.name_ar.charAt(0)}</span>
                </div>
                <h2 className="text-lg font-bold text-brand-950">{category.name_ar}</h2>
                {category.description_ar ? <p className="mt-1 text-sm text-muted">{category.description_ar}</p> : null}
                <p className="mt-4 text-sm font-semibold text-brand-700 group-hover:underline">عرض المنتجات ←</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
