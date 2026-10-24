import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/card';
import { CartView } from '@/components/cart/cart-view';
import { getSession } from '@/lib/auth';

export const metadata: Metadata = { title: 'السلة' };

export default async function CartPage() {
  const session = await getSession();
  const canCheckout = session?.viewer.role === 'buyer';
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <PageHeader title="سلة المشتريات" description="كل طلب يجب أن يحتوي على منتجات من مورد واحد." />
      <CartView canCheckout={canCheckout} />
    </div>
  );
}
