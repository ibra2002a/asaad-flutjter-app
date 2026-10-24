/**
 * The single source of truth in the application for the order lifecycle.
 * The database enforces the same matrix in public.order_transition_allowed();
 * tests/db/order-status-parity.test.ts asserts both agree for every combination.
 */
export const ORDER_STATUSES = [
  'submitted',
  'accepted',
  'preparing',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
  'disputed',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type ActorRole = 'buyer' | 'supplier' | 'admin' | 'system';

export const ORDER_STATUS_LABEL_AR: Record<OrderStatus, string> = {
  submitted: 'تم استلام الطلب',
  accepted: 'تم قبول الطلب',
  preparing: 'جاري تجهيز الطلب',
  out_for_delivery: 'الطلب في الطريق',
  delivered: 'تم تسليم الطلب',
  completed: 'اكتمل الطلب',
  cancelled: 'تم إلغاء الطلب',
  disputed: 'نزاع مفتوح',
};

/** Order of the happy path, used for the tracking timeline. */
export const ORDER_TIMELINE: readonly OrderStatus[] = [
  'submitted',
  'accepted',
  'preparing',
  'out_for_delivery',
  'delivered',
  'completed',
];

type Transition = { from: OrderStatus; to: OrderStatus; actors: readonly ActorRole[] };

const TRANSITIONS: readonly Transition[] = [
  { from: 'submitted', to: 'accepted', actors: ['supplier', 'admin'] },
  { from: 'submitted', to: 'cancelled', actors: ['buyer', 'supplier', 'admin'] },
  { from: 'accepted', to: 'preparing', actors: ['supplier', 'admin'] },
  { from: 'accepted', to: 'cancelled', actors: ['buyer', 'admin'] },
  { from: 'preparing', to: 'out_for_delivery', actors: ['supplier', 'admin'] },
  { from: 'preparing', to: 'cancelled', actors: ['admin'] },
  { from: 'out_for_delivery', to: 'delivered', actors: ['supplier', 'admin'] },
  { from: 'delivered', to: 'completed', actors: ['buyer', 'admin'] },
];

export function canTransition(from: OrderStatus, to: OrderStatus, actor: ActorRole): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to && t.actors.includes(actor));
}

export function allowedNextStatuses(from: OrderStatus, actor: ActorRole): OrderStatus[] {
  return TRANSITIONS.filter((t) => t.from === from && t.actors.includes(actor)).map((t) => t.to);
}

export function isTerminal(status: OrderStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

/** Buyers may open a dispute only after delivery. */
export function canOpenDispute(status: OrderStatus): boolean {
  return status === 'delivered' || status === 'completed';
}

export function isStatusChangeReasonRequired(to: OrderStatus, actor: ActorRole): boolean {
  return to === 'cancelled' && actor !== 'buyer';
}

export function timelineIndex(status: OrderStatus): number {
  return ORDER_TIMELINE.indexOf(status);
}
