'use client';

import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Coins,
  LayoutDashboard,
  ArrowRightLeft,
} from 'lucide-react';

import { useDashboard } from '@/hooks/useQueries';

const statusStyles: Record<string, string> = {
  'On Track': 'bg-green-50 text-green-700 ring-1 ring-green-200',
  Stable: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  Review: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
};

const actionToneStyles: Record<string, string> = {
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  red: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  rose: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
};

const kpiConfig = [
  { key: 'activeTasks' as const, title: 'Active Tasks', subtitle: 'Across all departments', icon: ClipboardList, suffix: '' },
  { key: 'pendingRequests' as const, title: 'Pending Requests', subtitle: 'Awaiting review', icon: Bell, suffix: '' },
  { key: 'completionRate' as const, title: 'Completion Rate', subtitle: 'Current month', icon: CheckCircle2, suffix: '%' },
  { key: 'incentives' as const, title: 'Incentives', subtitle: 'Approved this cycle', icon: Coins, prefix: '$' },
];

const criticalActionConfig = [
  { label: 'Pending Approvals', key: 'pendingApprovals' as const, tone: 'amber' },
  { label: 'Transfer Requests', key: 'transferRequests' as const, tone: 'blue' },
  { label: 'Escalated Tasks', key: 'escalatedTasks' as const, tone: 'red' },
  { label: 'Overdue Tasks', key: 'overdueTasks' as const, tone: 'rose' },
];

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();
  const currentDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date());
  const chartData = data?.chartData ?? [];
  const departmentSummary = data?.departmentSummary ?? [];
  const kpis = data
    ? kpiConfig.map(({ key, title, subtitle, icon, prefix = '', suffix = '' }) => ({
        title,
        subtitle,
        icon,
        value: `${prefix}${Number(data[key]).toLocaleString()}${suffix}`,
      }))
    : [];
  const criticalActions = data
    ? criticalActionConfig.map(({ label, key, tone }) => ({
        label,
        value: String(data[key]),
        tone,
      }))
    : [];

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <p className="text-sm font-medium text-slate-500">Loading dashboard...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-red-200 bg-red-50">
        <p className="text-sm font-medium text-red-700">Failed to load dashboard data.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            <LayoutDashboard size={14} />
            Enterprise Dashboard
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back, Buddy. Your workflow overview is ready.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Clock3 size={16} className="text-green-600" />
          <span>{currentDate}</span>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ title, value, subtitle, icon: Icon }) => (
          <div
            key={title}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-green-200 hover:shadow-md"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-700 transition-colors group-hover:bg-green-100">
                <Icon size={24} />
              </div>
            </div>
            <div className="mt-auto">
              <p className="text-sm font-medium text-slate-500">{title}</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
              <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ── Charts Row ── */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Performance Chart */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Performance Overview</h2>
              <p className="text-sm text-slate-500">Weekly completion trend</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              <BarChart3 size={14} />
              Weekly
            </div>
          </div>

          <div className="flex h-[300px] items-end gap-3 rounded-xl bg-slate-50 p-4">
            {chartData.map((entry) => {
              const maxVal = Math.max(...chartData.map(d => d.value), 1);
              const heightPct = Math.max(Math.round((entry.value / maxVal) * 100), 5);
              return (
                <div key={entry.label} className="flex h-full flex-1 flex-col justify-end gap-3">
                  <div className="flex flex-1 items-end justify-center">
                    <div
                      className="w-full max-w-[48px] rounded-t-lg bg-green-600 transition-all hover:bg-green-500"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-center text-xs font-medium text-slate-500">{entry.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Critical Actions */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Critical Actions</h2>
              <p className="text-sm text-slate-500">Items requiring attention</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangle size={20} />
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-between gap-3">
            {criticalActions.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5 transition-colors hover:border-slate-200"
              >
                <p className="text-sm font-medium text-slate-700">{item.label}</p>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${actionToneStyles[item.tone]}`}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Department Summary ── */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Department Summary</h2>
              <p className="text-sm text-slate-500">Operational snapshot</p>
            </div>
            <ArrowRightLeft size={20} className="text-green-600" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-600">Department</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Tasks</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Completion</th>
                <th className="px-6 py-4 font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departmentSummary.map((row) => (
                <tr key={row.department} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{row.department}</td>
                  <td className="px-6 py-4 text-slate-600">{row.tasks}</td>
                  <td className="px-6 py-4 text-slate-600">{row.completion}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[row.status]}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
