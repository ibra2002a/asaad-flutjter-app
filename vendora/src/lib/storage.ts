import { getPublicEnv } from '@/lib/env';

/** Public URL for a product image. Bucket is public; paths are random UUIDs under the supplier's folder. */
export function productImageUrl(storagePath: string): string {
  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();
  const encoded = storagePath.split('/').map(encodeURIComponent).join('/');
  return `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${encoded}`;
}
