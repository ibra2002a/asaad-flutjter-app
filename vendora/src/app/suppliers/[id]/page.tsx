import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getApprovedSupplier, listProducts } from '@/lib/data/catalog';
import { ProductCard } from '@/components/ProductCard';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const supplier = await getApprovedSupplier(id).catch(() => null);
  return { title: supplier?.legalName ?? 'مورد' };
}

export default async function SupplierProfilePage({ params }: { params: Params }) {
  const { id } = await params;
  const supplier = await getApprovedSupplier(id).catch(() => null);
  if (!supplier) notFound();

  const { items: products } = await listProducts({ supplierId: supplier.id, page: 1 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav aria-label="مسار التنقل" className="mb-6 text-sm text-muted">
        <Link href="/suppliers" className="hover:text-brand-800">الموردون المعتمدون</Link>
      </nav>

      <Card className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-brand-950">{supplier.legalName}</h1>
            <p className="mt-2 max-w-3xl text-muted">{supplier.descriptionAr ?? 'مورد معتمد على VENDORA.'}</p>
          </div>
          <Badge tone="brand">مورد معتمد</Badge>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">مناطق التغطية</dt>
            <dd className="mt-1 font-semibold text-brand-950">{supplier.coverage.length > 0 ? supplier.coverage.join('، ') : 'بغداد'}</dd>
          </div>
        </dl>
      </Card>

      <PageHeader title="منتجات المورد" description="المنتجات المنشورة والمعتمدة من فريق المراجعة." />
      {products.length === 0 ? (
        <EmptyState title="لا توجد منتجات منشورة حاليا" description="تعود المنتجات هنا بعد مراجعتها واعتمادها." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
