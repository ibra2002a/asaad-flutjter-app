import { Badge } from './ui';
import { ORDER_STATUS_LABEL_AR, type OrderStatus } from '@/lib/domain/order-status';

const ORDER_TONE: Record<OrderStatus, 'neutral' | 'brand' | 'lime' | 'warning' | 'danger' | 'info'> = {
  submitted: 'info',
  accepted: 'brand',
  preparing: 'brand',
  out_for_delivery: 'warning',
  delivered: 'lime',
  completed: 'brand',
  cancelled: 'danger',
  disputed: 'danger',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONE[status]}>{ORDER_STATUS_LABEL_AR[status]}</Badge>;
}

const VERIFICATION_LABEL = {
  pending: ['بانتظار المراجعة', 'warning'],
  approved: ['موثّق ومعتمد', 'brand'],
  rejected: ['مرفوض', 'danger'],
  suspended: ['معلّق', 'danger'],
} as const;

export function VerificationBadge({ status }: { status: keyof typeof VERIFICATION_LABEL }) {
  const [label, tone] = VERIFICATION_LABEL[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const PRODUCT_LABEL = {
  draft: ['مسودة', 'neutral'],
  pending_review: ['قيد المراجعة', 'warning'],
  active: ['منشور', 'brand'],
  rejected: ['مرفوض', 'danger'],
  archived: ['مؤرشف', 'neutral'],
} as const;

export function ProductStatusBadge({ status }: { status: keyof typeof PRODUCT_LABEL }) {
  const [label, tone] = PRODUCT_LABEL[status];
  return <Badge tone={tone}>{label}</Badge>;
}
