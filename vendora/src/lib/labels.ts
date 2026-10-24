import type { PaymentMethod, Role, StockStatus } from '@/lib/types';

export const ROLE_LABELS: Record<Role, string> = {
  buyer: 'مشتري',
  supplier: 'مورد',
  ops: 'فريق العمليات',
  admin: 'مدير النظام',
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash_on_delivery: 'نقداً عند التسليم',
  bank_transfer: 'تحويل بنكي',
  credit_agreement: 'دفع آجل بموجب اتفاق',
};

export const STOCK_LABELS: Record<StockStatus, string> = {
  in_stock: 'متوفر',
  limited: 'كمية محدودة',
  out_of_stock: 'غير متوفر',
};

export const BUSINESS_STATUS_LABELS = {
  pending: 'قيد المراجعة',
  approved: 'معتمد',
  rejected: 'مرفوض',
  suspended: 'موقوف',
} as const;

export const COMMISSION_STATUS_LABELS = {
  pending: 'مستحقة بعد نافذة الاعتراض',
  on_hold: 'معلّقة بسبب نزاع',
  voided: 'ملغاة',
  paid: 'مُسددة',
} as const;
