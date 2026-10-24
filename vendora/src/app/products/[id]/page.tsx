import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicProduct } from '@/lib/data/catalog';
import { formatIqd } from '@/lib/domain/money';
import { effectiveUnitPrice } from '@/lib/domain/cart';
import { productUnitLabelsAr } from '@/lib/validation/schemas';
import { AddToCartButton } from '@/components/AddToCartButton';
import { Badge, Card } from '@/components/ui';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const product = await getPublicProduct(id).catch(() => null);
  return { title: product?.nameAr ?? 'منتج' };
}

export default async function ProductDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const product = await getPublicProduct(id).catch(() => null);
  if (!product) notFound();

  const unitLabel = productUnitLabelsAr[product.unit as keyof typeof productUnitLabelsAr] ?? product.unit;
  const price = effectiveUnitPrice(product);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav aria-label="مسار التنقل" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href="/products" className="hover:text-brand-800">المنتجات</Link>
        <span aria-hidden="true">/</span>
        <span>{product.categoryName}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-white">
            {product.images[0] ? (
              <Image src={product.images[0]} alt={product.nameAr} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-contain p-4" />
            ) : (
              <div className="flex h-full items-center justify-center text-brand-200" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="size-24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" /></svg>
              </div>
            )}
          </div>
          {product.images.length > 1 ? (
            <ul className="grid grid-cols-4 gap-3" aria-label="صور إضافية">
              {product.images.slice(1, 5).map((src, i) => (
                <li key={src} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-white">
                  <Image src={src} alt={`${product.nameAr} — صورة ${i + 2}`} fill sizes="120px" className="object-cover" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{product.categoryName}</Badge>
              {product.salePriceIqd !== null ? <Badge tone="lime">عرض خاص</Badge> : null}
            </div>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight text-brand-950">{product.nameAr}</h1>
            {product.supplier ? (
              <p className="mt-2 text-sm text-muted">
                يُباع من{' '}
                <Link href={`/suppliers/${product.supplier.id}`} className="font-semibold text-brand-700 underline-offset-4 hover:underline">
                  {product.supplier.legal_name}
                </Link>
              </p>
            ) : null}
          </div>

          <Card>
            <p className="text-sm text-muted">السعر للوحدة ({unitLabel})</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <p className="ltr-num text-4xl font-black text-brand-900">{formatIqd(price)}</p>
              {product.salePriceIqd !== null ? <p className="ltr-num text-lg text-muted line-through">{formatIqd(product.priceIqd)}</p> : null}
            </div>
            <p className="mt-2 text-xs text-muted">الأسعار بالدينار العراقي وتشمل الخصم المعلن. رسوم التوصيل تُحدد عند التأكيد.</p>
            <div className="mt-6 border-t border-line pt-6">
              <AddToCartButton
                product={{
                  id: product.id,
                  nameAr: product.nameAr,
                  priceIqd: product.priceIqd,
                  salePriceIqd: product.salePriceIqd,
                  minOrderQty: product.minOrderQty,
                  maxOrderQty: product.maxOrderQty,
                  stockQty: product.stockQty,
                  supplierId: product.supplierId,
                }}
              />
            </div>
          </Card>

          {product.descriptionAr ? (
            <Card>
              <h2 className="mb-2 text-lg font-bold text-brand-950">الوصف</h2>
              <p className="whitespace-pre-line leading-relaxed text-slate-700">{product.descriptionAr}</p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
