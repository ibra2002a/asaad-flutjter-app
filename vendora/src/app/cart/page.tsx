import type { Metadata } from 'next';
import { CartView } from '@/components/CartView';

export const metadata: Metadata = { title: 'سلة المشتريات' };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-3xl font-extrabold text-brand-950">سلة المشتريات</h1>
      <CartView />
    </div>
  );
}
