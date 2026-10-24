import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const inputClass =
  'block w-full min-h-11 rounded-lg border border-line bg-white px-3 py-2 text-base text-ink placeholder:text-muted/70 ' +
  'focus:border-brand-600 focus:outline-2 focus:outline-brand-600/40 disabled:bg-slate-50 aria-[invalid=true]:border-danger';

type FieldProps = {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

/** Label + control + error text. The control is passed as children and gets id/aria attributes from the caller. */
export function Field({ label, name, error, hint, children }: FieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ name, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { name: string; error?: string }) {
  return (
    <input
      id={name}
      name={name}
      className={inputClass}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
      {...props}
    />
  );
}

export function TextArea({ name, error, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { name: string; error?: string }) {
  return (
    <textarea
      id={name}
      name={name}
      className={inputClass}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
      {...props}
    />
  );
}

export function SelectInput({
  name,
  error,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { name: string; error?: string; children: ReactNode }) {
  return (
    <select
      id={name}
      name={name}
      className={inputClass}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
      {...props}
    >
      {children}
    </select>
  );
}
