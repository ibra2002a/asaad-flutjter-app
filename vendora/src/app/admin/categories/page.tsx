import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHeader, Badge } from '@/components/ui';
import { CategoryForm, type CategoryFormValues } from '@/components/forms/CategoryForm';

export const metadata: Metadata = { title: 'الفئات' };

export default async function AdminCategoriesPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('categories')
    .select('id, slug, name_ar, description_ar, sort_order, is_active')
    .order('sort_order');
  const categories = (data ?? []) as CategoryFormValues[];

  return (
    <>
      <PageHeader title="الفئات" description="الفئات غير المفعّلة تختفي من الواجهة ومن البحث، والمنتجات بها لا تُباع." />
      <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
        <ul className="space-y-3">
          {categories.map((c) => (
            <li key={c.id}>
              <details className="group rounded-2xl border border-line bg-white p-5 shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="font-bold text-brand-950">{c.name_ar}</span>
                    <span className="ltr-num ms-2 text-xs text-muted">{c.slug}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {c.is_active ? <Badge tone="brand">مفعّلة</Badge> : <Badge tone="neutral">متوقفة</Badge>}
                    <span className="text-sm font-semibold text-brand-700 group-open:hidden">تعديل</span>
                  </span>
                </summary>
                <div className="mt-5 border-t border-line pt-5">
                  <CategoryForm category={c} />
                </div>
              </details>
            </li>
          ))}
        </ul>
        <div>
          <CategoryForm />
        </div>
      </div>
    </>
  );
}
