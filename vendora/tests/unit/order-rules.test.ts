import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canOpenDispute, nextStatusesFor, ORDER_STATUS_LABELS, TRANSITIONS, TRANSITION_BUTTON_LABELS } from '@/lib/orders/rules';
import { ORDER_STATUSES, type Role } from '@/lib/types';

const ROOT = join(__dirname, '..', '..');

/** Reads the transition matrix that the database migration seeds. */
function sqlTransitions(): Array<{ from: string; to: string; roles: string[] }> {
  const sql = readFileSync(join(ROOT, 'supabase/migrations/20260601000001_schema.sql'), 'utf8');
  const block = sql.slice(sql.indexOf('insert into public.order_transitions'));
  const rows = [...block.matchAll(/\('(\w+)',\s+'(\w+)',\s+array\[([^\]]+)\]\)/g)];
  return rows.map((m) => ({
    from: m[1]!,
    to: m[2]!,
    roles: [...m[3]!.matchAll(/'(\w+)'/g)].map((r) => r[1]!),
  }));
}

describe('order transition rules', () => {
  it('matches the database transition matrix exactly', () => {
    const fromSql = sqlTransitions();
    expect(fromSql.length).toBe(TRANSITIONS.length);
    for (const t of TRANSITIONS) {
      const match = fromSql.find((s) => s.from === t.from && s.to === t.to);
      expect(match, `${t.from} -> ${t.to} missing in SQL`).toBeDefined();
      expect([...match!.roles].sort()).toEqual([...t.roles].sort());
    }
  });

  it('covers every order status with a label and button text', () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_STATUS_LABELS[status]).toBeTruthy();
      expect(TRANSITION_BUTTON_LABELS[status]).toBeTruthy();
    }
  });

  it('never lets buyers or suppliers mark an order completed', () => {
    for (const role of ['buyer', 'supplier'] as Role[]) {
      for (const from of ORDER_STATUSES) {
        expect(nextStatusesFor(role, from)).not.toContain('completed');
      }
    }
  });

  it('lets a buyer cancel only before the supplier accepts', () => {
    expect(nextStatusesFor('buyer', 'submitted')).toEqual(['cancelled']);
    expect(nextStatusesFor('buyer', 'accepted')).toEqual([]);
    expect(nextStatusesFor('buyer', 'preparing')).toEqual([]);
  });

  it('follows the supplier fulfilment path', () => {
    expect(nextStatusesFor('supplier', 'submitted')).toEqual(['accepted', 'cancelled']);
    expect(nextStatusesFor('supplier', 'accepted')).toEqual(['preparing', 'cancelled']);
    expect(nextStatusesFor('supplier', 'preparing')).toEqual(['out_for_delivery', 'cancelled']);
    expect(nextStatusesFor('supplier', 'out_for_delivery')).toEqual(['delivered']);
    expect(nextStatusesFor('supplier', 'delivered')).toEqual([]);
  });

  it('lets only ops and admins complete delivered or disputed orders', () => {
    expect(nextStatusesFor('ops', 'delivered')).toContain('completed');
    expect(nextStatusesFor('admin', 'disputed')).toEqual(expect.arrayContaining(['completed', 'cancelled']));
    expect(nextStatusesFor('supplier', 'disputed')).toEqual([]);
  });

  it('allows opening disputes only where the matrix permits it', () => {
    expect(canOpenDispute('buyer', 'delivered')).toBe(true);
    expect(canOpenDispute('buyer', 'completed')).toBe(true);
    expect(canOpenDispute('buyer', 'submitted')).toBe(false);
    expect(canOpenDispute('supplier', 'delivered')).toBe(false);
    expect(canOpenDispute('ops', 'delivered')).toBe(true);
  });
});
