import type { Metadata } from 'next';
import Link from 'next/link';
import { listApprovedSuppliers } from '@/lib/data/catalog';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'الموردون المعتمدون' };

export default async function SuppliersPage() {
  const suppliers = await listApprovedSuppliers();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow="موردون تمت مراجعتهم"
        title="الموردون المعتمدون"
        description="كل مورد يمر بمراجعة الهوية التجارية قبل نشر منتجاته على VENDORA."
      />
      {suppliers.length === 0 ? (
        <EmptyState title="لا يوجد موردون معتمدون بعد" description="نعمل على اعتماد أول دفعة من الموردين في بغداد." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <Link key={s.id} href={`/suppliers/${s.id}`} className="group focus-visible:outline-none">
              <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-brand-300 group-hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-bold text-brand-950">{s.legal_name}</h2>
                  <Badge tone="brand">معتمد</Badge>
                </div>
                {s.description_ar ? <p className="mt-2 line-clamp-3 text-sm text-muted">{s.description_ar}</p> : null}
                {s.cities.length > 0 ? <p className="mt-3 text-xs text-slate-600">التغطية: {s.cities.length} مدينة</p> : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
