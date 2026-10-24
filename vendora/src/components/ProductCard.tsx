import Image from 'next/image';
import Link from 'next/link';
import { formatIqd } from '@/lib/domain/money';
import { effectiveUnitPrice } from '@/lib/domain/cart';
import { productUnitLabelsAr } from '@/lib/validation/schemas';
import type { ProductCardData } from '@/lib/data/catalog';
import { Badge } from './ui';

export function ProductCard({ product }: { product: ProductCardData }) {
  const unitLabel = productUnitLabelsAr[product.unit as keyof typeof productUnitLabelsAr] ?? product.unit;
  const price = effectiveUnitPrice(product);
  const onSale = product.salePriceIqd !== null;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
      <Link href={`/products/${product.id}`} className="flex flex-1 flex-col">
        <div className="relative aspect-[4/3] bg-brand-50">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.nameAr}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-brand-300" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="size-12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="10" r="2" />
                <path d="M21 16l-5-5-8 8" />
              </svg>
            </div>
          )}
          {onSale ? (
            <span className="absolute start-3 top-3">
              <Badge tone="lime">خصم</Badge>
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="text-xs font-semibold text-brand-600">{product.categoryName}</p>
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-brand-950 group-hover:text-brand-700">{product.nameAr}</h3>
          <p className="truncate text-xs text-muted">{product.supplierName}</p>
          <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
            <div>
              <p className="ltr-num text-lg font-extrabold text-brand-900">{formatIqd(price)}</p>
              {onSale ? <p className="ltr-num text-xs text-muted line-through">{formatIqd(product.priceIqd)}</p> : null}
            </div>
            <p className="text-xs text-muted">
              <span className="ltr-num">{product.minOrderQty}</span> {unitLabel} كحد أدنى
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}
