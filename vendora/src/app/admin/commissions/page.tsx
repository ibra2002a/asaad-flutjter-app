import type { Metadata } from 'next';
import { ActionForm } from '@/components/ActionForm';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listCategories } from '@/lib/data/catalog';
import { adminSettleCommissionAction } from '@/lib/actions/admin';
import { formatIqd } from '@/lib/domain/money';
import { Badge, Card, EmptyState, PageHeader, formatDateAr } from '@/components/ui';
import { CommissionRuleForm } from '@/components/forms/CommissionRuleForm';
import { SubmitButton } from '@/components/SubmitButton';
import { QueryNotice } from '@/components/FormMessage';

export const metadata: Metadata = { title: 'العمولات' };

type SearchParams = Promise<{ notice?: string; error?: string }>;

interface RuleRow {
  id: string;
  scope: 'global' | 'category' | 'supplier';
  rate_bp: number;
  is_active: boolean;
  note: string | null;
  created_at: string;
  category: { name_ar: string } | null;
  supplier: { legal_name: string } | null;
}

interface CommissionAdminRow {
  id: string;
  eligible_base_iqd: number;
  commission_iqd: number;
  status: 'accrued' | 'settled';
  created_at: string;
  supplier: { legal_name: string } | null;
  order: { order_number: string } | null;
}

export default async function AdminCommissionsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [rulesRes, commissionsRes, categories, suppliersRes, adjustmentsRes] = await Promise.all([
    supabase
      .from('commission_rules')
      .select('id, scope, rate_bp, is_active, note, created_at, category:categories!commission_rules_category_id_fkey(name_ar), supplier:businesses!commission_rules_supplier_business_id_fkey(legal_name)')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('commissions')
      .select('id, eligible_base_iqd, commission_iqd, status, created_at, supplier:businesses!commissions_supplier_business_id_fkey(legal_name), order:orders!commissions_order_id_fkey(order_number)')
      .order('created_at', { ascending: false })
      .limit(100),
    listCategories(),
    supabase.from('businesses').select('id, legal_name').eq('kind', 'supplier').eq('verification_status', 'approved').order('legal_name'),
    supabase.from('commission_adjustments').select('commission_id, amount_iqd'),
  ]);

  const rules = (rulesRes.data ?? []) as unknown as RuleRow[];
  const commissions = (commissionsRes.data ?? []) as unknown as CommissionAdminRow[];
  const adjustments = new Map<string, number>();
  for (const a of (adjustmentsRes.data ?? []) as Array<{ commission_id: string; amount_iqd: number }>) {
    adjustments.set(a.commission_id, (adjustments.get(a.commission_id) ?? 0) + Number(a.amount_iqd));
  }
  const net = (c: CommissionAdminRow) => Number(c.commission_iqd) + (adjustments.get(c.id) ?? 0);
  const accrued = commissions.filter((c) => c.status === 'accrued').reduce((s, c) => s + net(c), 0);
  const settled = commissions.filter((c) => c.status === 'settled').reduce((s, c) => s + net(c), 0);
  const scopeLabel = { global: 'عامة', category: 'فئة', supplier: 'مورد' } as const;

  return (
    <>
      <PageHeader
        title="العمولات"
        description="إدارة النسب والتسوية اليدوية. لا تحتفظ VENDORA بأموال المبيعات؛ التسوية تتم بين المنصة والمورد وتُسجل هنا."
      />
      <div className="mb-6"><QueryNotice notice={params.notice} error={params.error} /></div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><p className="text-sm text-muted">عمولة مستحقة (غير مسوّاة)</p><p className="ltr-num mt-2 text-2xl font-black text-amber-800">{formatIqd(accrued)}</p></Card>
        <Card><p className="text-sm text-muted">عمولة مسوّاة</p><p className="ltr-num mt-2 text-2xl font-black text-brand-900">{formatIqd(settled)}</p></Card>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <CommissionRuleForm categories={categories} suppliers={(suppliersRes.data ?? []) as Array<{ id: string; legal_name: string }>} />
          <Card className="p-0">
            <div className="border-b border-line px-5 py-4"><h2 className="font-bold text-brand-950">القواعد الحالية</h2></div>
            <ul className="divide-y divide-line">
              {rules.filter((r) => r.is_active).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-brand-950">
                      {scopeLabel[r.scope]}
                      {r.category ? `: ${r.category.name_ar}` : ''}
                      {r.supplier ? `: ${r.supplier.legal_name}` : ''}
                    </p>
                    {r.note ? <p className="text-xs text-muted">{r.note}</p> : null}
                  </div>
                  <Badge tone="brand"><span className="ltr-num">{(r.rate_bp / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%</span></Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <section aria-labelledby="comm-list">
          <h2 id="comm-list" className="mb-4 text-lg font-bold text-brand-950">سجل العمولات</h2>
          {commissions.length === 0 ? (
            <EmptyState title="لا توجد عمولات بعد" description="تُنشأ العمولة تلقائيا عند اكتمال كل طلب، مرة واحدة فقط." />
          ) : (
            <ul className="space-y-3">
              {commissions.map((c) => (
                <li key={c.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="ltr-num font-bold text-brand-950">{c.order?.order_number}</p>
                      <p className="text-sm text-muted">{c.supplier?.legal_name} · {formatDateAr(c.created_at)}</p>
                      <p className="ltr-num mt-1 text-sm">المبيعات {formatIqd(Number(c.eligible_base_iqd))} · العمولة {formatIqd(net(c))}</p>
                    </div>
                    {c.status === 'accrued' ? (
                      <ActionForm action={adminSettleCommissionAction}>
                        <input type="hidden" name="commissionId" value={c.id} />
                        <SubmitButton variant="secondary" pendingLabel="…" className="min-h-10 px-4 text-xs">تسوية يدوية</SubmitButton>
                      </ActionForm>
                    ) : (
                      <Badge tone="brand">مسوّاة</Badge>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
