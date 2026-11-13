'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  EmployeeLeaveSummary,
  LeaveApplication,
  LeaveBalance,
  LeaveStatus,
  LeaveType,
  leaveTypeName,
  remainingDays,
  toDays,
} from '@/api/leave';
import { LeaveStatusChip } from './LeaveStatusChip';
import { formatLeaveDate } from '@/lib/leaveValidation';

interface Props {
  summary: EmployeeLeaveSummary;
  types: LeaveType[];
  isLoading?: boolean;
  isSelf?: boolean;
}

type TabType = 'overview' | 'applications' | 'balances' | 'history';

export function EmployeeLeaveProfile({
  summary,
  types,
  isLoading = false,
  isSelf = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Applications tab filters
  const [appSearch, setAppSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');
  const [sortField, setSortField] = useState<'created_at' | 'start_date' | 'days_count'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { balances = [], adjustments = [], applications = [] } = summary;

  // Total leave calculations
  const totalEntitled = useMemo(() => {
    return balances.reduce((acc, b) => acc + toDays(b.entitled) + toDays(b.carried_over), 0);
  }, [balances]);

  const totalUsed = useMemo(() => {
    return balances.reduce((acc, b) => acc + toDays(b.used), 0);
  }, [balances]);

  const totalRemaining = useMemo(() => {
    return balances.reduce((acc, b) => acc + remainingDays(b), 0);
  }, [balances]);

  // Filtered & Sorted applications for the Applications tab
  const filteredApplications = useMemo(() => {
    return applications
      .filter((app) => {
        if (statusFilter && app.status !== statusFilter) return false;
        if (typeFilter && app.leave_type_id !== typeFilter) return false;
        if (fromDateFilter && app.start_date.slice(0, 10) < fromDateFilter) return false;
        if (toDateFilter && app.end_date.slice(0, 10) > toDateFilter) return false;
        if (appSearch.trim()) {
          const q = appSearch.toLowerCase();
          const reasonMatch = app.reason?.toLowerCase().includes(q);
          const typeName = leaveTypeName(types, app.leave_type_id).toLowerCase();
          const typeMatch = typeName.includes(q);
          const approverMatch = app.approved_by_id_user?.full_name?.toLowerCase().includes(q);
          if (!reasonMatch && !typeMatch && !approverMatch) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];
        if (sortField === 'days_count') {
          valA = toDays(valA);
          valB = toDays(valB);
        }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [
    applications,
    statusFilter,
    typeFilter,
    fromDateFilter,
    toDateFilter,
    appSearch,
    types,
    sortField,
    sortOrder,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize));
  const pagedApplications = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredApplications.slice(start, start + pageSize);
  }, [filteredApplications, page, pageSize]);

  // Combined Chronological History Timeline
  const chronologicalHistory = useMemo(() => {
    type TimelineItem = {
      id: string;
      date: string;
      title: string;
      category: 'ADJUSTMENT' | 'APPLICATION';
      status?: LeaveStatus;
      description: string;
      meta?: string;
      actor?: string;
      amount?: string;
    };

    const items: TimelineItem[] = [];

    adjustments.forEach((adj) => {
      const typeName = adj.leave_type?.name ?? leaveTypeName(types, adj.leave_type_id);
      items.push({
        id: `adj-${adj.id}`,
        date: adj.created_at || adj.effective_date,
        title: `Balance Adjustment: ${adj.adjustment_type.replace(/_/g, ' ')}`,
        category: 'ADJUSTMENT',
        description: adj.remarks || `Adjustment of ${adj.amount} day(s) for ${typeName}`,
        meta: `Effective: ${adj.effective_date?.slice(0, 10) || 'N/A'}${
          adj.reference ? ` | Ref: ${adj.reference}` : ''
        }`,
        actor: adj.created_by_id_user?.full_name,
        amount: `${adj.amount > 0 ? '+' : ''}${adj.amount} days`,
      });
    });

    applications.forEach((app) => {
      const typeName = leaveTypeName(types, app.leave_type_id);
      items.push({
        id: `app-${app.id}`,
        date: app.created_at,
        title: `Leave Application: ${typeName}`,
        category: 'APPLICATION',
        status: app.status,
        description: app.reason || 'No reason provided',
        meta: `${formatLeaveDate(app.start_date)} to ${formatLeaveDate(app.end_date)} (${toDays(
          app.days_count,
        )} days)`,
        actor: app.approved_by_id_user?.full_name
          ? `Actioned by ${app.approved_by_id_user.full_name} (${app.approved_by_role || 'Manager'})`
          : undefined,
      });
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [adjustments, applications, types]);

  const resetFilters = () => {
    setAppSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setFromDateFilter('');
    setToDateFilter('');
    setPage(1);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-green-700 text-green-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('applications')}
          className={`px-3 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === 'applications'
              ? 'border-green-700 text-green-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Leave Applications ({applications.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('balances')}
          className={`px-3 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === 'balances'
              ? 'border-green-700 text-green-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Leave Balances ({balances.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`px-3 sm:px-5 py-2 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === 'history'
              ? 'border-green-700 text-green-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Leave History
        </button>
      </div>

      {/* ============================== TAB 1: OVERVIEW ============================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {balances.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="font-semibold text-slate-700">No leave balance records found</p>
              <p className="mt-1 text-xs text-slate-500">
                No active leave allocations for FY {summary.year}–{String(summary.year + 1).slice(-2)}.
              </p>
            </div>
          ) : (
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {balances.map((b) => {
                const rem = remainingDays(b);
                const ent = toDays(b.entitled) + toDays(b.carried_over);
                const carried = toDays(b.carried_over);
                const compensated = toDays(b.compensated_to_key_date);
                const name = b.leave_type?.name ?? leaveTypeName(types, b.leave_type_id);

                return (
                  <div
                    key={b.id}
                    className="flex flex-col justify-between rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 transition hover:border-green-200"
                  >
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {name}
                      </span>

                      <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                          {rem}
                        </span>
                        <span className="text-xs font-medium text-slate-500">days remaining</span>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <div className="flex justify-between">
                        <span>Entitled:</span>
                        <span className="font-semibold text-slate-700">{ent}</span>
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span>Used:</span>
                        <span className="font-semibold text-slate-700">{toDays(b.used)}</span>
                      </div>
                      {carried > 0 && (
                        <div className="flex justify-between mt-0.5 text-emerald-600">
                          <span>Carried over:</span>
                          <span>+{carried}</span>
                        </div>
                      )}
                      {compensated > 0 && (
                        <div className="flex justify-between mt-0.5 text-blue-600">
                          <span>Compensated:</span>
                          <span>{compensated}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Total Balance Card */}
              <div className="flex flex-col justify-between rounded-xl sm:rounded-2xl border border-green-300 bg-gradient-to-br from-green-50 to-white p-4 sm:p-5">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-green-900">
                    Total Leave Summary
                  </span>

                  <div className="mt-2 sm:mt-3 flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-green-800">
                      {Math.round(totalRemaining * 100) / 100}
                    </span>
                    <span className="text-xs font-semibold text-green-700">total remaining</span>
                  </div>
                </div>

                <div className="mt-4 border-t border-green-200 pt-3 text-xs text-green-900">
                  <div className="flex justify-between">
                    <span>Total Entitled:</span>
                    <span className="font-bold">{Math.round(totalEntitled * 100) / 100} days</span>
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span>Total Used:</span>
                    <span className="font-bold">{Math.round(totalUsed * 100) / 100} days</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Recent Leave Activity */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Recent Leave Applications</h3>
                <p className="text-xs text-slate-500">
                  Latest submissions for FY {summary.year}–{String(summary.year + 1).slice(-2)}.
                </p>
              </div>

              {applications.length > 5 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('applications')}
                  className="text-xs font-semibold text-green-700 hover:text-green-800"
                >
                  View All ({applications.length})
                </button>
              )}
            </div>

            {applications.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                No leave applications recorded for this financial year.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Leave Type</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Dates</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Duration</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Reason</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Applied On</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {applications.slice(0, 5).map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {leaveTypeName(types, app.leave_type_id)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatLeaveDate(app.start_date)} - {formatLeaveDate(app.end_date)}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">
                          {toDays(app.days_count)} {toDays(app.days_count) === 1 ? 'day' : 'days'}
                        </td>
                        <td className="max-w-[280px] px-4 py-3">
                          <p className="line-clamp-1">{app.reason}</p>
                        </td>
                        <td className="px-4 py-3">
                          <LeaveStatusChip status={app.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                          {formatLeaveDate(app.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/leave/${app.id}`}
                            className="text-xs font-semibold text-green-700 hover:underline"
                          >
                            View Details
                          </Link>
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

      {/* ============================== TAB 2: LEAVE APPLICATIONS ============================== */}
      {activeTab === 'applications' && (
        <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Leave Applications Record</h3>
                <p className="text-xs text-slate-500">
                  History of applied, approved, rejected, and cancelled leaves.
                </p>
              </div>

              <div className="w-full sm:w-64">
                <Input
                  type="text"
                  placeholder="Search..."
                  value={appSearch}
                  onChange={(e) => {
                    setAppSearch(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 sm:h-9 rounded-xl text-xs border-slate-200"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as LeaveStatus | '');
                  setPage(1);
                }}
                className="h-8 sm:h-9 rounded-xl border border-slate-200 bg-white px-2 sm:px-3 text-xs text-slate-700"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 sm:h-9 rounded-xl border border-slate-200 bg-white px-2 sm:px-3 text-xs text-slate-700"
              >
                <option value="">All Types</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span className="hidden sm:inline">From:</span>
                <input
                  type="date"
                  value={fromDateFilter}
                  onChange={(e) => {
                    setFromDateFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 sm:h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-700"
                />
              </div>

              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span className="hidden sm:inline">To:</span>
                <input
                  type="date"
                  value={toDateFilter}
                  onChange={(e) => {
                    setToDateFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 sm:h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs text-slate-700"
                />
              </div>

              {(appSearch || statusFilter || typeFilter || fromDateFilter || toDateFilter) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-8 sm:h-9 rounded-xl text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {filteredApplications.length === 0 ? (
            <div className="py-10 sm:py-12 text-center">
              <p className="text-sm font-semibold text-slate-700">No applications match your filters.</p>
              <p className="mt-1 text-xs text-slate-500">Try adjusting your filters.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-100 -mx-4 sm:mx-0">
                <table className="min-w-full text-left text-xs min-w-[800px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Leave Type</th>
                      <th 
                        className="px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900"
                        onClick={() => {
                          if (sortField === 'start_date') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('start_date');
                            setSortOrder('desc');
                          }
                        }}
                      >
                        Dates ↕
                      </th>
                      <th 
                        className="px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900"
                        onClick={() => {
                          if (sortField === 'days_count') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('days_count');
                            setSortOrder('desc');
                          }
                        }}
                      >
                        Days ↕
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Reason</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Status</th>
                      <th 
                        className="px-4 py-3 text-xs font-semibold text-slate-600 cursor-pointer hover:text-slate-900"
                        onClick={() => {
                          if (sortField === 'created_at') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('created_at');
                            setSortOrder('desc');
                          }
                        }}
                      >
                        Applied On ↕
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600">Approver</th>
                      <th className="px-4 py-3 text-xs font-semibold text-slate-600 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedApplications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          <Link href={`/leave/${app.id}`} className="hover:text-green-700">
                            {leaveTypeName(types, app.leave_type_id)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatLeaveDate(app.start_date)} – {formatLeaveDate(app.end_date)}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {toDays(app.days_count)}
                        </td>
                        <td className="max-w-[260px] px-4 py-3">
                          <p className="line-clamp-2">{app.reason}</p>
                        </td>
                        <td className="px-4 py-3">
                          <LeaveStatusChip status={app.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                          {formatLeaveDate(app.created_at)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {app.approved_by_id_user?.full_name ? (
                            <div>
                              <p className="font-medium text-slate-800">
                                {app.approved_by_id_user.full_name}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                {app.approved_by_role || 'Manager'}
                              </span>
                            </div>
                          ) : app.status === 'PENDING' ? (
                            <span className="italic text-amber-600">Awaiting</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/leave/${app.id}`}
                            className="text-xs font-semibold text-green-700 hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>
                    Showing {(page - 1) * pageSize + 1} to{' '}
                    {Math.min(page * pageSize, filteredApplications.length)} of{' '}
                    {filteredApplications.length}
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                      className="h-8 px-3 rounded-lg text-xs"
                    >
                      Previous
                    </Button>
                    <span className="font-semibold text-slate-700">
                      {page} of {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                      className="h-8 px-3 rounded-lg text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================== TAB 3: LEAVE BALANCES ============================== */}
      {activeTab === 'balances' && (
        <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              Leave Balances & Quota Breakdown (FY {summary.year}–{String(summary.year + 1).slice(-2)})
            </h3>
            <p className="text-xs text-slate-500">
              Detailed leave entitlements, usage, and remaining balance.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600">Category</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600">Paid/Unpaid</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600">Entitled</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600">Carried Over</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600">Used</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600">Compensated</th>
                  <th className="px-4 py-3 text-xs font-semibold text-green-700">Remaining</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-600">Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {balances.map((b) => {
                  const rem = remainingDays(b);
                  const typeObj = types.find((t) => t.id === b.leave_type_id);
                  const isPaid = typeObj?.is_paid ?? b.leave_type?.is_paid ?? true;
                  const canCarry = typeObj?.carry_forward ?? false;
                  const reqProof = typeObj?.requires_proof ?? false;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {b.leave_type?.name ?? leaveTypeName(types, b.leave_type_id)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isPaid ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{toDays(b.entitled)}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{toDays(b.carried_over)}</td>
                      <td className="px-4 py-3 font-mono text-rose-700">{toDays(b.used)}</td>
                      <td className="px-4 py-3 font-mono text-blue-700">{toDays(b.compensated_to_key_date)}</td>
                      <td className="px-4 py-3 font-mono font-bold text-green-700">{rem}</td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        <div className="flex flex-wrap gap-1">
                          {canCarry && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5">Carry-forward</span>
                          )}
                          {reqProof && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">Proof required</span>
                          )}
                          {!canCarry && !reqProof && <span>Standard</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================== TAB 4: LEAVE HISTORY ============================== */}
      {activeTab === 'history' && (
        <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Leave History</h3>
            <p className="text-xs text-slate-500">
              Chronological log of adjustments, applications, and approvals.
            </p>
          </div>

          {chronologicalHistory.length === 0 ? (
            <div className="py-10 sm:py-12 text-center text-xs sm:text-sm text-slate-500">
              No historical leave events found.
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {chronologicalHistory.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 transition hover:bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{item.title}</span>
                      {item.status && <LeaveStatusChip status={item.status} />}
                      {item.amount && (
                        <span className="font-mono text-xs font-bold text-blue-700">
                          {item.amount}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">
                      {formatLeaveDate(item.date)}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-slate-700">{item.description}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 text-xs text-slate-500">
                    {item.meta && <span>{item.meta}</span>}
                    {item.actor && (
                      <span className="font-medium text-slate-700">By: {item.actor}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
