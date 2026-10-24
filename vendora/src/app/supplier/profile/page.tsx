import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { BusinessForm } from '@/components/forms/account-forms';
import { CoverageManager } from '@/components/forms/coverage-manager';
import { Card, Notice, PageHeader } from '@/components/ui/card';
import { BUSINESS_STATUS_LABELS } from '@/lib/labels';

export const metadata: Metadata = { title: 'ملف النشاط' };

export default async function SupplierProfilePage() {
  const session = await requireSession(['supplier']);
  if (!session.business) return null;
  const supabase = await createClient();

  const [citiesResult, coverageResult] = await Promise.all([
    supabase.from('cities').select('code, name_ar').order('sort_order'),
    supabase.from('supplier_coverage').select('city_code').eq('business_id', session.business.id),
  ]);
  const cities = (citiesResult.data ?? []) as { code: string; name_ar: string }[];
  const covered = (coverageResult.data ?? []).map((c) => c.city_code as string);

  return (
    <div className="space-y-8">
      <PageHeader title="ملف النشاط والتغطية" description="معلومات النشاط التي تظهر للمشترين، والمحافظات التي توصّل إليها." />
      <Notice tone="info">الحالة: <strong>{BUSINESS_STATUS_LABELS[session.business.status]}</strong></Notice>
      <Card>
        <h2 className="mb-5 text-lg font-bold text-brand-900">بيانات النشاط</h2>
        <BusinessForm business={session.business} cities={cities} />
      </Card>
      <Card>
        <h2 className="mb-5 text-lg font-bold text-brand-900">مناطق التوصيل</h2>
        <CoverageManager cities={cities} covered={covered} />
      </Card>
    </div>
  );
}
