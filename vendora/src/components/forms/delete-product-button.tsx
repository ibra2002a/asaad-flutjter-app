'use client';

import { useRouter } from 'next/navigation';
import { deleteProductAction } from '@/actions/products';
import { buttonClass } from '@/components/ui/button-styles';
import { useAction } from '@/components/forms/use-action';

export function DeleteProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const { run, pending, result } = useAction(() => deleteProductAction(productId));
  return (
    <div className="space-y-2 text-end">
      <button
        type="button"
        disabled={pending}
        className={buttonClass('danger')}
        onClick={() => {
          if (!window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
          run(undefined, () => router.push('/supplier/products'));
        }}
      >
        {pending ? 'جارٍ الحذف…' : 'حذف المنتج'}
      </button>
      {result && !result.ok ? <p className="text-sm text-danger">{result.message}</p> : null}
    </div>
  );
}
