'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { addCoverageAction, removeCoverageAction } from '@/actions/suppliers';
import { buttonClass } from '@/components/ui/button-styles';
import { Notice } from '@/components/ui/card';

export function CoverageManager({ cities, covered }: { cities: { code: string; name_ar: string }[]; covered: string[] }) {
  const router = useRouter();
  const [coveredSet, setCoveredSet] = useState(new Set(covered));
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function toggle(code: string) {
    setPendingCode(code);
    setMessage(null);
    const isCovered = coveredSet.has(code);
    const result = isCovered ? await removeCoverageAction({ cityCode: code }) : await addCoverageAction({ cityCode: code });
    setPendingCode(null);
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.message });
      return;
    }
    setCoveredSet((current) => {
      const next = new Set(current);
      if (isCovered) next.delete(code);
      else next.add(code);
      return next;
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        اختر المحافظات التي توصّل إليها. المشتري لا يستطيع الطلب إلا من محافظة يغطيها المورد.
      </p>
      {message ? <Notice tone={message.tone === 'success' ? 'success' : 'error'}>{message.text}</Notice> : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cities.map((city) => {
          const isCovered = coveredSet.has(city.code);
          return (
            <li key={city.code} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
              <span className="font-semibold">{city.name_ar}</span>
              <button
                type="button"
                disabled={pendingCode === city.code}
                onClick={() => toggle(city.code)}
                className={buttonClass(isCovered ? 'secondary' : 'primary', 'min-h-9 px-3 text-xs')}
              >
                {pendingCode === city.code ? '…' : isCovered ? 'إزالة' : 'إضافة'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
