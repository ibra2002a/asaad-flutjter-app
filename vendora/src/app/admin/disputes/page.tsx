import type { Metadata } from 'next';
import { ActionForm } from '@/components/ActionForm';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { adminResolveDisputeAction } from '@/lib/actions/admin';
import { Badge, Card, EmptyState, PageHeader, Input, Textarea, formatDateAr } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { QueryNotice } from '@/components/FormMessage';

export const metadata: Metadata = { title: 'النزاعات' };

type SearchParams = Promise<{ notice?: string; error?: string }>;

interface DisputeAdminRow {
  id: string;
  kind: string;
  reason: string;
  requested_quantity: number | null;
  status: 'open' | 'resolved';
  resolution: string | null;
  resolution_note: string | null;
  created_at: string;
  order: { id: string; order_number: string; status: string } | null;
  item: { product_name_snapshot: string; quantity: number; returned_quantity: number } | null;
}

export default async function AdminDisputesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('disputes')
    .select('id, kind, reason, requested_quantity, status, resolution, resolution_note, created_at, order:orders!disputes_order_id_fkey(id, order_number, status), item:order_items!disputes_order_item_id_fkey(product_name_snapshot, quantity, returned_quantity)')
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as DisputeAdminRow[];
  const open = rows.filter((r) => r.status === 'open');
  const closed = rows.filter((r) => r.status === 'resolved');

  return (
    <>
      <PageHeader title="النزاعات وطلبات الإرجاع" description="اختر الحل المناسب. الإرجاع الجزئي يخفض العمولة تلقائيا، والاسترداد الكامل يلغي الطلب." />
      <div className="mb-6"><QueryNotice notice={params.notice} error={params.error} /></div>

      <h2 className="mb-4 text-lg font-bold text-brand-950">مفتوحة ({open.length})</h2>
      {open.length === 0 ? (
        <EmptyState title="لا توجد نزاعات مفتوحة" description="ستظهر النزاعات هنا عندما يفتح التاجر نزاعا بعد التسليم." />
      ) : (
        <ul className="space-y-4">
          {open.map((d) => (
            <li key={d.id}>
              <Card className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link href={`/admin/orders?status=disputed`} className="ltr-num font-bold text-brand-800 hover:underline">{d.order?.order_number}</Link>
                    <p className="text-sm text-muted">{formatDateAr(d.created_at)} · {d.kind === 'return' ? 'طلب إرجاع' : d.kind === 'quality' ? 'جودة' : 'أخرى'}</p>
                  </div>
                  <Badge tone="danger">مفتوح</Badge>
                </div>
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{d.reason}</p>
                {d.item ? (
                  <p className="text-sm text-slate-700">
                    المنتج: <span className="font-semibold">{d.item.product_name_snapshot}</span> · المطلوب إرجاعه <span className="ltr-num">{d.requested_quantity}</span> من <span className="ltr-num">{d.item.quantity}</span>
                  </p>
                ) : null}

                <ActionForm action={adminResolveDisputeAction} className="grid gap-4 border-t border-line pt-4 md:grid-cols-2">
                  <input type="hidden" name="disputeId" value={d.id} />
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor={`note-${d.id}`} className="text-sm font-semibold text-brand-950">ملاحظة الحل (مطلوبة، تظهر للطرفين)</label>
                    <Textarea id={`note-${d.id}`} name="note" maxLength={1000} className="min-h-20" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor={`qty-${d.id}`} className="text-sm font-semibold text-brand-950">كمية الإرجاع (لحل الإرجاع الجزئي فقط)</label>
                    <Input id={`qty-${d.id}`} name="returnedQuantity" type="number" min={1} placeholder={d.requested_quantity ? String(d.requested_quantity) : ''} dir="ltr" />
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <SubmitButton name="resolution" value="partial_return" variant="secondary" pendingLabel="…" className="min-h-11">إرجاع جزئي</SubmitButton>
                    <SubmitButton name="resolution" value="refund_full" variant="danger" pendingLabel="…" className="min-h-11">استرداد كامل</SubmitButton>
                    <SubmitButton name="resolution" value="no_action" variant="ghost" pendingLabel="…" className="min-h-11">رفض النزاع</SubmitButton>
                  </div>
                </ActionForm>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {closed.length > 0 ? (
        <section className="mt-12" aria-labelledby="closed">
          <h2 id="closed" className="mb-4 text-lg font-bold text-brand-950">مغلقة</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {closed.map((d) => (
              <li key={d.id} className="px-5 py-4 text-sm">
                <p className="ltr-num font-bold text-brand-900">{d.order?.order_number}</p>
                <p className="text-muted">{d.resolution === 'partial_return' ? 'إرجاع جزئي' : d.resolution === 'refund_full' ? 'استرداد كامل' : 'بدون تعديل'} · {d.resolution_note}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
