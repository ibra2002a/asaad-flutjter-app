'use client';

import { buttonClass } from '@/components/ui/button-styles';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-24 text-center" role="alert">
      <h1 className="text-2xl font-bold text-brand-900">حدث خطأ غير متوقع</h1>
      <p className="text-muted">لم نتمكن من إكمال الطلب. حاول مرة أخرى، وإذا استمرت المشكلة تواصل مع فريق VENDORA.</p>
      <button type="button" onClick={reset} className={buttonClass('primary')}>
        إعادة المحاولة
      </button>
    </div>
  );
}
