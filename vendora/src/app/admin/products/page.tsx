import type { Metadata } from 'next';
import { ActionForm } from '@/components/ActionForm';
import Image from 'next/image';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { imageUrlFor } from '@/lib/data/catalog';
import { adminReviewProductAction } from '@/lib/actions/admin';
import { formatIqd } from '@/lib/domain/money';
import { Card, PageHeader, Select, Textarea, buttonClass, EmptyState } from '@/components/ui';
import { ProductStatusBadge } from '@/components/StatusBadge';
import { SubmitButton } from '@/components/SubmitButton';
import { QueryNotice } from '@/components/FormMessage';

export const metadata: Metadata = { title: 'مراجعة المنتجات' };

type SearchParams = Promise<{ status?: string; notice?: string; error?: string }>;
const STATUSES = ['pending_review', 'active', 'rejected', 'draft', 'archived'] as const;
const LABEL: Record<(typeof STATUSES)[number], string> = {
  pending_review: 'بانتظار المراجعة',
  active: 'منشورة',
  rejected: 'مرفوضة',
  draft: 'مسودات',
  archived: 'مؤرشفة',
};

interface AdminProductRow {
  id: string;
  name_ar: string;
  price_iqd: number;
  sale_price_iqd: number | null;
  unit: string;
  stock_qty: number;
  status: (typeof STATUSES)[number];
  moderation_note: string | null;
  supplier: { legal_name: string } | null;
  category: { name_ar: string } | null;
  images: Array<{ storage_path: string; position: number }> | null;
}

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = (STATUSES as readonly string[]).includes(params.status ?? '') ? params.status! : 'pending_review';
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('products')
    .select('id, name_ar, price_iqd, sale_price_iqd, unit, stock_qty, status, moderation_note, supplier:businesses!products_supplier_id_fkey(legal_name), category:categories!products_category_id_fkey(name_ar), images:product_images(storage_path, position)')
    .eq('status', status)
    .order('updated_at', { ascending: true })
    .limit(100);
  const rows = (data ?? []) as unknown as AdminProductRow[];

  return (
    <>
      <PageHeader
        title="مراجعة المنتجات"
        description="لا يظهر أي منتج للتجار قبل اعتماده هنا. الرفض يتطلب ملاحظة توضح للمورد ما يجب تصحيحه."
        actions={
          <form method="get" className="flex items-center gap-2">
            <Select name="status" defaultValue={status} aria-label="تصفية حسب الحالة" className="min-w-44">
              {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
            </Select>
            <button type="submit" className={buttonClass('secondary')}>عرض</button>
          </form>
        }
      />
      <div className="mb-6"><QueryNotice notice={params.notice} error={params.error} /></div>

      {rows.length === 0 ? (
        <EmptyState title="لا توجد منتجات في هذه الحالة" description="عند إرسال منتج جديد للمراجعة سيظهر هنا." />
      ) : (
        <ul className="space-y-4">
          {rows.map((p) => {
            const first = [...(p.images ?? [])].sort((a, b) => a.position - b.position)[0];
            return (
              <li key={p.id}>
                <Card className="grid gap-5 md:grid-cols-[120px_1fr]">
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-brand-50">
                    {first ? <Image src={imageUrlFor(supabase, first.storage_path)} alt="" fill sizes="120px" className="object-cover" /> : null}
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-brand-950">{p.name_ar}</h2>
                        <p className="text-sm text-muted">{p.supplier?.legal_name} · {p.category?.name_ar} · المخزون <span className="ltr-num">{p.stock_qty}</span></p>
                        <p className="ltr-num mt-1 font-semibold text-brand-900">{formatIqd(p.sale_price_iqd ?? p.price_iqd)} / {p.unit}</p>
                      </div>
                      <ProductStatusBadge status={p.status} />
                    </div>
                    {p.moderation_note ? <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">ملاحظة سابقة: {p.moderation_note}</p> : null}
                    <ActionForm action={adminReviewProductAction} className="space-y-3">
                      <input type="hidden" name="productId" value={p.id} />
                      <input type="hidden" name="returnTo" value="/admin/products" />
                      <label htmlFor={`note-${p.id}`} className="text-sm font-semibold text-brand-950">ملاحظة للمورد (مطلوبة عند الرفض)</label>
                      <Textarea id={`note-${p.id}`} name="note" maxLength={1000} className="min-h-16" />
                      <div className="flex flex-wrap gap-2">
                        <SubmitButton name="status" value="active" variant="accent" pendingLabel="…" className="min-h-11">اعتماد ونشر</SubmitButton>
                        <SubmitButton name="status" value="rejected" variant="danger" pendingLabel="…" className="min-h-11">رفض</SubmitButton>
                        <Link href={`/products/${p.id}`} className={buttonClass('ghost', 'min-h-11')}>معاينة</Link>
                      </div>
                    </ActionForm>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
