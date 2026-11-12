'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { LeaveBalanceRow, toDays } from '@/api/leave';
import {
  useAllLeaveBalances,
  useEmployeeLeaveSummary,
  useUpdateLeaveBalance,
} from '@/hooks/useLeave';
import { canEditLeaveBalances, canManageLeaveBalances } from '@/components/leave/access';
import { leaveBalanceSchema } from '@/lib/leaveValidation';

export default function LeaveBalancesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    entitled: string;
    used: string;
    carried_over: string;
    compensated_to_key_date: string;
    remarks: string;
  }>({
    entitled: '',
    used: '',
    carried_over: '',
    compensated_to_key_date: '',
    remarks: '',
  });
  const [error, setError] = useState<string | null>(null);

  const allowed = canManageLeaveBalances(user?.role);
  const canEdit = canEditLeaveBalances(user?.role);
  const { data: balances = [], isLoading } = useAllLeaveBalances(undefined, allowed);
  const { data: userSummary, isLoading: summaryLoading } = useEmployeeLeaveSummary(
    selectedUserId,
    undefined,
    detailModalOpen,
  );
  const update = useUpdateLeaveBalance();

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return balances;
    return balances.filter(
      (row) =>
        row.user_id_user?.full_name?.toLowerCase().includes(needle) ||
        row.user_id_user?.personnel_number?.toLowerCase().includes(needle) ||
        row.user_id_user?.email?.toLowerCase().includes(needle) ||
        row.leave_type?.name?.toLowerCase().includes(needle),
    );
  }, [balances, search]);

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
        You do not have permission to view administrative leave balances.
      </div>
    );
  }

  const startEdit = (row: LeaveBalanceRow) => {
    setEditing(row.id);
    setError(null);
    setDraft({
      entitled: String(toDays(row.entitled)),
      used: String(toDays(row.used)),
      carried_over: String(toDays(row.carried_over)),
      compensated_to_key_date: String(toDays(row.compensated_to_key_date)),
      remarks: '',
    });
  };

  const save = async (row: LeaveBalanceRow) => {
    const parsed = leaveBalanceSchema.safeParse({
      entitled: draft.entitled === '' ? undefined : Number(draft.entitled),
      used: draft.used === '' ? undefined : Number(draft.used),
      carried_over: draft.carried_over === '' ? undefined : Number(draft.carried_over),
      compensated_to_key_date:
        draft.compensated_to_key_date === ''
          ? undefined
          : Number(draft.compensated_to_key_date),
      remarks: draft.remarks.trim() || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the values');
      return;
    }
    try {
      await update.mutateAsync({ id: row.id, payload: parsed.data });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    }
  };

  const openUserDetail = (userId: string) => {
    setSelectedUserId(userId);
    setDetailModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/leave"
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={14} />
          Leave
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Leave balances
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Employee-specific leave balances, entitlements, usage, and adjustments.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, personnel no, or type"
          className="rounded-xl pl-9"
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading balances...
        </div>
      ) : !rows.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          {balances.length
            ? 'Nothing matches that search.'
            : 'No balances yet.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Personnel No</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium tabular-nums">Entitled</th>
                <th className="px-4 py-3 font-medium tabular-nums">Used</th>
                <th className="px-4 py-3 font-medium tabular-nums">Carried</th>
                <th className="px-4 py-3 font-medium tabular-nums">Compensated</th>
                <th className="px-4 py-3 font-medium tabular-nums">Remaining</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const isEditing = editing === row.id;
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <button
                        type="button"
                        onClick={() => openUserDetail(row.user_id)}
                        className="text-left font-semibold text-green-700 hover:underline"
                      >
                        {row.user_id_user?.full_name ?? 'Unknown'}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {row.user_id_user?.personnel_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.leave_type?.name ?? 'Unknown'}</td>
                    {(['entitled', 'used', 'carried_over', 'compensated_to_key_date'] as const).map(
                      (key) => (
                        <td key={key} className="px-4 py-3 tabular-nums text-slate-700">
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              className="h-8 w-20 rounded-lg text-xs"
                              value={draft[key]}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                            />
                          ) : (
                            toDays(row[key])
                          )}
                        </td>
                      ),
                    )}
                    <td className="px-4 py-3 font-bold tabular-nums text-slate-900">
                      {toDays(row.remaining)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg text-xs"
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-lg bg-green-700 text-xs hover:bg-green-800"
                            disabled={update.isPending}
                            onClick={() => save(row)}
                          >
                            Save
                          </Button>
                        </div>
                      ) : canEdit ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg text-xs"
                          onClick={() => startEdit(row)}
                        >
                          Correct
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-lg text-xs text-slate-500 hover:text-slate-800"
                          onClick={() => openUserDetail(row.user_id)}
                        >
                          View
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Employee Detailed Summary Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Employee Leave Summary
            </DialogTitle>
          </DialogHeader>

          {summaryLoading || !userSummary ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Loading employee leave record...
            </div>
          ) : (
            <div className="space-y-5 text-xs text-slate-700">
              {/* Employee Header */}
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4">
                <div>
                  <span className="text-slate-400">Employee Name</span>
                  <p className="font-semibold text-slate-900">{userSummary.user.full_name}</p>
                </div>
                <div>
                  <span className="text-slate-400">Personnel Number</span>
                  <p className="font-mono font-semibold text-slate-900">
                    {userSummary.user.personnel_number ?? 'Not assigned'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Role / Designation</span>
                  <p className="font-medium text-slate-800">{userSummary.user.role}</p>
                </div>
                <div>
                  <span className="text-slate-400">Department</span>
                  <p className="font-medium text-slate-800">
                    {userSummary.user.departments?.name ?? 'General'}
                  </p>
                </div>
              </div>

              {/* Leave Balances Grid */}
              <div>
                <h4 className="font-semibold text-slate-900">Current Balances</h4>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {userSummary.balances.map((b) => (
                    <div key={b.id} className="rounded-xl border border-slate-200 p-3">
                      <p className="font-semibold text-slate-900">{b.leave_type.name}</p>
                      <p className="mt-1 text-2xl font-bold text-green-700">{b.remaining}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Entitled: {toDays(b.entitled)} | Used: {toDays(b.used)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Balance Adjustments / Opening Balances */}
              <div>
                <h4 className="font-semibold text-slate-900">
                  Opening Balances & Adjustments ({userSummary.adjustments.length})
                </h4>
                {userSummary.adjustments.length === 0 ? (
                  <p className="mt-1 text-slate-400">No adjustments recorded for this financial year.</p>
                ) : (
                  <div className="mt-2 overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">Type</th>
                          <th className="px-3 py-2 font-medium">Category</th>
                          <th className="px-3 py-2 font-medium">Amount</th>
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {userSummary.adjustments.map((adj) => (
                          <tr key={adj.id}>
                            <td className="px-3 py-2 font-medium">{adj.adjustment_type}</td>
                            <td className="px-3 py-2">{adj.leave_type?.name ?? '—'}</td>
                            <td className="px-3 py-2 font-mono font-semibold">{adj.amount}</td>
                            <td className="px-3 py-2 text-slate-500">
                              {adj.effective_date?.slice(0, 10)}
                            </td>
                            <td className="px-3 py-2 text-slate-600">{adj.remarks ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Leave Applications History */}
              <div>
                <h4 className="font-semibold text-slate-900">
                  Applications History ({userSummary.applications.length})
                </h4>
                {userSummary.applications.length === 0 ? (
                  <p className="mt-1 text-slate-400">No leave applications for this financial year.</p>
                ) : (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">Dates</th>
                          <th className="px-3 py-2 font-medium">Days</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {userSummary.applications.map((app) => (
                          <tr key={app.id}>
                            <td className="px-3 py-2">
                              {app.start_date.slice(0, 10)} to {app.end_date.slice(0, 10)}
                            </td>
                            <td className="px-3 py-2 font-mono">{toDays(app.days_count)}</td>
                            <td className="px-3 py-2 font-semibold">{app.status}</td>
                            <td className="px-3 py-2 text-slate-600">{app.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
