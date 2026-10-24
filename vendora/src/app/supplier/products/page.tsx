import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { imageUrlFor } from '@/lib/data/catalog';
import { formatIqd } from '@/lib/domain/money';
import { ProductStatusBadge } from '@/components/StatusBadge';
import { Card, EmptyState, PageHeader, buttonClass } from '@/components/ui';

export const metadata: Metadata = { title: 'منتجاتي' };

export default async function SupplierProductsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('products')
    .select('id, name_ar, price_iqd, sale_price_iqd, stock_qty, status, updated_at, images:product_images(storage_path, position)')
    .order('updated_at', { ascending: false })
    .limit(200);
  type Row = {
    id: string;
    name_ar: string;
    price_iqd: number;
    sale_price_iqd: number | null;
    stock_qty: number;
    status: 'draft' | 'pending_review' | 'active' | 'rejected' | 'archived';
    images: Array<{ storage_path: string; position: number }>;
  };
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        title="منتجاتي"
        description="أضف منتجاتك وتابع حالة المراجعة. المنتجات المعتمدة فقط تظهر للتجار."
        actions={<Link href="/supplier/products/new" className={buttonClass('accent')}>إضافة منتج</Link>}
      />
      {rows.length === 0 ? (
        <EmptyState title="لا توجد منتجات بعد" description="ابدأ بإضافة أول منتج، وسيراجعه فريق VENDORA قبل نشره." action={<Link href="/supplier/products/new" className={buttonClass('primary')}>إضافة منتج</Link>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => {
            const first = [...p.images].sort((a, b) => a.position - b.position)[0];
            return (
              <Link key={p.id} href={`/supplier/products/${p.id}`} className="focus-visible:outline-none">
                <Card className="flex h-full gap-4 transition hover:border-brand-300 hover:shadow-md">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-brand-50">
                    {first ? <Image src={imageUrlFor(supabase, first.storage_path)} alt="" fill sizes="80px" className="object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><ProductStatusBadge status={p.status} /></div>
                    <p className="mt-2 truncate font-bold text-brand-950">{p.name_ar}</p>
                    <p className="ltr-num text-sm text-muted">{formatIqd(p.sale_price_iqd ?? p.price_iqd)} · المخزون {p.stock_qty}</p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
