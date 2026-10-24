const iqdFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Whole Iraqi dinar amounts, e.g. "45,000 د.ع". */
export function formatIQD(amount: number | string | null | undefined): string {
  const value = Number(amount ?? 0);
  return `${iqdFormatter.format(Math.round(value))} د.ع`;
}

const dateFormatter = new Intl.DateTimeFormat('ar-IQ', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Baghdad',
  numberingSystem: 'latn',
});

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return dateFormatter.format(new Date(value));
}

const dayFormatter = new Intl.DateTimeFormat('ar-IQ', {
  dateStyle: 'medium',
  timeZone: 'Asia/Baghdad',
  numberingSystem: 'latn',
});

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return dayFormatter.format(new Date(value));
}
