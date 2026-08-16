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

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {balances.map((balance) => {
        const remaining = remainingDays(balance);
        const entitled = toDays(balance.entitled) + toDays(balance.carried_over);
        const carried = toDays(balance.carried_over);

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
            </p>
          </div>
        );
      })}
    </section>
  );
}
