import { describe, expect, it, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase, one } from './harness';
import { ORDER_STATUSES, canTransition, type ActorRole } from '../../src/lib/domain/order-status';

describe('order status matrix: database and application agree', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  it('matches public.order_transition_allowed for every status pair and actor', async () => {
    const actors: ActorRole[] = ['buyer', 'supplier', 'admin', 'system'];
    const mismatches: string[] = [];
    let checked = 0;
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        for (const actor of actors) {
          const sqlResult = await one<{ allowed: boolean }>(
            db,
            'select public.order_transition_allowed($1::public.order_status, $2::public.order_status, $3::public.actor_role) as allowed',
            [from, to, actor],
          );
          const tsResult = canTransition(from, to, actor);
          checked += 1;
          if (sqlResult.allowed !== tsResult) {
            mismatches.push(`${from} -> ${to} as ${actor}: sql=${sqlResult.allowed} ts=${tsResult}`);
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect(checked).toBe(ORDER_STATUSES.length * ORDER_STATUSES.length * actors.length);
  });
});
