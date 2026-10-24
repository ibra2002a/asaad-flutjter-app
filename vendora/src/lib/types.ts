// Application-level types. They mirror the database columns that the UI uses.
// The authoritative definitions are in supabase/migrations.

export const ROLES = ['buyer', 'supplier', 'ops', 'admin'] as const;
export type Role = (typeof ROLES)[number];

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

export const PAYMENT_METHODS = ['cash_on_delivery', 'bank_transfer', 'credit_agreement'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const STOCK_STATUSES = ['in_stock', 'limited', 'out_of_stock'] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const BUSINESS_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export type Viewer = {
  userId: string;
  email: string | undefined;
  role: Role;
  fullName: string;
  phone: string;
};

export type Business = {
  id: string;
  owner_id: string;
  kind: 'buyer' | 'supplier';
  name: string;
  description: string | null;
  city_code: string;
  address: string | null;
  phone: string;
  status: BusinessStatus;
};

export type City = { code: string; name_ar: string; is_pilot: boolean };
export type Category = { id: string; slug: string; name_ar: string; is_active: boolean };

export type ProductRow = {
  id: string;
  business_id: string;
  category_id: string;
  name: string;
  description: string | null;
  unit: string;
  price_iqd: number;
  min_quantity: number;
  stock_status: StockStatus;
  is_published: boolean;
  created_at: string;
};

export type ProductImage = { id: string; product_id: string; storage_path: string; sort_order: number };

export type OrderRow = {
  id: string;
  order_number: string;
  buyer_id: string;
  buyer_business_id: string;
  supplier_business_id: string;
  status: OrderStatus;
  subtotal_iqd: number;
  discount_iqd: number;
  delivery_fee_iqd: number;
  total_iqd: number;
  payment_method: PaymentMethod;
  delivery_city_code: string;
  delivery_address: string;
  contact_phone: string;
  buyer_notes: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};
