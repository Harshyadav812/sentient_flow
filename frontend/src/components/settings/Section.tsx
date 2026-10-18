import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SettingsSection({
  title,
  description,
  children,
  footer,
  tone = 'default',
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border bg-surface',
        tone === 'danger' ? 'border-red-500/25' : 'border-[#2e2e33]'
      )}
    >
      <header className="px-5 pt-5 pb-4">
        <h2 className={cn('text-[14px] font-semibold', tone === 'danger' ? 'text-red-400' : 'text-zinc-100')}>
          {title}
        </h2>
        {description && <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">{description}</p>}
      </header>
      <div className="px-5 pb-5">{children}</div>
      {footer && (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#2e2e33] bg-black/15 px-5 py-3">
          {footer}
        </footer>
      )}
    </section>
  );
}

/** A label/description on the left with a control on the right. */
export function SettingRow({
  title,
  description,
  control,
  htmlFor,
}: {
  title: string;
  description?: ReactNode;
  control: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-[13px] font-medium text-zinc-200">
          {title}
        </label>
        {description && <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{description}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export function SettingRows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-[#2e2e33]">{children}</div>;
}
