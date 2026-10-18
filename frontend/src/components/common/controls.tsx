import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary:
    'bg-node-trigger text-white hover:bg-accent-hover disabled:bg-surface-hover disabled:text-zinc-500',
  secondary:
    'border border-[#2e2e33] bg-transparent text-zinc-300 hover:bg-white/5 hover:text-zinc-100 disabled:text-zinc-600',
  ghost: 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 disabled:text-zinc-600',
  danger:
    'bg-red-500/90 text-white hover:bg-red-500 disabled:bg-surface-hover disabled:text-zinc-500',
};

export function Btn({
  variant = 'primary',
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-node-trigger/40 disabled:cursor-not-allowed [&_svg]:size-3.5 [&_svg]:shrink-0',
        variants[variant],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </button>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function TextInput({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-9 w-full rounded-lg border border-[#2e2e33] bg-background px-3 text-[13px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-node-trigger/50 focus:ring-2 focus:ring-node-trigger/10 disabled:cursor-not-allowed disabled:text-zinc-500',
          invalid && 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/10',
          className
        )}
        {...props}
      />
    );
  }
);

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[12px] font-medium text-zinc-300">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] text-red-400">{error}</p>
      ) : (
        hint && <p className="text-[11px] text-zinc-500">{hint}</p>
      )}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-node-trigger/40 disabled:cursor-not-allowed disabled:opacity-40',
        checked ? 'bg-node-trigger' : 'bg-[#3a3a40]'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4.5' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-zinc-500/10 text-zinc-400',
    success: 'bg-emerald-400/10 text-emerald-400',
    warning: 'bg-amber-400/10 text-amber-400',
    danger: 'bg-red-400/10 text-red-400',
    accent: 'bg-node-trigger/10 text-node-trigger',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', tones[tone])}>
      {children}
    </span>
  );
}

/** Six-digit one-time code input (digits only). */
export function CodeInput({
  id,
  value,
  onChange,
  autoFocus,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <TextInput
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="123456"
      autoFocus={autoFocus}
      className="font-mono tracking-[0.3em]"
    />
  );
}
