import { useSyncExternalStore } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Settings,
    Activity,
    Key,
    LogOut,
    PanelLeft
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { usePreferences } from '@/stores/preferencesStore';
import { initials } from '@/lib/format';
import clsx from 'clsx';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Workflows' },
    { to: '/executions', icon: Activity, label: 'Executions' },
    { to: '/credentials', icon: Key, label: 'Credentials' },
    { to: '/settings', icon: Settings, label: 'Settings' },
];

// Below md the sidebar is always icon-only so content keeps enough width
const narrowQuery = typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)') : null;
const subscribeNarrow = (cb: () => void) => {
    narrowQuery?.addEventListener('change', cb);
    return () => narrowQuery?.removeEventListener('change', cb);
};
const getNarrow = () => !!narrowQuery?.matches;

export function AppLayout() {
    const isNarrow = useSyncExternalStore(subscribeNarrow, getNarrow);
    const collapsedPref = usePreferences((s) => s.sidebarCollapsed);
    const isCollapsed = collapsedPref || isNarrow;
    const setPref = usePreferences((s) => s.set);
    const logout = useAuthStore((s) => s.logout);
    const user = useAuthStore((s) => s.user);
    const location = useLocation();

    const isCanvas = location.pathname.startsWith('/canvas');

    const itemClass = (active = false) => clsx(
        "flex items-center gap-2.5 rounded-lg transition-colors duration-150 relative outline-none focus-visible:ring-2 focus-visible:ring-node-trigger/40",
        isCollapsed ? "justify-center h-9 w-9 mx-auto" : "w-full px-2.5 h-9",
        active
            ? 'bg-white/8 text-zinc-100 font-medium'
            : 'text-zinc-400 hover:bg-white/4 hover:text-zinc-200'
    );

    return (
        <div className="flex h-screen bg-background text-zinc-100 overflow-hidden">
            <aside
                className={clsx(
                    "relative flex flex-col bg-surface border-r border-[#2e2e33] transition-[width] duration-200 ease-in-out shrink-0",
                    isCollapsed ? 'w-14' : 'w-56'
                )}
            >
                {/* Logo / Brand */}
                <div className={clsx(
                    "flex items-center shrink-0 h-13",
                    isCollapsed ? "justify-center" : "px-4 gap-2.5"
                )}>
                    <img src="/favicon.svg" alt="Sentient Flow" width={26} height={26} className="shrink-0" />
                    {!isCollapsed && (
                        <span className="font-semibold text-[14px] tracking-tight text-zinc-100 truncate">
                            Sentient Flow
                        </span>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) => itemClass(isActive)}
                            title={isCollapsed ? item.label : undefined}
                        >
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-0.75 h-4 bg-node-trigger rounded-r-full" />
                                    )}
                                    <item.icon size={16} className="shrink-0" />
                                    {!isCollapsed && <span className="text-[13px] truncate">{item.label}</span>}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Sidebar footer */}
                <div className="px-2 py-2 border-t border-[#2e2e33] space-y-0.5 shrink-0">
                    <button
                        hidden={isNarrow}
                        onClick={() => setPref('sidebarCollapsed', !isCollapsed)}
                        className={itemClass()}
                        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <PanelLeft size={16} className={clsx("shrink-0 transition-transform", isCollapsed && "rotate-180")} />
                        {!isCollapsed && <span className="text-[13px]">Collapse</span>}
                    </button>

                    <div className={clsx("flex items-center gap-1 pt-1", isCollapsed && "flex-col")}>
                        <NavLink
                            to="/settings/account"
                            className={clsx(
                                "flex items-center gap-2.5 rounded-lg min-w-0 hover:bg-white/4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-node-trigger/40",
                                isCollapsed ? "justify-center h-9 w-9" : "flex-1 px-1.5 py-1.5"
                            )}
                            title={user?.email ?? 'Account'}
                        >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-node-trigger to-[#c2410c] text-[11px] font-semibold text-white">
                                {initials(user?.full_name, user?.email)}
                            </div>
                            {!isCollapsed && (
                                <div className="min-w-0 leading-tight">
                                    <div className="text-[12px] font-medium text-zinc-200 truncate">
                                        {user?.full_name || user?.email?.split('@')[0] || '…'}
                                    </div>
                                    <div className="text-[11px] text-zinc-500 truncate">{user?.email}</div>
                                </div>
                            )}
                        </NavLink>
                        <button
                            onClick={() => logout()}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/4 hover:text-zinc-200 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-node-trigger/40"
                            title="Sign out"
                            aria-label="Sign out"
                        >
                            <LogOut size={15} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <main className={clsx("flex-1", isCanvas ? "overflow-hidden" : "overflow-y-auto")}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
