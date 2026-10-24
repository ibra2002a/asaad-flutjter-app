import type { Metadata } from 'next';
import { ActionForm } from '@/components/ActionForm';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { adminSetProfileActiveAction } from '@/lib/actions/admin';
import { Badge, Card, PageHeader, Textarea, formatDateAr } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { QueryNotice } from '@/components/FormMessage';
import { VerificationBadge } from '@/components/StatusBadge';

export const metadata: Metadata = { title: 'إدارة التجار' };

type SearchParams = Promise<{ notice?: string; error?: string }>;

interface BuyerRow {
  id: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  business: { legal_name: string; verification_status: 'pending' | 'approved' | 'rejected' | 'suspended' } | null;
}

export default async function AdminBuyersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, phone, is_active, created_at, business:businesses!businesses_owner_id_fkey(legal_name, verification_status)')
    .eq('role', 'buyer')
    .order('created_at', { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as BuyerRow[];

  return (
    <>
      <PageHeader title="إدارة التجار" description="تعليق حساب التاجر يمنعه من الطلب فورا. كل تعليق أو تفعيل يُسجَّل مع السبب." />
      <div className="mb-6"><QueryNotice notice={params.notice} error={params.error} /></div>
      {rows.length === 0 ? (
        <Card><p className="text-center text-muted">لا يوجد تجار مسجلون بعد.</p></Card>
      ) : (
        <ul className="space-y-4">
          {rows.map((b) => (
            <li key={b.id}>
              <Card className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-brand-950">{b.business?.legal_name ?? b.full_name}</h2>
                    <p className="text-sm text-muted">{b.full_name} · <span className="ltr-num">{b.phone}</span> · انضم {formatDateAr(b.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    {b.business ? <VerificationBadge status={b.business.verification_status} /> : null}
                    {!b.is_active ? <Badge tone="danger">حساب معلق</Badge> : null}
                  </div>
                </div>
                <ActionForm action={adminSetProfileActiveAction} className="space-y-3 border-t border-line pt-4">
                  <input type="hidden" name="profileId" value={b.id} />
                  <input type="hidden" name="returnTo" value="/admin/buyers" />
                  <label htmlFor={`reason-${b.id}`} className="text-sm font-semibold text-brand-950">السبب (مطلوب)</label>
                  <Textarea id={`reason-${b.id}`} name="reason" maxLength={500} className="min-h-16" />
                  {b.is_active ? (
                    <SubmitButton name="active" value="false" variant="danger" pendingLabel="…" className="min-h-11">تعليق الحساب</SubmitButton>
                  ) : (
                    <SubmitButton name="active" value="true" variant="secondary" pendingLabel="…" className="min-h-11">إعادة التفعيل</SubmitButton>
                  )}
                </ActionForm>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
