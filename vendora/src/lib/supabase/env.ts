/**
 * Reads Supabase configuration. Only the public URL and anon key are ever
 * exposed to the browser; the service-role key is never read by app code.
 */
export class SupabaseConfigError extends Error {
  constructor(missing: string[]) {
    super(`VENDORA is not configured: missing ${missing.join(', ')}. See docs/SETUP.md.`);
    this.name = 'SupabaseConfigError';
  }
}

export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missing = [
    ...(url ? [] : ['NEXT_PUBLIC_SUPABASE_URL']),
    ...(anonKey ? [] : ['NEXT_PUBLIC_SUPABASE_ANON_KEY']),
  ];
  if (missing.length > 0 || !url || !anonKey) {
    throw new SupabaseConfigError(missing);
  }
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
}
