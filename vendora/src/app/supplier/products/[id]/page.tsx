import type { Metadata } from 'next';
import { ActionForm } from '@/components/ActionForm';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { imageUrlFor, listCategories } from '@/lib/data/catalog';
import { getMyBusiness } from '@/lib/session';
import { canSellProducts } from '@/lib/domain/authz';
import { deleteProductImageAction } from '@/lib/actions/supplier';
import { ProductForm, type ProductFormValues } from '@/components/forms/ProductForm';
import { ProductStatusBadge } from '@/components/StatusBadge';
import { SubmitButton } from '@/components/SubmitButton';
import { Badge, Card, PageHeader } from '@/components/ui';
import { QueryNotice } from '@/components/FormMessage';
import { uuidSchema } from '@/lib/validation/schemas';

export const metadata: Metadata = { title: 'تعديل المنتج' };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ notice?: string; error?: string }>;

export default async function EditProductPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const query = await searchParams;
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('products')
    .select('id, category_id, name_ar, description_ar, unit, price_iqd, sale_price_iqd, min_order_qty, max_order_qty, stock_qty, status, moderation_note, images:product_images(id, storage_path, position)')
    .eq('id', id)
    .maybeSingle();
  if (!data) notFound();

  const [categories, business] = await Promise.all([listCategories(), getMyBusiness()]);
  const canPublish = canSellProducts(business ? { kind: business.kind, verificationStatus: business.verification_status } : null);
  const images = [...((data.images ?? []) as Array<{ id: string; storage_path: string; position: number }>)].sort((a, b) => a.position - b.position);

  const values: ProductFormValues = {
    id: data.id as string,
    categoryId: data.category_id as string,
    nameAr: data.name_ar as string,
    descriptionAr: (data.description_ar as string | null) ?? '',
    unit: data.unit as string,
    priceIqd: Number(data.price_iqd),
    salePriceIqd: data.sale_price_iqd === null ? null : Number(data.sale_price_iqd),
    minOrderQty: Number(data.min_order_qty),
    maxOrderQty: data.max_order_qty === null ? null : Number(data.max_order_qty),
    stockQty: Number(data.stock_qty),
    status: data.status as ProductFormValues['status'],
    moderationNote: data.moderation_note as string | null,
  };

  return (
    <>
      <nav className="mb-4 text-sm text-muted">
        <Link href="/supplier/products" className="hover:text-brand-800">منتجاتي</Link>
      </nav>
      <PageHeader
        title={values.nameAr}
        actions={<ProductStatusBadge status={values.status} />}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {values.status === 'active' ? (
          <Link href={`/products/${values.id}`} className="text-sm font-semibold text-brand-700 hover:underline">عرض صفحة المنتج للعموم</Link>
        ) : (
          <Badge tone="neutral">لن يظهر للتجار قبل الاعتماد</Badge>
        )}
      </div>
      <div className="mb-6"><QueryNotice notice={query.notice} error={query.error} /></div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <ProductForm categories={categories} product={values} canPublish={canPublish} />

        <aside className="space-y-4">
          <Card>
            <h2 className="mb-4 text-lg font-bold text-brand-950">الصور الحالية</h2>
            {images.length === 0 ? (
              <p className="text-sm text-muted">لا توجد صور بعد. أضف صورة واضحة لتزيد فرص البيع.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3">
                {images.map((image) => (
                  <li key={image.id} className="space-y-2">
                    <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-brand-50">
                      <Image src={imageUrlFor(supabase, image.storage_path)} alt="" fill sizes="160px" className="object-cover" />
                    </div>
                    <ActionForm action={deleteProductImageAction}>
                      <input type="hidden" name="imageId" value={image.id} />
                      <input type="hidden" name="productId" value={values.id} />
                      <SubmitButton variant="ghost" pendingLabel="…" className="min-h-9 w-full text-xs text-red-700">حذف الصورة</SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
