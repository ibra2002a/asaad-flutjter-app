import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatIQD } from '@/lib/format';
import { STOCK_LABELS } from '@/lib/labels';
import { Badge, EmptyState, PageHeader } from '@/components/ui/card';
import { buttonClass } from '@/components/ui/button-styles';

export const metadata: Metadata = { title: 'منتجاتي' };

export default async function SupplierProductsPage() {
  await requireSession(['supplier']);
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select('id, name, unit, price_iqd, min_quantity, stock_status, is_published')
    .order('created_at', { ascending: false });
  const products = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="منتجاتي"
        description="إدارة الأسعار والمخزون والنشر. لا يمكنك تعديل منتجات مورد آخر."
        actions={
          <Link href="/supplier/products/new" className={buttonClass('accent')}>
            منتج جديد
          </Link>
        }
      />
      {products.length === 0 ? (
        <EmptyState title="لا توجد منتجات بعد" description="أضف أول منتج لتبدأ في استقبال الطلبات بعد اعتماد حسابك." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-brand-50 text-right text-brand-900">
                <tr>
                  <th scope="col" className="px-4 py-3">المنتج</th>
                  <th scope="col" className="px-4 py-3">السعر</th>
                  <th scope="col" className="px-4 py-3">الحد الأدنى</th>
                  <th scope="col" className="px-4 py-3">التوفر</th>
                  <th scope="col" className="px-4 py-3">الحالة</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">إجراءات</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {products.map((p) => (
                  <tr key={p.id as string}>
                    <td className="px-4 py-3 font-semibold">{p.name as string}</td>
                    <td className="px-4 py-3 tabular">{formatIQD(p.price_iqd as number)} / {p.unit as string}</td>
                    <td className="px-4 py-3 tabular">{p.min_quantity as number}</td>
                    <td className="px-4 py-3">{STOCK_LABELS[p.stock_status as keyof typeof STOCK_LABELS]}</td>
                    <td className="px-4 py-3">
                      <Badge tone={p.is_published ? 'success' : 'neutral'}>{p.is_published ? 'منشور' : 'مسودة'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <Link href={`/supplier/products/${p.id}`} className="font-semibold text-brand-700 underline">
                        تعديل
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
