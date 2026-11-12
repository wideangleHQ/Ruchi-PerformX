'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Filter, Plus, Search, Settings2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { LeaveBalanceRow, LeaveStatus, leaveTypeName, toDays } from '@/api/leave';
import {
  useAllLeaveBalances,
  useEmployeeLeaveSummary,
  useLeaveBalance,
  useLeaveTypes,
  useMyLeaveApplications,
  useOthersLeaveApplications,
} from '@/hooks/useLeave';
import { LeaveBalanceCards } from '@/components/leave/LeaveBalanceCards';
import { LeaveStatusChip } from '@/components/leave/LeaveStatusChip';
import {
  canActOnLeave,
  canManageLeaveBalances,
  canManageLeaveTypes,
  canReadLeaveReports,
  canViewOthersLeaves,
} from '@/components/leave/access';
import { formatLeaveDate } from '@/lib/leaveValidation';

export default function LeaveManagementPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'my_leaves' | 'others_leaves'>('my_leaves');

  // Filters for My Leaves
  const [myStatusFilter, setMyStatusFilter] = useState<LeaveStatus | ''>('');
  const [myTypeFilter, setMyTypeFilter] = useState<string>('');

  // Filters for Others' Leaves
  const [othersSearch, setOthersSearch] = useState('');
  const [othersStatusFilter, setOthersStatusFilter] = useState<LeaveStatus | ''>('');
  const [othersTypeFilter, setOthersTypeFilter] = useState<string>('');
  const [othersSubTab, setOthersSubTab] = useState<'balances' | 'applications'>('balances');

  const canSeeOthers = canViewOthersLeaves(user?.role);

  // Queries
  const { data: balances = [], isLoading: balancesLoading } = useLeaveBalance();
  const { data: types = [] } = useLeaveTypes();
  const { data: myApplications = [], isLoading: myAppsLoading } = useMyLeaveApplications({
    status: myStatusFilter || undefined,
  });

  // Queries for Others' Leaves
  const { data: othersBalancesResult, isLoading: othersBalancesLoading } = useAllLeaveBalances(
    {
      q: othersSearch.trim() || undefined,
      leave_type_id: othersTypeFilter || undefined,
    },
    canSeeOthers && activeTab === 'others_leaves' && othersSubTab === 'balances',
  );

  const { data: othersApplications = [], isLoading: othersAppsLoading } = useOthersLeaveApplications(
    {
      q: othersSearch.trim() || undefined,
      status: othersStatusFilter || undefined,
      leave_type_id: othersTypeFilter || undefined,
    },
    canSeeOthers && activeTab === 'others_leaves' && othersSubTab === 'applications',
  );

  // Modal detail view for an employee
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const { data: userSummary, isLoading: summaryLoading } = useEmployeeLeaveSummary(
    selectedUserId,
    undefined,
    detailModalOpen,
  );

  const openUserDetail = (userId: string) => {
    setSelectedUserId(userId);
    setDetailModalOpen(true);
  };

  // Filtered My Applications
  const filteredMyApplications = useMemo(() => {
    return myApplications.filter((app) => {
      if (myTypeFilter && app.leave_type_id !== myTypeFilter) return false;
      return true;
    });
  }, [myApplications, myTypeFilter]);

  const othersBalancesList: LeaveBalanceRow[] = useMemo(() => {
    if (!othersBalancesResult) return [];
    if (Array.isArray(othersBalancesResult)) return othersBalancesResult;
    return (othersBalancesResult as any).items ?? [];
  }, [othersBalancesResult]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            <CalendarDays size={14} />
            Leave Management
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {activeTab === 'my_leaves' ? 'My Leave' : "Others' Leaves"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {activeTab === 'my_leaves'
              ? 'Your leave balances, applications and personal leave history.'
              : user?.role === 'HOD'
              ? "Departmental employees' leave balances and applications."
              : "Organization-wide employees' leave balances and applications."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canActOnLeave(user?.role) && (
            <Link href="/leave/approvals">
              <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs">
                <Users size={16} />
                Pending Approvals
              </Button>
            </Link>
          )}

          {canManageLeaveTypes(user?.role) && (
            <Link href="/leave/admin/types">
              <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs">
                <Settings2 size={16} />
                Leave Types
              </Button>
            </Link>
          )}

          {canManageLeaveBalances(user?.role) && (
            <Link href="/leave/admin/balances">
              <Button type="button" variant="outline" className="rounded-xl text-xs">
                Balances
              </Button>
            </Link>
          )}

          {canReadLeaveReports(user?.role) && (
            <Link href="/leave/admin/reports">
              <Button type="button" variant="outline" className="rounded-xl text-xs">
                Report
              </Button>
            </Link>
          )}

          <Link href="/leave/apply">
            <Button type="button" className="gap-2 rounded-xl bg-green-700 text-xs text-white shadow-sm hover:bg-green-800">
              <Plus size={16} />
              Apply for Leave
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary Navigation Tabs (My Leaves vs Others' Leaves) */}
      {canSeeOthers && (
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('my_leaves')}
            className={`border-b-2 px-6 py-3 text-sm font-semibold transition ${
              activeTab === 'my_leaves'
                ? 'border-green-700 text-green-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            My Leaves
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('others_leaves')}
            className={`border-b-2 px-6 py-3 text-sm font-semibold transition ${
              activeTab === 'others_leaves'
                ? 'border-green-700 text-green-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Others&apos; Leaves
          </button>
        </div>
      )}

      {/* ======================= TAB 1: MY LEAVES ======================= */}
      {activeTab === 'my_leaves' && (
        <div className="space-y-6">
          {/* Leave Balances Cards */}
          <div>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-green-800">
              Leave Balance Overview
            </h2>
            <LeaveBalanceCards balances={balances} types={types} isLoading={balancesLoading} />
          </div>

          {/* Leave Applications History */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">My Leave Applications & History</h3>
                <p className="text-xs text-slate-500">Track approved, pending, rejected and cancelled applications.</p>
              </div>

              {/* Status and Type Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={myStatusFilter}
                  onChange={(e) => setMyStatusFilter(e.target.value as LeaveStatus | '')}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 transition hover:border-slate-300 focus:bg-white focus:border-green-600 focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                <select
                  value={myTypeFilter}
                  onChange={(e) => setMyTypeFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 transition hover:border-slate-300 focus:bg-white focus:border-green-600 focus:outline-none"
                >
                  <option value="">All Leave Types</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {myAppsLoading ? (
              <div className="py-10 text-center text-sm text-slate-500">Loading your applications...</div>
            ) : !filteredMyApplications.length ? (
              <div className="py-10 text-center text-sm text-slate-500">
                {myApplications.length
                  ? 'No applications match the selected filters.'
                  : 'You have not submitted any leave applications yet.'}
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Dates</th>
                      <th className="px-4 py-3">Days</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Applied On</th>
                      <th className="px-4 py-3">Approver Info</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredMyApplications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          <Link href={`/leave/${app.id}`} className="hover:text-green-700">
                            {leaveTypeName(types, app.leave_type_id)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {formatLeaveDate(app.start_date)} - {formatLeaveDate(app.end_date)}
                        </td>
                        <td className="px-4 py-3 font-mono font-medium">{toDays(app.days_count)}</td>
                        <td className="max-w-[260px] px-4 py-3">
                          <p className="line-clamp-2">{app.reason}</p>
                        </td>
                        <td className="px-4 py-3">
                          <LeaveStatusChip status={app.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                          {formatLeaveDate(app.created_at)}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {app.approved_by_id_user?.full_name ? (
                            <span>
                              {app.approved_by_id_user.full_name}{' '}
                              <span className="text-[10px] text-slate-400">({app.approved_by_role || 'Manager'})</span>
                            </span>
                          ) : app.status === 'PENDING' ? (
                            <span className="italic text-amber-600">Awaiting review</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================= TAB 2: OTHERS' LEAVES ======================= */}
      {activeTab === 'others_leaves' && canSeeOthers && (
        <div className="space-y-6">
          {/* Sub-tabs: Balances vs Applications */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 rounded-xl bg-slate-100 p-1 w-fit">
              <button
                type="button"
                onClick={() => setOthersSubTab('balances')}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
                  othersSubTab === 'balances'
                    ? 'bg-white text-green-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Employee Balances Overview
              </button>
              <button
                type="button"
                onClick={() => setOthersSubTab('applications')}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
                  othersSubTab === 'applications'
                    ? 'bg-white text-green-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Employee Applications History
              </button>
            </div>

            {/* Global Search and Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <Input
                  value={othersSearch}
                  onChange={(e) => setOthersSearch(e.target.value)}
                  placeholder="Search name, ID, or email"
                  className="h-8 w-48 rounded-xl pl-8 text-xs"
                />
              </div>

              <select
                value={othersTypeFilter}
                onChange={(e) => setOthersTypeFilter(e.target.value)}
                className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"
              >
                <option value="">All Leave Types</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              {othersSubTab === 'applications' && (
                <select
                  value={othersStatusFilter}
                  onChange={(e) => setOthersStatusFilter(e.target.value as LeaveStatus | '')}
                  className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              )}
            </div>
          </div>

          {/* Sub-view A: Employee Balances */}
          {othersSubTab === 'balances' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Employee Leave Balances</h3>
                <p className="text-xs text-slate-500">
                  {user?.role === 'HOD'
                    ? "Balances for employees in your assigned department."
                    : "Organization-wide employee balances."}
                </p>
              </div>

              {othersBalancesLoading ? (
                <div className="py-10 text-center text-sm text-slate-500">Loading employee balances...</div>
              ) : !othersBalancesList.length ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  No employee balances found matching the filter criteria.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3">Personnel No.</th>
                        <th className="px-4 py-3">Leave Type</th>
                        <th className="px-4 py-3 tabular-nums">Entitled</th>
                        <th className="px-4 py-3 tabular-nums">Used</th>
                        <th className="px-4 py-3 tabular-nums">Carried</th>
                        <th className="px-4 py-3 tabular-nums font-bold">Remaining</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {othersBalancesList.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            <button
                              type="button"
                              onClick={() => openUserDetail(row.user_id)}
                              className="text-left font-semibold text-green-700 hover:underline"
                            >
                              {row.user_id_user?.full_name ?? 'Unknown'}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">
                            {row.user_id_user?.personnel_number ?? '—'}
                          </td>
                          <td className="px-4 py-3">{row.leave_type?.name ?? '—'}</td>
                          <td className="px-4 py-3 font-mono tabular-nums">{toDays(row.entitled)}</td>
                          <td className="px-4 py-3 font-mono tabular-nums">{toDays(row.used)}</td>
                          <td className="px-4 py-3 font-mono tabular-nums">{toDays(row.carried_over)}</td>
                          <td className="px-4 py-3 font-mono font-bold text-green-700 tabular-nums">
                            {toDays(row.remaining)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-lg text-xs text-green-700 hover:bg-green-50"
                              onClick={() => openUserDetail(row.user_id)}
                            >
                              View History
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Sub-view B: Employee Applications History */}
          {othersSubTab === 'applications' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Employee Applications</h3>
                <p className="text-xs text-slate-500">
                  {user?.role === 'HOD'
                    ? "Leave applications from your department's employees."
                    : "Organization-wide employee leave applications."}
                </p>
              </div>

              {othersAppsLoading ? (
                <div className="py-10 text-center text-sm text-slate-500">Loading applications...</div>
              ) : !othersApplications.length ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  No applications found matching the filter criteria.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Dates</th>
                        <th className="px-4 py-3 font-mono">Days</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Applied On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {othersApplications.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            <button
                              type="button"
                              onClick={() => openUserDetail(app.user_id)}
                              className="text-left hover:text-green-700 hover:underline"
                            >
                              {app.user_id_user?.full_name ?? 'Unknown'}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-medium">{leaveTypeName(types, app.leave_type_id)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {formatLeaveDate(app.start_date)} - {formatLeaveDate(app.end_date)}
                          </td>
                          <td className="px-4 py-3 font-mono font-medium">{toDays(app.days_count)}</td>
                          <td className="max-w-[240px] px-4 py-3">
                            <p className="line-clamp-2">{app.reason}</p>
                          </td>
                          <td className="px-4 py-3">
                            <LeaveStatusChip status={app.status} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                            {formatLeaveDate(app.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
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

              {/* Applications History */}
              <div>
                <h4 className="font-semibold text-slate-900">
                  Applications History ({userSummary.applications.length})
                </h4>
                {userSummary.applications.length === 0 ? (
                  <p className="mt-1 text-slate-400">No applications recorded for this financial year.</p>
                ) : (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-100">
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
                            <td className="px-3 py-2 font-mono font-medium">{toDays(app.days_count)}</td>
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
