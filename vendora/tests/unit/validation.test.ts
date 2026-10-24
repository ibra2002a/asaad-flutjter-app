import { describe, expect, it } from 'vitest';
import { checkoutSchema, loginSchema, normalizePhone, productSchema, registerSchema } from '@/lib/validation';

const UUID = '33333333-3333-4333-8333-333333333333';

describe('input validation', () => {
  it('normalises Iraqi phone numbers and rejects garbage', () => {
    expect(normalizePhone('0770 123-4567')).toBe('07701234567');
    const base = {
      role: 'buyer',
      fullName: 'Ali Hassan',
      email: 'ali@example.com',
      password: 'secret123',
      businessName: 'Cafe',
      cityCode: 'baghdad',
    };
    expect(registerSchema.safeParse({ ...base, phone: '07701234567' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, phone: '12ab' }).success).toBe(false);
  });

  it('cannot register as admin or ops (role is whitelisted)', () => {
    const base = {
      fullName: 'Ali Hassan',
      email: 'ali@example.com',
      password: 'secret123',
      phone: '07701234567',
      businessName: 'Cafe',
      cityCode: 'baghdad',
    };
    expect(registerSchema.safeParse({ ...base, role: 'admin' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: 'ops' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: 'supplier' }).success).toBe(true);
  });

  it('rejects extra fields on registration and product input', () => {
    const extra = {
      role: 'buyer',
      fullName: 'Ali Hassan',
      email: 'ali@example.com',
      password: 'secret123',
      phone: '07701234567',
      businessName: 'Cafe',
      cityCode: 'baghdad',
      is_admin: true,
    };
    expect(registerSchema.safeParse(extra).success).toBe(false);
  });

  it('requires whole-dinar prices and integer minimum quantities', () => {
    const base = {
      name: 'Rice',
      categoryId: UUID,
      unit: 'sack',
      priceIqd: 45000,
      minQuantity: 2,
      stockStatus: 'in_stock',
      isPublished: true,
    };
    expect(productSchema.safeParse(base).success).toBe(true);
    expect(productSchema.safeParse({ ...base, priceIqd: 1000.5 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, priceIqd: 0 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, minQuantity: 0 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, stockStatus: 'magic' }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, price_iqd: 1 }).success).toBe(false);
  });

  it('checkout accepts only ids, quantities and delivery choices', () => {
    const valid = {
      items: [{ productId: UUID, quantity: 3 }],
      addressId: UUID,
      paymentMethod: 'cash_on_delivery',
      contactPhone: '07701234567',
      idempotencyKey: 'key-123456789',
    };
    expect(checkoutSchema.safeParse(valid).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, items: [{ productId: UUID, quantity: 0 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, paymentMethod: 'crypto' }).success).toBe(false);
  });

  it('normalises login email', () => {
    const parsed = loginSchema.safeParse({ email: '  Ali@Example.COM ', password: 'x' });
    expect(parsed.success && parsed.data.email).toBe('ali@example.com');
  });
});
