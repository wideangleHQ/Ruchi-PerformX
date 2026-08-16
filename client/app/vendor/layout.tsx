'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, LogOut } from 'lucide-react';

/**
 * The external vendor shell, separate from `(protected)` the same way
 * `app/vms/` is separate.
 *
 * The navigation is two items because a vendor can reach two screens. There is
 * deliberately no link to tasks, users, departments, scoring, leave, vendors,
 * or anything else in the employee sidebar: a vendor cannot reach those routes
 * and a link that 403s is worse than no link. If you add a nav item here, there
 * has to be a matching `/vendor/*` endpoint behind it.
 */
export default function VendorLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    queryClient.clear();
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold tracking-tight text-slate-900">
              RUCHI <span className="text-green-700">Vendor Portal</span>
            </span>
            <Link
              href="/vendor"
              className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-green-50 hover:text-green-700 sm:inline-flex"
            >
              <LayoutDashboard size={16} />
              Dashboard
            </Link>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
