'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { deleteProductImageAction } from '@/actions/products';
import { buttonClass } from '@/components/ui/button-styles';
import { Notice } from '@/components/ui/card';
import { MAX_IMAGE_BYTES } from '@/lib/image';

type Image = { id: string; url: string };

export function ImageUploader({ productId, images }: { productId: string; images: Image[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function upload(file: File) {
    setMessage(null);
    if (file.size > MAX_IMAGE_BYTES) {
      setMessage({ tone: 'error', text: 'حجم الصورة يجب ألا يتجاوز 5 ميغابايت.' });
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(`/api/products/${productId}/images`, { method: 'POST', body });
      const data = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setMessage({ tone: 'error', text: data.message ?? 'تعذر رفع الصورة.' });
      } else {
        setMessage({ tone: 'success', text: 'تم رفع الصورة.' });
        router.refresh();
      }
    } catch {
      setMessage({ tone: 'error', text: 'تعذر الاتصال بالخادم. حاول مرة أخرى.' });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function remove(imageId: string) {
    if (!window.confirm('حذف هذه الصورة؟')) return;
    setBusy(true);
    const result = await deleteProductImageAction(imageId);
    setBusy(false);
    setMessage({ tone: result.ok ? 'success' : 'error', text: result.message ?? 'تم حذف الصورة.' });
    if (result.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <label className={buttonClass('secondary', busy ? 'pointer-events-none opacity-60' : 'cursor-pointer')}>
          اختر صورة (JPG أو PNG أو WebP، حتى 5 ميغابايت)
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy || images.length >= 5}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </label>
        <span className="text-sm text-muted">{images.length} / 5 صور</span>
      </div>
      {message ? <Notice tone={message.tone === 'success' ? 'success' : 'error'}>{message.text}</Notice> : null}
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {images.map((image) => (
            <li key={image.id} className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL */}
              <img src={image.url} alt="صورة المنتج" className="aspect-square w-full rounded-lg border border-line object-cover" />
              <button type="button" onClick={() => remove(image.id)} disabled={busy} className={buttonClass('danger', 'w-full min-h-9 text-xs')}>
                حذف الصورة
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
