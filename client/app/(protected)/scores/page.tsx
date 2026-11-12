'use client';

import { useState } from 'react';
import { redirect } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  useDepartmentExecution,
  useManagementScores,
  useUserProfile,
} from '@/hooks/useScoring';
import { scoringApi, ManagementScoresParams } from '@/api/scoring';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ROLES = [
  'EMPLOYEE', 'HOD', 'EA', 'PA', 'DEPARTMENT_CONTROLLER', 'PURCHASE_HEAD', 'HR',
];

const SHOW_SCORING = false;

export default function ScoresDashboardPage() {
  if (!SHOW_SCORING) {
    redirect('/dashboard');
  }

  const { user } = useAuth();
  const now = new Date();

  const [period, setPeriod] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });

  const [filters, setFilters] = useState<ManagementScoresParams>({
    month: period.month,
    year: period.year,
    page: 1,
    limit: 15,
  });

  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Active tab for HODs: 'department' or 'employees'
  const isHod = user?.role === 'HOD';
  const isUnrestricted = ['MD', 'EA', 'PA', 'ADMIN'].includes(user?.role || '');
  const [activeTab, setActiveTab] = useState<'employees' | 'department'>(
    isHod ? 'department' : 'employees',
  );

  // Fetch management scores
  const { data: scoresData, isLoading: scoresLoading } = useManagementScores({
    ...filters,
    month: period.month,
    year: period.year,
  });

  // Fetch department execution (for HOD or when a department is selected)
  const currentDeptId = isHod ? (user?.departmentId || null) : filters.department_id || null;
  const { data: deptData } = useDepartmentExecution(
    currentDeptId,
    period,
  );

  // Fetch individual score detail for selected user
  const { data: userProfile, isLoading: profileLoading } = useUserProfile(
    selectedUserId,
    period,
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, q: search.trim() || undefined, page: 1 }));
  };

  const handlePeriodChange = (newMonth: number, newYear: number) => {
    setPeriod({ month: newMonth, year: newYear });
    setFilters((prev) => ({ ...prev, month: newMonth, year: newYear, page: 1 }));
  };

  const openUserDetail = (userId: string) => {
    setSelectedUserId(userId);
    setDetailModalOpen(true);
  };

  const canExport = ['MD', 'EA', 'PA', 'HOD', 'ADMIN', 'DEPARTMENT_CONTROLLER'].includes(
    user?.role || '',
  );

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await scoringApi.exportScores({
        ...filters,
        month: period.month,
        year: period.year,
      });
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to export scores to Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  const summary = scoresData?.summary;
  const isEaPaMd = ['MD', 'EA', 'PA'].includes(user?.role || '');
  const rawItems = scoresData?.items ?? [];
  const items = isEaPaMd ? [...rawItems].sort((a, b) => b.atScore - a.atScore) : rawItems;
  const pagination = scoresData?.pagination;
  const departments = scoresData?.departments ?? [];

  return (
    <div className="space-y-6">
      {/* Header and Period Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Scores Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Action Tracker (AT) execution and Performance (PS) KPI outcome evaluations
          </p>
        </div>

        {/* Period Selector (rounded-lg matching app selects) */}
        <div className="flex items-center gap-2">
          <select
            value={period.month}
            onChange={(e) => handlePeriodChange(Number(e.target.value), period.year)}
            aria-label="Filter by month"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-500/20"
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={period.year}
            onChange={(e) => handlePeriodChange(period.month, Number(e.target.value))}
            aria-label="Filter by year"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-500/20"
          >
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Metrics (rounded-2xl matching other dashboard metric cards) */}
      {summary && (
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Employees in Scope</p>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900">
              {summary.totalEmployees}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Active personnel</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Average AT Score</p>
            <div className="mt-2 flex items-baseline gap-1 font-mono">
              <span className="text-2xl font-bold text-green-700">
                {summary.avgAtScore.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Execution Tracker</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Average PS Score</p>
            <div className="mt-2 flex items-baseline gap-1 font-mono">
              <span className="text-2xl font-bold text-green-700">
                {summary.avgPsScore.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">KPI Outcomes</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Calculated Scores</p>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900">
              {summary.completedCalculations}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Complete records</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">Pending Review</p>
            <p className="mt-2 font-mono text-2xl font-bold text-slate-900">
              {summary.pendingCalculations}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">Awaiting evaluations</p>
          </div>
        </section>
      )}

      {/* HOD View Selector (Section A & B) */}
      {isHod && (
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('department')}
            className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === 'department'
                ? 'border-green-700 text-green-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Section A: Department Operational Health
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={`border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === 'employees'
                ? 'border-green-700 text-green-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Section B: Department Employees List
          </button>
        </div>
      )}

      {/* Section A: Department Performance Overview (rounded-2xl) */}
      {((isHod && activeTab === 'department') || (!isHod && deptData)) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-green-700">
                Department Execution Overview
              </span>
              <h2 className="mt-0.5 text-xl font-bold text-slate-900">
                {deptData?.department?.name ?? 'Department Overview'}
              </h2>
              <p className="text-xs text-slate-500">
                Operational metrics for {MONTH_NAMES[period.month - 1]} {period.year}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500">Department AT Execution Score</span>
              <p className="font-mono text-3xl font-bold text-green-700">
                {deptData?.department?.departmentAtExecutionScore ?? 0}
                <span className="font-sans text-sm font-semibold text-slate-400"> / 100</span>
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Active Staff</p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-900">
                {deptData?.department?.totalActiveEmployees ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Completed Tasks</p>
              <p className="mt-1 font-mono text-xl font-bold text-green-700">
                {deptData?.department?.completedTasks ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Pending Tasks</p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-900">
                {deptData?.department?.pendingTasks ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Overdue Tasks</p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-900">
                {deptData?.department?.overdueTasks ?? 0}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Section B: Employee Score Table & Multi-Filters (rounded-2xl) */}
      {(!isHod || activeTab === 'employees') && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {/* Filters Bar */}
          <form onSubmit={handleSearchSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by employee name or email..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 transition hover:border-slate-300 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-500/20"
              />
            </div>

            {isUnrestricted && (
              <select
                value={filters.department_id ?? ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    department_id: e.target.value || undefined,
                    page: 1,
                  }))
                }
                aria-label="Filter by department"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition hover:border-slate-300 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-500/20"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={filters.role ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  role: e.target.value || undefined,
                  page: 1,
                }))
              }
              aria-label="Filter by role"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition hover:border-slate-300 focus:bg-white focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-500/20"
            >
              <option value="">All Roles</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="rounded-xl bg-green-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-green-800"
            >
              Filter Scores
            </button>

            {canExport && (
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="rounded-xl border border-green-700 bg-white px-4 py-2 text-xs font-semibold text-green-700 shadow-sm transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExporting ? 'Exporting...' : 'Export to Excel'}
              </button>
            )}
          </form>

          {/* Table (rounded-xl) */}
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Designation</th>
                  <th className="px-4 py-3 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span>AT Score (Execution)</span>
                      {isEaPaMd && (
                        <span className="text-[11px] font-semibold text-green-700">
                          ↓ Highest First
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 font-semibold">PS Score (Outcome)</th>
                  <th className="px-4 py-3 font-semibold">Period</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scoresLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Loading scores...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No employees match the specified filters.
                    </td>
                  </tr>
                ) : (
                  items.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {emp.fullName}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{emp.department}</td>
                      <td className="px-4 py-3 text-slate-600">{emp.role}</td>
                      <td className="px-4 py-3 font-mono font-bold text-green-700">
                        {emp.atScore.toFixed(1)}{' '}
                        <span className="font-sans text-[11px] font-normal text-slate-400">/ 100</span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-green-700">
                        {emp.psScore.toFixed(1)}{' '}
                        <span className="font-sans text-[11px] font-normal text-slate-400">/ 100</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">{emp.period}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openUserDetail(emp.id)}
                          className="rounded-lg border border-slate-200 px-3 py-1 font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-green-700 hover:border-green-300"
                        >
                          View Breakdown
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page <= 1}
                  onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:text-green-700"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:text-green-700"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Employee Detail Breakdown Modal (rounded-2xl) */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-3xl bg-white p-6 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">
              {userProfile?.user.fullName} — Score Breakdown
            </DialogTitle>
            <p className="text-xs text-slate-500">
              {userProfile?.user.department} • {userProfile?.user.role} •{' '}
              {MONTH_NAMES[period.month - 1]} {period.year}
            </p>
          </DialogHeader>

          {profileLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading breakdown...</div>
          ) : userProfile ? (
            <div className="mt-4 space-y-5">
              {/* Dual Score Banner */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-green-800">
                    AT Score (Execution)
                  </p>
                  <p className="mt-1 font-mono text-3xl font-bold text-slate-900">
                    {userProfile.atScore.score.toFixed(1)}{' '}
                    <span className="font-sans text-sm font-semibold text-slate-400">/ 100</span>
                  </p>
                  {userProfile.atScore.isNormalized && (
                    <span className="mt-1 inline-block text-[11px] font-medium text-slate-600">
                      Project weight normalized
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-green-200 bg-green-50/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-green-800">
                    PS Score (Outcome)
                  </p>
                  <p className="mt-1 font-mono text-3xl font-bold text-slate-900">
                    {userProfile.psScore.ps_score.toFixed(1)}{' '}
                    <span className="font-sans text-sm font-semibold text-slate-400">/ 100</span>
                  </p>
                  <span className="mt-1 inline-block text-[11px] font-medium text-slate-600">
                    {userProfile.psScore.kpis.length} KPIs evaluated
                  </span>
                </div>
              </div>

              {/* AT Subcomponents */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Action Tracker Components
                </h4>

                {userProfile.atScore.components.selfAction && (
                  <div className="rounded-xl border border-slate-200 p-4 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-900">
                        Self Actions ({userProfile.atScore.components.selfAction.weight}% weight)
                      </span>
                      <span className="font-mono text-slate-900">
                        {userProfile.atScore.components.selfAction.score.toFixed(1)} / 100
                      </span>
                    </div>
                  </div>
                )}

                {userProfile.atScore.components.assignedTask && (
                  <div className="rounded-xl border border-slate-200 p-4 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-900">
                        Assigned Tasks ({userProfile.atScore.components.assignedTask.weight}% weight)
                      </span>
                      <span className="font-mono text-slate-900">
                        {userProfile.atScore.components.assignedTask.score.toFixed(1)} / 100
                      </span>
                    </div>
                  </div>
                )}

                {userProfile.atScore.components.project && (
                  <div className="rounded-xl border border-slate-200 p-4 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-900">
                        Projects ({userProfile.atScore.components.project.weight}% weight)
                      </span>
                      <span className="font-mono text-slate-900">
                        {userProfile.atScore.components.project.applicable
                          ? `${userProfile.atScore.components.project.score.toFixed(1)} / 100`
                          : 'Not Applicable'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* PS KPIs */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  KPI Outcome Contributions
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3.5 py-2.5 font-semibold">KPI</th>
                        <th className="px-3.5 py-2.5 font-semibold">Target</th>
                        <th className="px-3.5 py-2.5 font-semibold">Actual</th>
                        <th className="px-3.5 py-2.5 font-semibold">Achieved</th>
                        <th className="px-3.5 py-2.5 font-semibold">Weight</th>
                        <th className="px-3.5 py-2.5 font-semibold">Contribution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {userProfile.psScore.kpis.map((kpi) => (
                        <tr key={kpi.id}>
                          <td className="px-3.5 py-2.5 font-medium text-slate-900">{kpi.name}</td>
                          <td className="px-3.5 py-2.5 text-slate-600">{kpi.target_value ?? '—'}</td>
                          <td className="px-3.5 py-2.5 text-slate-600">{kpi.actual_value ?? '—'}</td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-600">
                            {kpi.achievement !== null ? `${kpi.achievement.toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-slate-600">{kpi.effective_weight}%</td>
                          <td className="px-3.5 py-2.5 font-mono font-bold text-green-700">
                            {kpi.contribution !== null ? kpi.contribution.toFixed(1) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
