import { NavLink, Outlet } from 'react-router-dom';
import { Bell, Settings as SettingsIcon, Shield, User } from 'lucide-react';
import clsx from 'clsx';
import { PageContainer, PageHeader } from '@/components/common/PageHeader';

const SECTIONS = [
  { to: 'account', icon: User, label: 'Account', desc: 'Profile and account details' },
  { to: 'security', icon: Shield, label: 'Security', desc: 'Password and two-factor auth' },
  { to: 'notifications', icon: Bell, label: 'Notifications', desc: 'Run alerts and desktop notifications' },
  { to: 'general', icon: SettingsIcon, label: 'General', desc: 'Editor and display defaults' },
];

export function SettingsLayout() {
  return (
    <PageContainer width="max-w-5xl">
      <PageHeader title="Settings" description="Manage your account and application preferences" />

      <div className="flex flex-col gap-6 md:flex-row md:gap-10">
        {/* Section nav: horizontal tabs on small screens, sidebar on md+ */}
        <nav
          aria-label="Settings sections"
          className="-mx-1 flex shrink-0 gap-1 overflow-x-auto border-b border-[#2e2e33] px-1 pb-px md:mx-0 md:w-52 md:flex-col md:self-start md:overflow-visible md:border-b-0 md:px-0 md:pb-0 md:sticky md:top-6"
        >
          {SECTIONS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex shrink-0 items-center gap-2.5 whitespace-nowrap px-3 text-[13px] transition-colors',
                  'h-9 border-b-2 md:rounded-lg md:border-b-0',
                  isActive
                    ? 'border-node-trigger font-medium text-zinc-100 md:bg-white/6'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 md:hover:bg-white/3'
                )
              }
            >
              <Icon size={15} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-6 pb-10">
          <Outlet />
        </div>
      </div>
    </PageContainer>
  );
}

export function SettingsPageTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="hidden md:block">
      <h2 className="text-[16px] font-semibold text-zinc-100">{title}</h2>
      <p className="mt-0.5 text-[13px] text-zinc-500">{description}</p>
    </div>
  );
}
