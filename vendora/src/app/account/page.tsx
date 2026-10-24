import type { Metadata } from 'next';
import Link from 'next/link';
import { AddressCard, AddressForm, BusinessForm, DeleteAddressButton, ProfileForm } from '@/components/forms/account-forms';
import { Card, PageHeader } from '@/components/ui/card';
import { requireSession } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/labels';
import { createClient } from '@/lib/supabase/server';
import { BUSINESS_STATUS_LABELS } from '@/lib/labels';

export const metadata: Metadata = { title: 'حسابي' };

export default async function AccountPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const { viewer, business } = session;

  const [citiesResult, addressesResult] = await Promise.all([
    supabase.from('cities').select('code, name_ar').order('sort_order'),
    viewer.role === 'buyer'
      ? supabase.from('addresses').select('id, label, address_line, landmark, cities:city_code(name_ar)').order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const cities = (citiesResult.data ?? []) as { code: string; name_ar: string }[];

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6">
      <PageHeader
        title="حسابي"
        description={`${ROLE_LABELS[viewer.role]} · ${viewer.email ?? ''}`}
      />

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-brand-900">البيانات الشخصية</h2>
        <Card>
          <ProfileForm fullName={viewer.fullName} phone={viewer.phone} />
        </Card>
      </section>

      {business ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-brand-900">بيانات النشاط التجاري</h2>
            {viewer.role === 'supplier' ? (
              <Link href="/supplier/profile" className="text-sm font-semibold text-brand-700 underline">
                إدارة ملف المورد والتغطية
              </Link>
            ) : null}
          </div>
          {viewer.role === 'buyer' ? (
            <Card>
              <BusinessForm business={business} cities={cities} />
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-muted">
                الحالة: <span className="font-semibold text-ink">{BUSINESS_STATUS_LABELS[business.status]}</span>
              </p>
            </Card>
          )}
        </section>
      ) : null}

      {viewer.role === 'buyer' ? (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-brand-900">عناوين التوصيل</h2>
          <div className="space-y-3">
            {((addressesResult.data ?? []) as unknown as Array<{ id: string; label: string; address_line: string; landmark: string | null; cities: { name_ar: string } | null }>).map((a) => (
              <AddressCard key={a.id} label={a.label} city={a.cities?.name_ar ?? ''} line={a.address_line} landmark={a.landmark}>
                <DeleteAddressButton addressId={a.id} />
              </AddressCard>
            ))}
            {(addressesResult.data ?? []).length === 0 ? <p className="text-sm text-muted">لا توجد عناوين بعد. أضف عنواناً لتتمكن من الطلب.</p> : null}
          </div>
          <Card>
            <h3 className="mb-4 font-semibold text-brand-900">إضافة عنوان جديد</h3>
            <AddressForm cities={cities} />
          </Card>
        </section>
      ) : null}
    </div>
  );
}
