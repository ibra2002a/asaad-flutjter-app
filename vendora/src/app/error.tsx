'use client';

import { useEffect } from 'react';
import { buttonClass } from '@/components/ui';

/** Route-level error boundary. Shows a friendly Arabic message; details go to the console only. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[VENDORA] route error', error.digest ?? error.message);
  }, [error]);

  const configurationProblem = error.name === 'SupabaseConfigError';

  return (
    <div role="alert" className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold text-brand-950">
        {configurationProblem ? 'الموقع يحتاج إلى إعداد' : 'حدث خطأ غير متوقع'}
      </h1>
      <p className="text-muted">
        {configurationProblem
          ? 'لم يتم ضبط متغيرات الاتصال بقاعدة البيانات. راجع دليل الإعداد في docs/SETUP.md.'
          : 'عذرا، لم نتمكن من إكمال الطلب. حاول مرة أخرى، وإذا تكرر الخطأ تواصل مع الدعم.'}
      </p>
      {configurationProblem ? null : (
        <button type="button" onClick={reset} className={buttonClass('primary')}>
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}
