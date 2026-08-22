'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { LeaveType } from '@/api/leave';
import { useLeaveTypes } from '@/hooks/useLeave';
import { LeaveTypeDialog } from '@/components/leave/LeaveTypeDialog';
import { canManageLeaveTypes } from '@/components/leave/access';

/**
 * Leave types, the screen that unblocks leave.
 *
 * `leave_types` is empty on a fresh install and nothing in the company can
 * apply for leave until a row exists. The endpoints shipped in Phase 2 with no
 * form in front of them, so this was an API-only operation until now.
 */
export default function LeaveTypesPage() {
  const { user } = useAuth();
  const { data: types = [], isLoading } = useLeaveTypes();
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [creating, setCreating] = useState(false);

  if (!canManageLeaveTypes(user?.role)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
        Leave types are managed by HR.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/leave"
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={14} />
            Leave
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Leave types
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Entitlements, carry forward and proof rules. Nobody can apply for leave until at
            least one active type exists.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setCreating(true)}
          className="gap-2 bg-green-600 hover:bg-green-700"
        >
          <Plus size={16} />
          New type
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading types...
        </div>
      ) : !types.length ? (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-10 text-center shadow-sm">
          <Settings2 className="mx-auto mb-3 text-amber-600" size={28} />
          <p className="text-sm font-medium text-amber-900">No leave types yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-amber-800">
            Leave is unusable until one exists. The plan assumed five: casual, sick, earned,
            unpaid and comp-off.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium tabular-nums">Days a year</th>
                <th className="px-4 py-3 font-medium">Paid</th>
                <th className="px-4 py-3 font-medium">Carry forward</th>
                <th className="px-4 py-3 font-medium">Proof</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {types.map((type) => (
                <tr key={type.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{type.name}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {type.annual_entitlement}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{type.is_paid ? 'Paid' : 'Unpaid'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {type.carry_forward ? `Up to ${type.max_carry_forward}` : 'No'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {type.requires_proof ? 'Required' : 'Not required'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        type.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {type.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(type)}
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <LeaveTypeDialog
          type={editing}
          open
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
