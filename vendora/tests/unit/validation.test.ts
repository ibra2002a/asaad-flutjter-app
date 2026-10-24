import { describe, expect, it } from 'vitest';
import {
  commissionPercentSchema,
  disputeSchema,
  loginSchema,
  phoneSchema,
  productSchema,
  registerSchema,
} from '@/lib/validation/schemas';
import { errorCode, userMessageFor, GENERIC_ERROR_AR } from '@/lib/domain/errors';

const validProduct = {
  categoryId: '11111111-1111-4111-8111-111111111111',
  nameAr: 'زيت دوار الشمس',
  unit: 'carton',
  priceIqd: '300000',
  salePriceIqd: '',
  minOrderQty: '2',
  maxOrderQty: '',
  stockQty: '40',
  status: 'pending_review',
};

describe('registration and login validation', () => {
  const valid = {
    role: 'buyer',
    fullName: 'أحمد علي',
    legalName: 'شركة النور التجارية',
    cityCode: 'baghdad',
    phone: '0770 123 4567',
    email: 'Buyer@Example.com ',
    password: 'longpassword',
    acceptTerms: true,
  };

  it('accepts a complete registration and normalizes the email', () => {
    const parsed = registerSchema.parse(valid);
    expect(parsed.email).toBe('buyer@example.com');
  });

  it('refuses the admin role at the form level', () => {
    expect(registerSchema.safeParse({ ...valid, role: 'admin' }).success).toBe(false);
  });

  it('requires an 8+ character password and accepted terms', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
  });

  it('rejects malformed city codes (SQL-injection-safe slug format)', () => {
    expect(registerSchema.safeParse({ ...valid, cityCode: "baghdad'; drop table" }).success).toBe(false);
  });

  it('validates login inputs', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});

describe('phone numbers', () => {
  it('accepts Iraqi mobile numbers with spaces and +964 prefixes', () => {
    expect(phoneSchema.parse('0770 123 4567')).toBe('07701234567');
    expect(phoneSchema.parse('+964 770-123-4567')).toBe('+9647701234567');
  });

  it('rejects letters and too-short numbers', () => {
    expect(phoneSchema.safeParse('07701abc').success).toBe(false);
    expect(phoneSchema.safeParse('123').success).toBe(false);
  });
});

describe('product validation (server-side rules mirrored in the form)', () => {
  it('parses a valid product and converts numeric strings', () => {
    const parsed = productSchema.parse(validProduct);
    expect(parsed.priceIqd).toBe(300_000);
    expect(parsed.salePriceIqd).toBeNull();
    expect(parsed.maxOrderQty).toBeNull();
  });

  it('rejects fractional prices so money stays in whole dinars', () => {
    expect(productSchema.safeParse({ ...validProduct, priceIqd: '1500.5' }).success).toBe(false);
  });

  it('rejects a sale price that is not lower than the price', () => {
    const result = productSchema.safeParse({ ...validProduct, salePriceIqd: '300000' });
    expect(result.success).toBe(false);
  });

  it('rejects a maximum below the minimum order quantity', () => {
    expect(productSchema.safeParse({ ...validProduct, minOrderQty: '5', maxOrderQty: '3' }).success).toBe(false);
  });

  it('rejects a supplier-chosen active status (only admins can approve)', () => {
    expect(productSchema.safeParse({ ...validProduct, status: 'active' }).success).toBe(false);
  });

  it('rejects negative stock', () => {
    expect(productSchema.safeParse({ ...validProduct, stockQty: '-1' }).success).toBe(false);
  });
});

describe('dispute and commission inputs', () => {
  it('requires an item and quantity for return disputes', () => {
    const base = {
      orderId: '11111111-1111-4111-8111-111111111111',
      kind: 'return',
      reason: 'البضاعة تالفة',
    };
    expect(disputeSchema.safeParse(base).success).toBe(false);
    expect(
      disputeSchema.safeParse({ ...base, orderItemId: 'item', requestedQuantity: '2' }).success,
    ).toBe(true);
  });

  it('converts a percentage into integer basis points', () => {
    expect(commissionPercentSchema.parse('4')).toBe(400);
    expect(commissionPercentSchema.parse('3.5')).toBe(350);
    expect(commissionPercentSchema.safeParse('31').success).toBe(false);
    expect(commissionPercentSchema.safeParse('-1').success).toBe(false);
  });
});

describe('database error mapping', () => {
  it('extracts the stable code from a raised message', () => {
    expect(errorCode('INSUFFICIENT_STOCK: x has 3 available')).toBe('INSUFFICIENT_STOCK');
    expect(errorCode('something else')).toBeNull();
    expect(errorCode(undefined)).toBeNull();
  });

  it('returns Arabic text for known codes and a generic message otherwise', () => {
    expect(userMessageFor({ message: 'INSUFFICIENT_STOCK: x' })).toContain('المخزون');
    expect(userMessageFor({ message: 'relation "x" does not exist' })).toBe(GENERIC_ERROR_AR);
  });
});
