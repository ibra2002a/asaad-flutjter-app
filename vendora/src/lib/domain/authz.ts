/**
 * Pure authorization rules. The database enforces the same rules with RLS and
 * SECURITY DEFINER checks; these helpers decide what the UI and server actions
 * show before they call the database.
 */
export type AppRole = 'buyer' | 'supplier' | 'admin';
export type Portal = AppRole;
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type BusinessKind = 'buyer' | 'supplier';

export interface BusinessState {
  kind: BusinessKind;
  verificationStatus: VerificationStatus;
}

export interface ProfileState {
  role: AppRole;
  isActive: boolean;
}

/** Users only enter their own portal. Admins use /admin only. */
export function canAccessPortal(profile: ProfileState | null, portal: Portal): boolean {
  return profile !== null && profile.isActive && profile.role === portal;
}

/** Where a signed-in user should land after login or when hitting the wrong portal. */
export function homePathFor(profile: ProfileState | null): string {
  if (!profile) return '/login';
  if (!profile.isActive) return '/login?error=suspended';
  switch (profile.role) {
    case 'admin':
      return '/admin';
    case 'supplier':
      return '/supplier';
    case 'buyer':
      return '/buyer';
  }
}

export function canSellProducts(business: BusinessState | null): boolean {
  return business?.kind === 'supplier' && business.verificationStatus === 'approved';
}

export function canPlaceOrders(profile: ProfileState | null, business: BusinessState | null): boolean {
  return (
    profile !== null &&
    profile.isActive &&
    profile.role === 'buyer' &&
    business?.kind === 'buyer' &&
    business.verificationStatus === 'approved'
  );
}

/** Mirrors products_public_read: the public sees only moderated, live products. */
export function isProductPubliclyVisible(input: {
  status: 'draft' | 'pending_review' | 'active' | 'rejected' | 'archived';
  supplier: BusinessState | null;
  categoryIsActive: boolean;
}): boolean {
  return (
    input.status === 'active' &&
    input.supplier?.kind === 'supplier' &&
    input.supplier.verificationStatus === 'approved' &&
    input.categoryIsActive
  );
}

/** Statuses a supplier may choose for their own product. Admins alone approve or reject. */
export const SUPPLIER_SETTABLE_PRODUCT_STATUSES = ['draft', 'pending_review', 'archived'] as const;

export function supplierCanSetProductStatus(status: string): boolean {
  return (SUPPLIER_SETTABLE_PRODUCT_STATUSES as readonly string[]).includes(status);
}

export function canViewOrder(
  viewer: { userId: string; role: AppRole; businessId: string | null },
  order: { buyerId: string; supplierBusinessId: string },
): boolean {
  if (viewer.role === 'admin') return true;
  if (viewer.role === 'buyer') return order.buyerId === viewer.userId;
  return viewer.businessId !== null && viewer.businessId === order.supplierBusinessId;
}
