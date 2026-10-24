import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Card } from '@/components/ui/card';
import { ProductForm } from '@/components/forms/product-form';

export const metadata: Metadata = { title: 'منتج جديد' };

export default async function NewProductPage() {
  const session = await requireSession(['supplier']);
  const supabase = await createClient();
  const { data: categories } = await supabase.from('categories').select('id, name_ar').eq('is_active', true).order('sort_order');
  const canPublish = session.business?.status === 'approved';

  return (
    <div className="space-y-6">
      <PageHeader title="إضافة منتج" description="أدخل بيانات المنتج. الأسعار بالدينار العراقي (أعداد صحيحة)." />
      <ProductForm
        initial={{ name: '', description: '', categoryId: '', unit: '', priceIqd: 0, minQuantity: 1, stockStatus: 'in_stock', isPublished: canPublish }}
        categories={(categories ?? []) as { id: string; name_ar: string }[]}
        canPublish={canPublish}
      />
      <Card className="text-sm text-muted">بعد الحفظ يمكنك إضافة حتى 5 صور للمنتج.</Card>
    </div>
  );
}
