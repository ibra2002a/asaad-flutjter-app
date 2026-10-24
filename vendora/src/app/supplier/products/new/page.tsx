import type { Metadata } from 'next';
import { listCategories } from '@/lib/data/catalog';
import { getMyBusiness } from '@/lib/session';
import { canSellProducts } from '@/lib/domain/authz';
import { ProductForm } from '@/components/forms/ProductForm';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'إضافة منتج' };

export default async function NewProductPage() {
  const [categories, business] = await Promise.all([listCategories(), getMyBusiness()]);
  const canPublish = canSellProducts(business ? { kind: business.kind, verificationStatus: business.verification_status } : null);
  return (
    <>
      <PageHeader title="إضافة منتج" description="أدخل تفاصيل المنتج وأسعار الجملة. يراجع فريق VENDORA المنتج قبل نشره." />
      <ProductForm categories={categories} canPublish={canPublish} />
    </>
  );
}
