'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { LeaveBalanceRow, toDays } from '@/api/leave';
import { useAllLeaveBalances, useUpdateLeaveBalance } from '@/hooks/useLeave';
import { canManageLeaveBalances } from '@/components/leave/access';
import { leaveBalanceSchema } from '@/lib/leaveValidation';

/**
 * Everybody's balances for the financial year, with HR's manual correction.
 *
 * The correction sets columns outright rather than incrementing, because it
 * exists for migrated numbers that are simply wrong. Editing here does not
 * create an application or an audit row, which is why the warning is on screen
 * rather than only in the handbook.
 */
export default function LeaveBalancesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ entitled: string; used: string; carried_over: string }>({
    entitled: '',
    used: '',
    carried_over: '',
  });
  const [error, setError] = useState<string | null>(null);

  const allowed = canManageLeaveBalances(user?.role);
  const { data: balances = [], isLoading } = useAllLeaveBalances(undefined, allowed);
  const update = useUpdateLeaveBalance();

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return balances;
    return balances.filter(
      (row) =>
        row.user_id_user?.full_name?.toLowerCase().includes(needle) ||
        row.leave_type?.name?.toLowerCase().includes(needle),
    );
  }, [balances, search]);

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
        Company-wide balances are HR only. Your own balance is on the Leave screen.
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
    });
  };

  const save = async (row: LeaveBalanceRow) => {
    const parsed = leaveBalanceSchema.safeParse({
      entitled: draft.entitled === '' ? undefined : Number(draft.entitled),
      used: draft.used === '' ? undefined : Number(draft.used),
      carried_over: draft.carried_over === '' ? undefined : Number(draft.carried_over),
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
          Every balance for the current financial year. Corrections set the value outright and
          leave no application behind them, so use them for migrated numbers rather than for
          leave somebody actually took.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by person or leave type"
          className="pl-9"
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
            : 'No balances yet. They are created the first time somebody applies for leave.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium tabular-nums">Entitled</th>
                <th className="px-4 py-3 font-medium tabular-nums">Used</th>
                <th className="px-4 py-3 font-medium tabular-nums">Carried</th>
                <th className="px-4 py-3 font-medium tabular-nums">Remaining</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const isEditing = editing === row.id;
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {row.user_id_user?.full_name ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.leave_type?.name ?? 'Unknown'}</td>
                    {(['entitled', 'used', 'carried_over'] as const).map((key) => (
                      <td key={key} className="px-4 py-3 tabular-nums text-slate-700">
                        {isEditing ? (
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-20"
                            value={draft[key]}
                            onChange={(e) =>
                              setDraft((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                          />
                        ) : (
                          toDays(row[key])
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 font-medium tabular-nums text-slate-900">
                      {toDays(row.remaining)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            disabled={update.isPending}
                            onClick={() => save(row)}
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(row)}
                        >
                          Correct
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
    </div>
  );
}
