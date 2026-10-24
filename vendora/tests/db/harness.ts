import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Spins up a real PostgreSQL 17 instance (PGlite, in-process) and applies the
 * exact migration files from supabase/migrations. Only Supabase's `auth`
 * schema is shimmed: users table and auth.uid() reading the JWT subject, which is
 * how Supabase implements it.
 */
const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

const AUTH_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid
    language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
`;

export async function createTestDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.waitReady;
  await db.exec(AUTH_SHIM);
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return db;
}

/** Runs subsequent statements as the signed-in user, so RLS applies. */
export async function asUser(db: PGlite, userId: string): Promise<void> {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('set role authenticated');
}

export async function asAnon(db: PGlite): Promise<void> {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.exec('set role anon');
}

/** Superuser context used for fixtures only, mirroring operator SQL. */
export async function asOperator(db: PGlite): Promise<void> {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
}

export async function rows<T = Record<string, unknown>>(
  db: PGlite,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await db.query<T>(sql, params);
  return result.rows;
}

export async function one<T = Record<string, unknown>>(
  db: PGlite,
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const [row] = await rows<T>(db, sql, params);
  if (!row) throw new Error(`expected one row for: ${sql}`);
  return row;
}

/** Returns the error message raised by a statement, or null if it succeeded. */
export async function errorOf(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
