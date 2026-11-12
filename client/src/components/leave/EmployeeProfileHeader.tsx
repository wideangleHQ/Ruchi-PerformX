'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LeaveSearchEmployee, EmployeeLeaveSummary } from '@/api/leave';

interface Props {
  user: EmployeeLeaveSummary['user'] | LeaveSearchEmployee;
  selectedYear: number;
  onYearChange: (year: number) => void;
  canChangeEmployee?: boolean;
  onChangeEmployee?: () => void;
  isSelf?: boolean;
}

export function EmployeeProfileHeader({
  user,
  selectedYear,
  onYearChange,
  canChangeEmployee = false,
  onChangeEmployee,
  isSelf = false,
}: Props) {
  const [copied, setCopied] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const copyId = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const departmentName =
    'department_name' in user && user.department_name
      ? user.department_name
      : 'departments' in user && user.departments?.name
      ? user.departments.name
      : 'General Department';

  // Available Financial Years
  const availableYears = [
    { value: 2026, label: 'FY 2026–27' },
    { value: 2025, label: 'FY 2025–26' },
    { value: 2024, label: 'FY 2024–25' },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Avatar & Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-green-600 to-green-700 text-xl font-bold text-white">
            {getInitials(user.full_name)}
          </div>

          {/* Core Info */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                {user.full_name}
              </h2>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                {user.role}
              </span>
            </div>

            {/* Details */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
              {/* Personnel Number */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Personnel No:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {user.personnel_number ?? 'Not Assigned'}
                </span>
              </div>

              {/* Department */}
              <div className="text-slate-600">
                {departmentName}
              </div>

              {/* Email */}
              {user.email && (
                <div className="text-slate-600">
                  {user.email}
                </div>
              )}
            </div>

            {/* UUID */}
            <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
              <span>ID: {user.id.slice(0, 8)}...</span>
              <button
                type="button"
                onClick={() => copyId(user.id)}
                title="Copy Full Employee UUID"
                className="rounded px-1.5 py-0.5 hover:bg-slate-100 hover:text-slate-700 text-xs"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Financial Year Selector & Switch Employee */}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 lg:border-t-0 lg:pt-0">
          {/* Financial Year Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Period:</span>
            <select
              value={selectedYear}
              onChange={(e) => onYearChange(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-300 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100"
            >
              {availableYears.map((yr) => (
                <option key={yr.value} value={yr.value}>
                  {yr.label}
                </option>
              ))}
            </select>
          </div>

          {/* Change Employee button */}
          {canChangeEmployee && onChangeEmployee && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onChangeEmployee}
              className="rounded-xl text-xs font-medium h-9"
            >
              Switch Employee
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
