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

const kpis = [
  {
    title: 'Active Tasks',
    value: '42',
    subtitle: 'Across all departments',
    icon: ClipboardList,
  },
  {
    title: 'Pending Requests',
    value: '18',
    subtitle: 'Awaiting review',
    icon: Bell,
  },
  {
    title: 'Completion Rate',
    value: '94.2%',
    subtitle: 'Current month',
    icon: CheckCircle2,
  },
  {
    title: 'Incentives',
    value: '$1,240',
    subtitle: 'Approved this cycle',
    icon: Coins,
  },
] as const;

const performanceData = [
  { label: 'Mon', value: 58 },
  { label: 'Tue', value: 66 },
  { label: 'Wed', value: 74 },
  { label: 'Thu', value: 69 },
  { label: 'Fri', value: 82 },
  { label: 'Sat', value: 77 },
  { label: 'Sun', value: 88 },
];

const criticalActions = [
  { label: 'Pending Approvals', value: '7', tone: 'amber' },
  { label: 'Transfer Requests', value: '4', tone: 'blue' },
  { label: 'Escalated Tasks', value: '3', tone: 'red' },
  { label: 'Overdue Tasks', value: '6', tone: 'rose' },
] as const;

const departmentSummary = [
  { department: 'Operations', tasks: 18, completion: '96%', status: 'On Track' },
  { department: 'Finance', tasks: 12, completion: '91%', status: 'Stable' },
  { department: 'HR', tasks: 9, completion: '88%', status: 'Review' },
  { department: 'Sales', tasks: 21, completion: '97%', status: 'On Track' },
];

const statusStyles: Record<string, string> = {
  'On Track': 'bg-green-50 text-green-700 ring-green-200',
  Stable: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Review: 'bg-amber-50 text-amber-700 ring-amber-200',
};

const actionToneStyles: Record<string, string> = {
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export default function DashboardPage() {
  const currentDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6 text-slate-900">
      <header className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 lg:flex-row lg:items-end">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-100">
            <LayoutDashboard size={14} />
            Enterprise Dashboard
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="text-sm text-slate-600">
            Welcome back, Michael. Your workflow overview is ready.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Clock3 size={16} className="text-green-700" />
          <span>{currentDate}</span>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="group flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-green-100"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700 ring-1 ring-green-100 transition-colors group-hover:bg-green-100">
                  <Icon size={20} />
                </div>
              </div>
              <div className="mt-auto space-y-1">
                <p className="text-sm font-medium text-slate-600">{item.title}</p>
                <p className="text-3xl font-semibold tracking-tight text-slate-900">{item.value}</p>
                <p className="text-xs text-slate-500">{item.subtitle}</p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Performance Overview</h2>
              <p className="mt-1 text-sm text-slate-600">Weekly completion trend</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-100">
              <BarChart3 size={14} />
              Recharts
            </div>
          </div>

          <div className="flex h-[320px] items-end gap-3 rounded-xl border border-slate-100 bg-slate-50 px-5 py-5 sm:gap-4 sm:px-6">
            {performanceData.map((entry) => (
              <div key={entry.label} className="flex h-full flex-1 flex-col justify-end gap-3">
                <div className="flex flex-1 items-end justify-center">
                  <div
                    className="w-full max-w-[44px] rounded-t-xl bg-gradient-to-t from-green-700 to-green-500 shadow-sm transition-transform hover:-translate-y-1"
                    style={{ height: `${entry.value}%` }}
                  />
                </div>
                <span className="text-center text-xs font-medium text-slate-500">
                  {entry.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Critical Actions</h2>
              <p className="mt-1 text-sm text-slate-600">Items requiring attention</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700 ring-1 ring-green-100">
              <AlertTriangle size={18} />
            </div>
          </div>

          <div className="space-y-3">
            {criticalActions.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 transition-colors hover:border-green-100 hover:bg-green-50/40"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.label}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${actionToneStyles[item.tone]}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Department Summary</h2>
            <p className="mt-1 text-sm text-slate-600">Static operational snapshot</p>
          </div>
          <ArrowRightLeft size={18} className="text-green-700" />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Department</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Tasks</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Completion</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {departmentSummary.map((row) => (
                <tr key={row.department} className="transition-colors hover:bg-green-50/30">
                  <td className="px-4 py-4 font-medium text-slate-900">{row.department}</td>
                  <td className="px-4 py-4 text-slate-700">{row.tasks}</td>
                  <td className="px-4 py-4 text-slate-700">{row.completion}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[row.status]}`}>
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
