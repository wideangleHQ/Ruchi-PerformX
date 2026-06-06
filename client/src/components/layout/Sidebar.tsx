'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  ArrowRightLeft,
  Bell,
  Trophy,
  BarChart3,
  Coins,
  Users,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { href: '/tasks', label: 'Tasks', icon: <ClipboardList size={20} /> },
  { href: '/requests', label: 'Requests', icon: <FileText size={20} /> },
  { href: '/transfers', label: 'Transfers', icon: <ArrowRightLeft size={20} /> },
  { href: '/notifications', label: 'Notifications', icon: <Bell size={20} /> },
  { href: '/scoring', label: 'Scoring', icon: <Trophy size={20} /> },
  { href: '/analytics', label: 'Analytics', icon: <BarChart3 size={20} /> },
  { href: '/incentives', label: 'Incentives', icon: <Coins size={20} /> },
  { href: '/admin', label: 'Admin', icon: <Users size={20} />, roles: ['ADMIN'] },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const visibleItems = navItems.filter(
    (item) => !item.roles || (user?.role && item.roles.includes(user.role))
  );

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      <div className="fixed right-4 top-4 z-50 md:hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-xl bg-white p-2 shadow-lg ring-1 ring-slate-200"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-700 to-green-500 font-black text-white shadow-sm">
              RPX
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-green-700">RUCHI</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Enterprise
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-green-50 text-green-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-green-700'
                }`}
              >
                <span
                  className={isActive ? 'text-green-700' : 'text-slate-400 group-hover:text-green-600'}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-700 font-bold text-white text-sm">
              {(user?.fullName || 'MD').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-slate-500">Logged in as</p>
              <p className="truncate text-sm font-semibold text-slate-800">{user?.role || 'MD'}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 hover:border-red-100"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
