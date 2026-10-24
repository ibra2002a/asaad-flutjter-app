import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Returns a path with a single query parameter appended. */
export function withParam(path: string, key: string, value: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

export function redirectWithNotice(path: string, notice: string): never {
  redirect(withParam(path, 'notice', notice));
}

export function redirectWithError(path: string, error: string): never {
  redirect(withParam(path, 'error', error));
}

/** Current user id, or null. Actions call this before any write. */
export async function currentUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
