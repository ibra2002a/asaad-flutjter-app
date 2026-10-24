import { connection } from 'next/server';

/** ISO timestamp N days before the current request. Marks the route as request-time (not prerendered). */
export async function daysAgoIso(days: number): Promise<string> {
  await connection();
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
}
