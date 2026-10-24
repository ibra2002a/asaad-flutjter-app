import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Badge, Card, PageHeader } from '@/components/ui/card';
import { CategoryForm, CategoryToggle } from '@/components/admin/admin-controls';

export const metadata: Metadata = { title: 'الفئات' };

export default async function CategoriesPage() {
  await requireSession(['admin']);
  const supabase = await createClient();
  const { data } = await supabase.from('categories').select('id, slug, name_ar, is_active, sort_order').order('sort_order');
  const categories = (data ?? []) as Array<{ id: string; slug: string; name_ar: string; is_active: boolean; sort_order: number }>;

  return (
    <div className="space-y-8">
      <PageHeader title="الفئات" description="فئات المنتجات تظهر في فلتر الكتالوج. الإخفاء لا يحذف المنتجات الموجودة." />
      <Card>
        <h2 className="mb-4 font-semibold text-brand-900">إضافة فئة</h2>
        <CategoryForm />
      </Card>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-brand-50 text-right">
              <tr>
                <th scope="col" className="px-4 py-3">الاسم</th>
                <th scope="col" className="px-4 py-3">المعرّف</th>
                <th scope="col" className="px-4 py-3">الترتيب</th>
                <th scope="col" className="px-4 py-3">الحالة</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">إجراء</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-semibold">{c.name_ar}</td>
                  <td className="px-4 py-3 font-mono" dir="ltr">{c.slug}</td>
                  <td className="px-4 py-3 tabular">{c.sort_order}</td>
                  <td className="px-4 py-3"><Badge tone={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'ظاهرة' : 'مخفية'}</Badge></td>
                  <td className="px-4 py-3 text-left"><CategoryToggle categoryId={c.id} isActive={c.is_active} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
