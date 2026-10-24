// Plain styling helpers. Kept out of button.tsx so server components can use them.
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'onDark';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-800 text-white hover:bg-brand-700 focus-visible:outline-brand-600',
  accent: 'bg-lime-400 text-brand-950 hover:bg-lime-500 focus-visible:outline-lime-500',
  secondary: 'border border-brand-800 text-brand-800 bg-white hover:bg-brand-50 focus-visible:outline-brand-600',
  ghost: 'text-brand-800 hover:bg-brand-50 focus-visible:outline-brand-600',
  danger: 'border border-danger text-danger bg-white hover:bg-red-50 focus-visible:outline-danger',
  onDark: 'border border-white/40 text-white bg-transparent hover:bg-white/10 focus-visible:outline-white',
};

export function buttonClass(variant: ButtonVariant = 'primary', extra = '') {
  return [
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold',
    'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    extra,
  ].join(' ');
}
