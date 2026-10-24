import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMyBusiness } from '@/lib/session';
import { listCities } from '@/lib/data/catalog';
import { BusinessForm } from '@/components/forms/AccountForms';
import { CoverageForm } from '@/components/forms/CoverageForm';
import { PageHeader } from '@/components/ui';
import { VerificationBadge } from '@/components/StatusBadge';

export const metadata: Metadata = { title: 'الملف التجاري للمورد' };

export default async function SupplierProfilePage() {
  const [business, cities] = await Promise.all([getMyBusiness(), listCities()]);
  if (!business) redirect('/supplier/onboarding');

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('supplier_coverage').select('city_code').eq('business_id', business.id);
  const selected = ((data ?? []) as Array<{ city_code: string }>).map((c) => c.city_code);

  return (
    <>
      <PageHeader title="الملف التجاري" description="بيانات المنشأة التي تظهر للتجار على صفحتك العامة." actions={<VerificationBadge status={business.verification_status} />} />
      <div className="grid gap-8 lg:grid-cols-2">
        <BusinessForm business={business} cities={cities} />
        <CoverageForm cities={cities} selected={selected} />
      </div>
    </>
  );
}
