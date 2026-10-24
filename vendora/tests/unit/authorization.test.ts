import { describe, expect, it } from 'vitest';
import {
  canAccessPortal,
  canPlaceOrders,
  canSellProducts,
  canViewOrder,
  homePathFor,
  isProductPubliclyVisible,
  supplierCanSetProductStatus,
} from '@/lib/domain/authz';

const buyer = { role: 'buyer' as const, isActive: true };
const supplier = { role: 'supplier' as const, isActive: true };
const admin = { role: 'admin' as const, isActive: true };
const approvedSupplier = { kind: 'supplier' as const, verificationStatus: 'approved' as const };
const pendingSupplier = { kind: 'supplier' as const, verificationStatus: 'pending' as const };
const approvedBuyer = { kind: 'buyer' as const, verificationStatus: 'approved' as const };

describe('portal access (role-based access control)', () => {
  it('lets each role into its own portal only', () => {
    expect(canAccessPortal(buyer, 'buyer')).toBe(true);
    expect(canAccessPortal(buyer, 'supplier')).toBe(false);
    expect(canAccessPortal(buyer, 'admin')).toBe(false);
    expect(canAccessPortal(supplier, 'buyer')).toBe(false);
    expect(canAccessPortal(admin, 'admin')).toBe(true);
    expect(canAccessPortal(admin, 'supplier')).toBe(false);
  });

  it('denies suspended accounts and anonymous visitors', () => {
    expect(canAccessPortal({ role: 'buyer', isActive: false }, 'buyer')).toBe(false);
    expect(canAccessPortal(null, 'buyer')).toBe(false);
  });

  it('sends users to the right home page', () => {
    expect(homePathFor(null)).toBe('/login');
    expect(homePathFor(admin)).toBe('/admin');
    expect(homePathFor(supplier)).toBe('/supplier');
    expect(homePathFor(buyer)).toBe('/buyer');
    expect(homePathFor({ role: 'buyer', isActive: false })).toBe('/login?error=suspended');
  });
});

describe('supplier approval gate', () => {
  it('lets only approved suppliers sell', () => {
    expect(canSellProducts(approvedSupplier)).toBe(true);
    expect(canSellProducts(pendingSupplier)).toBe(false);
    expect(canSellProducts({ kind: 'supplier', verificationStatus: 'suspended' })).toBe(false);
    expect(canSellProducts({ kind: 'supplier', verificationStatus: 'rejected' })).toBe(false);
    expect(canSellProducts(approvedBuyer)).toBe(false);
    expect(canSellProducts(null)).toBe(false);
  });

  it('requires an approved buyer business and an active account to order', () => {
    expect(canPlaceOrders(buyer, approvedBuyer)).toBe(true);
    expect(canPlaceOrders({ ...buyer, isActive: false }, approvedBuyer)).toBe(false);
    expect(canPlaceOrders(buyer, { kind: 'buyer', verificationStatus: 'suspended' })).toBe(false);
    expect(canPlaceOrders(supplier, approvedBuyer)).toBe(false);
  });

  it('prevents suppliers from self-approving product status', () => {
    expect(supplierCanSetProductStatus('draft')).toBe(true);
    expect(supplierCanSetProductStatus('pending_review')).toBe(true);
    expect(supplierCanSetProductStatus('archived')).toBe(true);
    expect(supplierCanSetProductStatus('active')).toBe(false);
    expect(supplierCanSetProductStatus('rejected')).toBe(false);
  });
});

describe('product visibility', () => {
  const live = { status: 'active' as const, supplier: approvedSupplier, categoryIsActive: true };

  it('shows only active products from approved suppliers in active categories', () => {
    expect(isProductPubliclyVisible(live)).toBe(true);
  });

  it('hides unmoderated, rejected, draft and archived products', () => {
    for (const status of ['draft', 'pending_review', 'rejected', 'archived'] as const) {
      expect(isProductPubliclyVisible({ ...live, status })).toBe(false);
    }
  });

  it('hides products from suppliers that are not approved', () => {
    expect(isProductPubliclyVisible({ ...live, supplier: pendingSupplier })).toBe(false);
    expect(isProductPubliclyVisible({ ...live, supplier: null })).toBe(false);
  });

  it('hides products whose category was deactivated', () => {
    expect(isProductPubliclyVisible({ ...live, categoryIsActive: false })).toBe(false);
  });
});

describe('order data isolation', () => {
  const order = { buyerId: 'buyer-1', supplierBusinessId: 'biz-1' };

  it('lets a buyer see only their own orders', () => {
    expect(canViewOrder({ userId: 'buyer-1', role: 'buyer', businessId: 'b-buyer' }, order)).toBe(true);
    expect(canViewOrder({ userId: 'buyer-2', role: 'buyer', businessId: 'b-other' }, order)).toBe(false);
  });

  it('lets a supplier see only orders assigned to their business', () => {
    expect(canViewOrder({ userId: 's-1', role: 'supplier', businessId: 'biz-1' }, order)).toBe(true);
    expect(canViewOrder({ userId: 's-2', role: 'supplier', businessId: 'biz-2' }, order)).toBe(false);
    expect(canViewOrder({ userId: 's-3', role: 'supplier', businessId: null }, order)).toBe(false);
  });

  it('lets administrators view every order', () => {
    expect(canViewOrder({ userId: 'admin', role: 'admin', businessId: null }, order)).toBe(true);
  });
});
