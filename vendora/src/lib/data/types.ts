/** Row shapes returned by the queries in this app. Mirrors the SQL migrations. */
import type { AppRole, BusinessKind, VerificationStatus } from '../domain/authz';
import type { OrderStatus } from '../domain/order-status';

export interface Profile {
  id: string;
  role: AppRole;
  full_name: string;
  phone: string | null;
  is_active: boolean;
}

export interface Business {
  id: string;
  owner_id: string;
  kind: BusinessKind;
  legal_name: string;
  description_ar: string | null;
  tax_number: string | null;
  city_code: string;
  street_address: string | null;
  phone: string;
  verification_status: VerificationStatus;
  review_note: string | null;
}

export interface Category {
  id: string;
  slug: string;
  name_ar: string;
  description_ar: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface City {
  code: string;
  name_ar: string;
}

export type ProductStatus = 'draft' | 'pending_review' | 'active' | 'rejected' | 'archived';

export interface Product {
  id: string;
  supplier_id: string;
  category_id: string;
  name_ar: string;
  description_ar: string | null;
  unit: string;
  price_iqd: number;
  sale_price_iqd: number | null;
  min_order_qty: number;
  max_order_qty: number | null;
  stock_qty: number;
  status: ProductStatus;
  moderation_note: string | null;
  created_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  storage_path: string;
  position: number;
}

export interface Address {
  id: string;
  profile_id: string;
  label: string;
  city_code: string;
  district: string;
  address_line: string;
  phone: string;
  is_default: boolean;
}

export interface OrderRow {
  id: string;
  order_number: string;
  buyer_id: string;
  buyer_business_id: string;
  supplier_business_id: string;
  status: OrderStatus;
  delivery_city_code: string;
  delivery_address: { label: string; district: string; address_line: string; phone: string; city_code: string };
  subtotal_iqd: number;
  delivery_fee_iqd: number;
  total_iqd: number;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name_snapshot: string;
  unit_snapshot: string;
  unit_price_iqd: number;
  quantity: number;
  returned_quantity: number;
  line_total_iqd: number;
  commission_rate_bp: number;
}

export interface OrderEventRow {
  id: number;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor_role: 'buyer' | 'supplier' | 'admin' | 'system';
  reason: string | null;
  created_at: string;
}

export interface DisputeRow {
  id: string;
  order_id: string;
  kind: 'return' | 'quality' | 'other';
  order_item_id: string | null;
  requested_quantity: number | null;
  reason: string;
  status: 'open' | 'resolved';
  resolution: 'partial_return' | 'refund_full' | 'no_action' | null;
  resolution_note: string | null;
  created_at: string;
}
