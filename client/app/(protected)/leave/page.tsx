'use client';

import Link from 'next/link';
import { CalendarDays, Plus, Settings2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { leaveTypeName, toDays } from '@/api/leave';
import { useLeaveBalance, useLeaveTypes, useMyLeaveApplications } from '@/hooks/useLeave';
import { LeaveBalanceCards } from '@/components/leave/LeaveBalanceCards';
import { LeaveStatusChip } from '@/components/leave/LeaveStatusChip';
import {
  canActOnLeave,
  canManageLeaveBalances,
  canManageLeaveTypes,
  canReadLeaveReports,
} from '@/components/leave/access';
import { formatLeaveDate } from '@/lib/leaveValidation';

export default function MyLeavePage() {
  const { user } = useAuth();
  const { data: balances = [], isLoading: balancesLoading } = useLeaveBalance();
  const { data: types = [] } = useLeaveTypes();
  const { data: applications = [], isLoading } = useMyLeaveApplications();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            <CalendarDays size={14} />
            Leave
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">My Leave</h1>
          <p className="mt-1 text-sm text-slate-500">Your balances, applications and their status.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canActOnLeave(user?.role) ? (
            <Link href="/leave/approvals">
              <Button type="button" variant="outline" className="gap-2">
                <Users size={16} />
                Pending Approvals
              </Button>
            </Link>
          ) : null}
          {/* One button per admin screen rather than one Admin section, because
              the three routes do not share a role list: ADMIN may define types
              but not read balances, and the MD may read the report but not edit
              a type. See components/leave/access.ts. */}
          {canManageLeaveTypes(user?.role) ? (
            <Link href="/leave/admin/types">
              <Button type="button" variant="outline" className="gap-2">
                <Settings2 size={16} />
                Leave Types
              </Button>
            </Link>
          ) : null}
          {canManageLeaveBalances(user?.role) ? (
            <Link href="/leave/admin/balances">
              <Button type="button" variant="outline">
                Balances
              </Button>
            </Link>
          ) : null}
          {canReadLeaveReports(user?.role) ? (
            <Link href="/leave/admin/reports">
              <Button type="button" variant="outline">
                Report
              </Button>
            </Link>
          ) : null}
          <Link href="/leave/apply">
            <Button type="button" className="gap-2 bg-green-600 hover:bg-green-700">
              <Plus size={16} />
              Apply for Leave
            </Button>
          </Link>
        </div>
      </div>

      <LeaveBalanceCards balances={balances} types={types} isLoading={balancesLoading} />

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading applications...
        </div>
      ) : !applications.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          You have not applied for any leave yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Type', 'Dates', 'Days', 'Reason', 'Status', 'Applied On'].map((head) => (
                    <th key={head} className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((application) => (
                  <tr key={application.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      <Link href={`/leave/${application.id}`} className="hover:text-green-700">
                        {leaveTypeName(types, application.leave_type_id)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {formatLeaveDate(application.start_date)} - {formatLeaveDate(application.end_date)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{toDays(application.days_count)}</td>
                    <td className="max-w-[320px] px-5 py-4 text-slate-600">
                      <p className="line-clamp-2">{application.reason}</p>
                    </td>
                    <td className="px-5 py-4">
                      <LeaveStatusChip status={application.status} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                      {formatLeaveDate(application.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
            {applications.length} application{applications.length === 1 ? '' : 's'}
          </div>
        </div>
      )}
    </div>
  );
}
