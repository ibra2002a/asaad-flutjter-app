import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  allowedNextStatuses,
  canOpenDispute,
  canTransition,
  isStatusChangeReasonRequired,
  isTerminal,
  type ActorRole,
  type OrderStatus,
} from '@/lib/domain/order-status';

describe('order status transitions', () => {
  it('follows the happy path submitted → completed for the supplier and buyer', () => {
    expect(canTransition('submitted', 'accepted', 'supplier')).toBe(true);
    expect(canTransition('accepted', 'preparing', 'supplier')).toBe(true);
    expect(canTransition('preparing', 'out_for_delivery', 'supplier')).toBe(true);
    expect(canTransition('out_for_delivery', 'delivered', 'supplier')).toBe(true);
    expect(canTransition('delivered', 'completed', 'buyer')).toBe(true);
  });

  it('blocks buyers from accepting or preparing orders', () => {
    expect(canTransition('submitted', 'accepted', 'buyer')).toBe(false);
    expect(canTransition('accepted', 'preparing', 'buyer')).toBe(false);
    expect(canTransition('out_for_delivery', 'delivered', 'buyer')).toBe(false);
  });

  it('blocks suppliers from cancelling accepted orders or confirming receipt', () => {
    expect(canTransition('accepted', 'cancelled', 'supplier')).toBe(false);
    expect(canTransition('delivered', 'completed', 'supplier')).toBe(false);
  });

  it('lets buyers cancel only before preparation starts', () => {
    expect(canTransition('submitted', 'cancelled', 'buyer')).toBe(true);
    expect(canTransition('accepted', 'cancelled', 'buyer')).toBe(true);
    expect(canTransition('preparing', 'cancelled', 'buyer')).toBe(false);
    expect(canTransition('out_for_delivery', 'cancelled', 'buyer')).toBe(false);
  });

  it('lets suppliers reject a new order but not cancel after acceptance', () => {
    expect(canTransition('submitted', 'cancelled', 'supplier')).toBe(true);
    expect(canTransition('accepted', 'cancelled', 'supplier')).toBe(false);
  });

  it('never allows skipping steps or moving backwards', () => {
    expect(canTransition('submitted', 'preparing', 'supplier')).toBe(false);
    expect(canTransition('submitted', 'completed', 'admin')).toBe(false);
    expect(canTransition('preparing', 'accepted', 'supplier')).toBe(false);
    expect(canTransition('delivered', 'out_for_delivery', 'admin')).toBe(false);
  });

  it('treats completed and cancelled as terminal', () => {
    for (const status of ORDER_STATUSES) {
      const terminal = status === 'completed' || status === 'cancelled';
      expect(isTerminal(status)).toBe(terminal);
    }
  });

  it('never lets anyone leave completed or cancelled', () => {
    const actors: ActorRole[] = ['buyer', 'supplier', 'admin'];
    for (const from of ['completed', 'cancelled'] as OrderStatus[]) {
      for (const to of ORDER_STATUSES) {
        for (const actor of actors) {
          expect(canTransition(from, to, actor)).toBe(false);
        }
      }
    }
  });

  it('keeps disputed orders out of the normal workflow', () => {
    for (const to of ORDER_STATUSES) {
      expect(canTransition('disputed', to, 'supplier')).toBe(false);
      expect(canTransition('disputed', to, 'buyer')).toBe(false);
    }
  });

  it('lists the next allowed statuses for UI buttons', () => {
    expect(allowedNextStatuses('submitted', 'supplier')).toEqual(['accepted', 'cancelled']);
    expect(allowedNextStatuses('submitted', 'buyer')).toEqual(['cancelled']);
    expect(allowedNextStatuses('completed', 'admin')).toEqual([]);
  });

  it('requires a reason for supplier and admin cancellations only', () => {
    expect(isStatusChangeReasonRequired('cancelled', 'supplier')).toBe(true);
    expect(isStatusChangeReasonRequired('cancelled', 'admin')).toBe(true);
    expect(isStatusChangeReasonRequired('cancelled', 'buyer')).toBe(false);
    expect(isStatusChangeReasonRequired('accepted', 'supplier')).toBe(false);
  });

  it('allows disputes only after delivery', () => {
    expect(canOpenDispute('delivered')).toBe(true);
    expect(canOpenDispute('completed')).toBe(true);
    expect(canOpenDispute('preparing')).toBe(false);
    expect(canOpenDispute('cancelled')).toBe(false);
  });
});
