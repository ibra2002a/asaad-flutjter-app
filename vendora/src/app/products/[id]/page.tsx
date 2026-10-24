import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatIQD } from '@/lib/format';
import { STOCK_LABELS } from '@/lib/labels';
import { UUID_REGEX } from '@/lib/validation';
import { AddToCartButton } from '@/components/cart/add-to-cart';
import { Badge, Card } from '@/components/ui/card';
import { productImageUrl } from '@/lib/storage';
import type { ProductImage, ProductRow } from '@/lib/types';

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) return { title: 'منتج غير موجود' };
  const supabase = await createClient();
  const { data } = await supabase.from('products').select('name').eq('id', id).maybeSingle();
  return { title: data?.name ?? 'منتج غير موجود' };
}

export default async function ProductDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();

  const supabase = await createClient();
  // RLS returns the row only when it is published and the supplier is approved.
  const { data: productData } = await supabase
    .from('products')
    .select('id, name, description, unit, price_iqd, min_quantity, stock_status, business_id, category_id, is_published, created_at')
    .eq('id', id)
    .maybeSingle();
  if (!productData) notFound();
  const product = productData as ProductRow;

  const [supplierResult, categoryResult, coverageResult, imagesResult] = await Promise.all([
    supabase.from('supplier_directory').select('id, name, description, city_code').eq('id', product.business_id).maybeSingle(),
    supabase.from('categories').select('name_ar, slug').eq('id', product.category_id).maybeSingle(),
    supabase.from('supplier_coverage').select('city_code').eq('business_id', product.business_id),
    supabase.from('product_images').select('id, product_id, storage_path, sort_order').eq('product_id', product.id).order('sort_order'),
  ]);

  const supplier = supplierResult.data as { id: string; name: string; description: string | null; city_code: string } | null;
  const category = categoryResult.data as { name_ar: string; slug: string } | null;
  const images = (imagesResult.data ?? []) as ProductImage[];
  const coverageCodes = (coverageResult.data ?? []).map((c) => c.city_code as string);

  const { data: cities } = await supabase.from('cities').select('code, name_ar').in('code', coverageCodes.length ? coverageCodes : ['_none_']);
  const cityNames = (cities ?? []).map((c) => c.name_ar as string);

  const unavailable = product.stock_status === 'out_of_stock';

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <nav aria-label="مسار التنقل" className="text-sm text-muted">
        <Link href="/products" className="hover:text-brand-700">
          المنتجات
        </Link>
        {category ? (
          <>
            <span className="mx-2">/</span>
            <Link href={`/products?category=${category.slug}`} className="hover:text-brand-700">
              {category.name_ar}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-label="صور المنتج" className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-brand-50">
            {images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL
              <img src={productImageUrl(images[0].storage_path)} alt={product.name} className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center text-muted">لا توجد صورة لهذا المنتج</div>
            )}
          </div>
          {images.length > 1 ? (
            <ul className="grid grid-cols-4 gap-3">
              {images.slice(1).map((img) => (
                <li key={img.id} className="aspect-square overflow-hidden rounded-lg border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL */}
                  <img src={productImageUrl(img.storage_path)} alt="" loading="lazy" className="size-full object-cover" />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-brand-900">{product.name}</h1>
            <p className="text-sm text-muted">
              المورد:{' '}
              <span className="font-semibold text-ink">{supplier?.name ?? 'مورد معتمد'}</span>
            </p>
            <p className="text-3xl font-bold text-brand-800 tabular">
              {formatIQD(product.price_iqd)}
              <span className="text-base font-normal text-muted"> / {product.unit}</span>
            </p>
          </div>

          <Card>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-muted">الوحدة</dt>
                <dd className="font-semibold">{product.unit}</dd>
              </div>
              <div>
                <dt className="text-muted">الحد الأدنى للطلب</dt>
                <dd className="font-semibold tabular">{product.min_quantity}</dd>
              </div>
              <div>
                <dt className="text-muted">التوفر</dt>
                <dd>
                  <Badge tone={unavailable ? 'danger' : product.stock_status === 'limited' ? 'warning' : 'success'}>
                    {STOCK_LABELS[product.stock_status]}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-muted">مدينة المورد</dt>
                <dd className="font-semibold">{supplier ? cityNameOf(supplier.city_code, cities) : '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">مناطق التوصيل</dt>
                <dd className="font-semibold">{cityNames.length ? cityNames.join('، ') : 'يُحدَّد عند الطلب'}</dd>
              </div>
            </dl>
          </Card>

          {supplier ? (
            <AddToCartButton productId={product.id} supplierId={product.business_id} minQuantity={product.min_quantity} unavailable={unavailable} />
          ) : null}

          {product.description ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-brand-900">الوصف</h2>
              <p className="whitespace-pre-line text-muted">{product.description}</p>
            </section>
          ) : null}
          <p className="text-xs text-muted">
            السعر يشمل المنتج فقط. أسعار التوصيل وطريقة الدفع تُحدَّد مع المورد عند تأكيد الطلب.
          </p>
        </section>
      </div>
    </div>
  );
}

function cityNameOf(code: string, cities: { code: string; name_ar: string }[] | null) {
  return cities?.find((c) => c.code === code)?.name_ar ?? code;
}
