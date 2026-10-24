import Link from 'next/link';
import { buttonClass } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="ltr-num text-6xl font-black text-lime-500">404</p>
      <h1 className="text-2xl font-extrabold text-brand-950">الصفحة غير موجودة</h1>
      <p className="text-muted">ربما تم نقلها أو أن الرابط غير صحيح. يمكنك العودة إلى الكتالوج.</p>
      <div className="flex gap-3">
        <Link href="/" className={buttonClass('primary')}>الرئيسية</Link>
        <Link href="/products" className={buttonClass('secondary')}>المنتجات</Link>
      </div>
    </div>
  );
}
