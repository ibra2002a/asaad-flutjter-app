import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { productImageUrl } from '@/lib/storage';
import { PageHeader, Card } from '@/components/ui/card';
import { ProductForm } from '@/components/forms/product-form';
import { ImageUploader } from '@/components/forms/image-uploader';
import { UUID_REGEX } from '@/lib/validation';
import { DeleteProductButton } from '@/components/forms/delete-product-button';

export const metadata: Metadata = { title: 'تعديل المنتج' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession(['supplier']);
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();

  const supabase = await createClient();
  const [productResult, categoriesResult, imagesResult] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).maybeSingle(),
    supabase.from('categories').select('id, name_ar').eq('is_active', true).order('sort_order'),
    supabase.from('product_images').select('id, storage_path').eq('product_id', id).order('sort_order'),
  ]);
  const product = productResult.data;
  if (!product) notFound();
  const canPublish = session.business?.status === 'approved';

  return (
    <div className="space-y-8">
      <PageHeader title={product.name as string} description="تعديل السعر والتوفر والنشر والصور." />
      <ProductForm
        productId={id}
        initial={{
          name: product.name as string,
          description: (product.description as string | null) ?? '',
          categoryId: product.category_id as string,
          unit: product.unit as string,
          priceIqd: product.price_iqd as number,
          minQuantity: product.min_quantity as number,
          stockStatus: product.stock_status as 'in_stock' | 'limited' | 'out_of_stock',
          isPublished: product.is_published as boolean,
        }}
        categories={(categoriesResult.data ?? []) as { id: string; name_ar: string }[]}
        canPublish={canPublish}
      />
      <Card className="space-y-4">
        <h2 className="text-lg font-bold text-brand-900">صور المنتج</h2>
        <ImageUploader
          productId={id}
          images={(imagesResult.data ?? []).map((img) => ({ id: img.id as string, url: productImageUrl(img.storage_path as string) }))}
        />
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-danger">حذف المنتج</p>
          <p className="text-sm text-muted">لا يؤثر الحذف على الطلبات السابقة، فهي تحتفظ بنسخة من الاسم والسعر.</p>
        </div>
        <DeleteProductButton productId={id} />
      </Card>
    </div>
  );
}
