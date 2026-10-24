/**
 * Upload validation for product images. The file extension and the browser-supplied MIME type
 * are NOT trusted: the first bytes (magic numbers) must match a supported image format.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageType = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' };

export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && pngSignature.every((b, i) => bytes[i] === b)) {
    return { mime: 'image/png', ext: 'png' };
  }
  // RIFF....WEBP
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

export function validateImageFile(file: File, bytes: Uint8Array): { ok: true; type: ImageType } | { ok: false; message: string } {
  if (file.size === 0) return { ok: false, message: 'الملف فارغ.' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, message: 'حجم الصورة يجب ألا يتجاوز 5 ميغابايت.' };
  const type = detectImageType(bytes);
  if (!type) return { ok: false, message: 'نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP.' };
  return { ok: true, type };
}
