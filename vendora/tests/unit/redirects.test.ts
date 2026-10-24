import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/lib/actions/types';

describe('post-login redirects (open-redirect protection)', () => {
  it('allows same-site relative paths', () => {
    expect(safeNextPath('/buyer/orders', '/')).toBe('/buyer/orders');
    expect(safeNextPath('/checkout?x=1', '/')).toBe('/checkout?x=1');
  });

  it('rejects absolute and protocol-relative URLs', () => {
    expect(safeNextPath('https://evil.example', '/')).toBe('/');
    expect(safeNextPath('//evil.example', '/')).toBe('/');
    expect(safeNextPath('/\\evil.example', '/')).toBe('/');
  });

  it('falls back when no value is supplied', () => {
    expect(safeNextPath(null, '/buyer')).toBe('/buyer');
    expect(safeNextPath('', '/buyer')).toBe('/buyer');
  });
});
