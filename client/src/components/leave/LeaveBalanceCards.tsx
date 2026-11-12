'use client';

import { CalendarDays } from 'lucide-react';
import { LeaveBalance, LeaveType, leaveTypeName, remainingDays, toDays } from '@/api/leave';

type Props = {
  balances: LeaveBalance[];
  types: LeaveType[];
  isLoading?: boolean;
};

export function LeaveBalanceCards({ balances, types, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading balances...
      </div>
    );
  }

  if (!balances.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
        No leave balances for this year yet.
      </div>
    );
  }

  const totalEntitled = balances.reduce(
    (acc, b) => acc + toDays(b.entitled) + toDays(b.carried_over),
    0,
  );
  const totalUsed = balances.reduce((acc, b) => acc + toDays(b.used), 0);
  const totalRemaining = balances.reduce((acc, b) => acc + remainingDays(b), 0);

  return (
    <div className="space-y-4">
      {/* Category-wise cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {balances.map((balance) => {
          const remaining = remainingDays(balance);
          const entitled = toDays(balance.entitled) + toDays(balance.carried_over);
          const carried = toDays(balance.carried_over);
          const compensated = toDays(balance.compensated_to_key_date);

          return (
            <div key={balance.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700">
                <CalendarDays size={22} />
              </div>
              <p className="text-sm font-medium text-slate-500">{leaveTypeName(types, balance.leave_type_id)}</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{remaining}</p>
              <p className="mt-1 text-xs text-slate-500">
                {toDays(balance.used)} used of {entitled} day{entitled === 1 ? '' : 's'}
                {carried ? ` (${carried} carried over)` : ''}
                {compensated > 0 ? ` [${compensated} compensated]` : ''}
              </p>
            </div>
          );
        })}

        {/* Total Summary Card */}
        <div className="flex flex-col rounded-2xl border border-green-200 bg-green-50/50 p-5 shadow-sm">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-green-600 text-white">
            <CalendarDays size={22} />
          </div>
          <p className="text-sm font-semibold text-green-900">Total Leave Remaining</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-green-700">{Math.round(totalRemaining * 100) / 100}</p>
          <p className="mt-1 text-xs text-green-800">
            {Math.round(totalUsed * 100) / 100} used of {Math.round(totalEntitled * 100) / 100} total entitled days
          </p>
        </div>
      </section>
    </div>
  );
}
