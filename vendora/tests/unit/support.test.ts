import { describe, expect, it } from 'vitest';
import { detectImageType, MAX_IMAGE_BYTES, validateImageFile } from '@/lib/image';
import { messageForDbError } from '@/lib/errors';
import { formatIQD } from '@/lib/format';
import { COMMISSION_STATUS_LABELS } from '@/lib/labels';

const encoder = new TextEncoder();

describe('image signature validation', () => {
  it('recognises JPEG, PNG and WebP by their first bytes', () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))?.ext).toBe('jpg');
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe('png');
    const webp = encoder.encode('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ');
    expect(detectImageType(webp)?.ext).toBe('webp');
  });

  it('rejects HTML, SVG, GIF and renamed files', () => {
    expect(detectImageType(encoder.encode('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(detectImageType(encoder.encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageType(encoder.encode('GIF89a......'))).toBeNull();
  });

  it('checks the size limit and the real content, not the file name', () => {
    const fakePng = new File([encoder.encode('<script>')], 'evil.png', { type: 'image/png' });
    expect(validateImageFile(fakePng, encoder.encode('<script>')).ok).toBe(false);
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' });
    expect(validateImageFile(big, new Uint8Array([0xff, 0xd8, 0xff])).ok).toBe(false);
  });
});

describe('database error messages', () => {
  it('maps known ERR_ codes to Arabic text', () => {
    expect(messageForDbError({ message: 'ERR_MIN_QUANTITY' })).toContain('الحد الأدنى');
    expect(messageForDbError({ message: 'ERR_NOT_COVERED' })).toContain('مدينة');
  });

  it('never leaks raw database text', () => {
    const msg = messageForDbError({ message: 'duplicate key value violates unique constraint "x"', code: 'XX000' });
    expect(msg).not.toMatch(/constraint|duplicate key/i);
  });

  it('turns RLS and grant errors into a forbidden message', () => {
    expect(messageForDbError({ message: 'new row violates row-level security policy' })).toContain('صلاحية');
    expect(messageForDbError({ message: 'permission denied for table orders' })).toContain('صلاحية');
  });
});

describe('formatting and labels', () => {
  it('formats whole IQD amounts', () => {
    expect(formatIQD(45000)).toBe('45,000 د.ع');
    expect(formatIQD('135000')).toBe('135,000 د.ع');
    expect(formatIQD(null)).toBe('0 د.ع');
  });

  it('describes commission states for reconciliation', () => {
    expect(Object.keys(COMMISSION_STATUS_LABELS).sort()).toEqual(['on_hold', 'paid', 'pending', 'voided']);
  });
});
