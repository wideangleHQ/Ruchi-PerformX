'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { leaveApi } from '@/api/leave';
import { useMonthlyLeaveReport } from '@/hooks/useLeave';
import { canReadLeaveReports } from '@/components/leave/access';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Approved leave for one month, per person and type, with the xlsx export.
 *
 * The server attributes an application to the month it starts in, so leave that
 * spans a month boundary lands entirely in the earlier one. That is stated on
 * screen because the number is otherwise quietly wrong to anyone reconciling it
 * against a payroll cutoff.
 */
export default function LeaveReportsPage() {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [exporting, setExporting] = useState(false);

  const allowed = canReadLeaveReports(user?.role);
  const { data: report, isLoading } = useMonthlyLeaveReport({ month, year }, allowed);

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
        The leave report is HR and MD only.
      </div>
    );
  }

  const rows = report?.rows ?? [];
  const totalDays = rows.reduce((sum, row) => sum + row.days_taken, 0);
  const unpaidDays = rows.reduce((sum, row) => sum + row.unpaid_days, 0);

  const download = async () => {
    setExporting(true);
    try {
      await leaveApi.exportMonthly({ month, year });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/leave"
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={14} />
            Leave
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Monthly leave report
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Approved leave only. An application counts in the month it starts in, so leave
            spanning a month end lands entirely in the earlier month.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={exporting || !rows.length}
          onClick={download}
        >
          <Download size={16} />
          {exporting ? 'Preparing...' : 'Export xlsx'}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          {MONTHS.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        >
          {[year + 1, year, year - 1, year - 2].map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {report ? (
          <span className="text-xs text-slate-500">
            Financial year {report.financial_year}
          </span>
        ) : null}
      </div>

      {rows.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['People', new Set(rows.map((r) => r.user_id)).size],
            ['Days taken', totalDays],
            ['Unpaid days', unpaidDays],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading report...
        </div>
      ) : !rows.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          No approved leave in {MONTHS[month - 1]} {year}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium tabular-nums">Days taken</th>
                <th className="px-4 py-3 font-medium tabular-nums">Remaining</th>
                <th className="px-4 py-3 font-medium tabular-nums">Unpaid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={`${row.user_id}-${row.leave_type_id}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{row.employee_name}</span>
                    <span className="block text-xs text-slate-500">{row.employee_email}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.leave_type_name}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{row.days_taken}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">{row.days_remaining}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {row.unpaid_days || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
