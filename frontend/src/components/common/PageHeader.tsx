import type { ReactNode } from 'react';
import { Search } from 'lucide-react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageContainer({ children, width = 'max-w-6xl' }: { children: ReactNode; width?: string }) {
  return (
    <div className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <div className={`mx-auto ${width}`}>{children}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed border-[#2e2e33] bg-surface/40 p-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-hover text-zinc-400">
        {icon}
      </div>
      <h3 className="mb-1.5 text-[15px] font-medium text-zinc-200">{title}</h3>
      <p className="mb-5 max-w-xs text-[13px] text-zinc-500">{description}</p>
      {action}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative mb-4 max-w-sm">
      <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500" />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-[#2e2e33] bg-surface pr-3 pl-9 text-[13px] text-zinc-200 outline-none transition-colors placeholder:text-zinc-500 focus:border-node-trigger/50"
      />
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#2e2e33] bg-surface">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-[#2e2e33] px-4 py-3.5 last:border-b-0">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-white/5" />
          <div className="h-3 w-48 animate-pulse rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}
