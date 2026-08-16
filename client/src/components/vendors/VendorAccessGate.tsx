'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { ShieldOff } from 'lucide-react';
import { useVendorAccess } from '@/hooks/useVendors';

/**
 * Wraps every Vendor Management screen.
 *
 * The sidebar entry is already hidden for employees without a
 * vendor_dashboard_access row, so this only fires on a deep link, a bookmark,
 * or a link pasted into chat. Those deserve a sentence explaining who to ask,
 * not a stack trace and not a bare 403.
 *
 * `requireManageAccess` narrows the same gate to MD and EA for the access
 * management screen. The API enforces both regardless of what renders here.
 */
export function VendorAccessGate({
  children,
  requireManageAccess = false,
}: {
  children: ReactNode;
  requireManageAccess?: boolean;
}) {
  const access = useVendorAccess();

  if (access.isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Checking vendor management access...
      </div>
    );
  }

  const allowed = requireManageAccess ? access.canManageAccess : access.canRead;

  if (!allowed) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <ShieldOff size={22} />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">
          You do not have access to Vendor Management
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          {requireManageAccess
            ? 'Access is granted and revoked by the MD or the EA. Ask either of them if you need this screen.'
            : 'Vendor Management is granted per person by the MD or the EA. Ask either of them if you need it.'}
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
