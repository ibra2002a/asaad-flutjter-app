import type { OrderStatus, Role } from '@/lib/types';

/**
 * Mirror of public.order_transitions (supabase/migrations/20260601000001_schema.sql).
 * The database is authoritative; this copy only decides which buttons to show, and
 * tests/unit/order-rules.test.ts fails if the two ever drift apart.
 */
export const TRANSITIONS: ReadonlyArray<{ from: OrderStatus; to: OrderStatus; roles: readonly Role[] }> = [
  { from: 'submitted', to: 'accepted', roles: ['supplier', 'ops', 'admin'] },
  { from: 'submitted', to: 'cancelled', roles: ['buyer', 'supplier', 'ops', 'admin'] },
  { from: 'accepted', to: 'preparing', roles: ['supplier', 'admin'] },
  { from: 'accepted', to: 'cancelled', roles: ['supplier', 'ops', 'admin'] },
  { from: 'preparing', to: 'out_for_delivery', roles: ['supplier', 'admin'] },
  { from: 'preparing', to: 'cancelled', roles: ['supplier', 'ops', 'admin'] },
  { from: 'out_for_delivery', to: 'delivered', roles: ['supplier', 'admin'] },
  { from: 'delivered', to: 'completed', roles: ['ops', 'admin'] },
  { from: 'delivered', to: 'disputed', roles: ['buyer', 'ops', 'admin'] },
  { from: 'completed', to: 'disputed', roles: ['buyer', 'ops', 'admin'] },
  { from: 'disputed', to: 'completed', roles: ['ops', 'admin'] },
  { from: 'disputed', to: 'cancelled', roles: ['ops', 'admin'] },
];

/** Statuses a role may move an order to from the given status (excluding 'disputed', which uses the dispute flow). */
export function nextStatusesFor(role: Role, from: OrderStatus): OrderStatus[] {
  return TRANSITIONS.filter((t) => t.from === from && t.to !== 'disputed' && t.roles.includes(role)).map((t) => t.to);
}

export function canOpenDispute(role: Role, status: OrderStatus): boolean {
  return TRANSITIONS.some((t) => t.from === status && t.to === 'disputed' && t.roles.includes(role));
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  submitted: 'تم الإرسال',
  accepted: 'مقبول من المورد',
  preparing: 'قيد التجهيز',
  out_for_delivery: 'في الطريق',
  delivered: 'تم التسليم',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  disputed: 'نزاع مفتوح',
};

export const ORDER_STATUS_TONES: Record<OrderStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  submitted: 'neutral',
  accepted: 'info',
  preparing: 'info',
  out_for_delivery: 'info',
  delivered: 'success',
  completed: 'success',
  cancelled: 'danger',
  disputed: 'warning',
};

/** Verb shown on the button that moves an order to the given status. */
export const TRANSITION_BUTTON_LABELS: Record<OrderStatus, string> = {
  submitted: 'إرسال',
  accepted: 'قبول الطلب',
  preparing: 'بدء التجهيز',
  out_for_delivery: 'خرج للتوصيل',
  delivered: 'تأكيد التسليم',
  completed: 'إكمال الطلب',
  cancelled: 'إلغاء الطلب',
  disputed: 'فتح نزاع',
};
