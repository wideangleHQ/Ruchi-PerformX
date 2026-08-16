'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VendorAccessLevel } from '@/api/vendors';
import {
  useGrantVendorAccess,
  useRevokeVendorAccess,
  useVendorAccessGrants,
} from '@/hooks/useVendors';
import { VendorAccessGate } from '@/components/vendors/VendorAccessGate';
import { ACCESS_LEVELS, formatDate, label } from '@/components/vendors/VendorChips';
import { useUserOptions } from '@/components/vendors/pickers';

const selectClass =
  'h-8 rounded-lg border border-input bg-white px-3 text-sm text-slate-700 outline-none';

function AccessManagement() {
  const [userId, setUserId] = useState('');
  const [accessLevel, setAccessLevel] = useState<VendorAccessLevel>('VENDOR_VIEWER');

  const { data: grants = [], isLoading, isError } = useVendorAccessGrants();
  const grant = useGrantVendorAccess();
  const revoke = useRevokeVendorAccess();
  const users = useUserOptions();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/vendors"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-green-700"
        >
          <ArrowLeft size={16} />
          Vendor directory
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Access Management</h1>
        <p className="mt-1 text-slate-500">
          Who inside RUCHI can open Vendor Management. Granted by the MD and the EA,
          who hold it themselves without a row. Separate from vendor assignment and
          separate from the vendor&apos;s own portal login.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Grant access</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Employee</label>
            <select
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className={selectClass}
            >
              <option value="">Select an employee</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} ({user.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Level</label>
            <select
              value={accessLevel}
              onChange={(event) => setAccessLevel(event.target.value as VendorAccessLevel)}
              className={selectClass}
            >
              {ACCESS_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {label(level)}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="button"
            disabled={!userId || grant.isPending}
            onClick={() =>
              grant.mutate(
                { user_id: userId, access_level: accessLevel },
                { onSuccess: () => setUserId('') },
              )
            }
            className="bg-green-600 hover:bg-green-700"
          >
            {grant.isPending ? 'Granting...' : 'Grant Access'}
          </Button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Viewer reads. Manager adds vendors, assignments, contracts and documents.
          Admin adds reviews.
        </p>

        {grant.isError ? (
          <p className="mt-3 text-sm text-rose-600">Could not grant access. Try again.</p>
        ) : null}
      </section>

      {isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          Could not load the access list.
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading access list...
        </div>
      ) : grants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Nobody outside MD and EA has Vendor Management access yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Employee', 'Level', 'Granted By', 'Granted', ''].map((head) => (
                    <th
                      key={head}
                      className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grants.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {row.user_id_user?.full_name ?? row.user_id}
                      {row.user_id_user?.email ? (
                        <p className="text-xs font-normal text-slate-400">
                          {row.user_id_user.email}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-200">
                        {label(row.access_level)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {row.granted_by_id_user?.full_name ?? '-'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {formatDate(row.granted_at)}
                    </td>
                    <td className="px-5 py-4">
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(row.user_id)}
                        aria-label={`Revoke access for ${row.user_id_user?.full_name ?? row.user_id}`}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Static segment, declared alongside [id]. Next matches static before dynamic,
// so /vendors/access never binds id: "access".
export default function VendorAccessPage() {
  return (
    <VendorAccessGate requireManageAccess>
      <AccessManagement />
    </VendorAccessGate>
  );
}
