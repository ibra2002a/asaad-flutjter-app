import Link from 'next/link';
import { buttonClass } from '@/components/ui/button-styles';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-24 text-center">
      <p className="text-6xl font-black text-lime-500">٤٠٤</p>
      <h1 className="text-2xl font-bold text-brand-900">الصفحة غير موجودة</h1>
      <p className="text-muted">ربما تم نقلها أو أن الرابط غير صحيح.</p>
      <Link href="/" className={buttonClass('primary')}>
        العودة إلى الرئيسية
      </Link>
    </div>
  );
}
