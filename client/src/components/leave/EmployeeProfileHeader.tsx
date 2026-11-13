'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LeaveSearchEmployee, EmployeeLeaveSummary } from '@/api/leave';

interface Props {
  user: EmployeeLeaveSummary['user'] | LeaveSearchEmployee;
  selectedYear?: number;
  onYearChange?: (year: number) => void;
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

  return (
    <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Avatar & Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
          {/* Avatar */}
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-600 to-green-700 text-lg sm:text-xl font-bold text-white">
            {getInitials(user.full_name)}
          </div>

          {/* Core Info */}
          <div className="space-y-1.5 sm:space-y-2 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                {user.full_name}
              </h2>
              <span className="rounded-lg bg-slate-100 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium text-slate-700">
                {user.role}
              </span>
            </div>

            {/* Details */}
            <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-600">
              {/* Personnel Number */}
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="text-slate-500">Personnel No:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {user.personnel_number ?? 'Not Assigned'}
                </span>
              </div>

              {/* Department */}
              <div className="text-slate-600 truncate">
                {departmentName}
              </div>

              {/* Email - Hidden on mobile */}
              {user.email && (
                <div className="text-slate-600 truncate hidden sm:block">
                  {user.email}
                </div>
              )}
            </div>

            {/* UUID */}
            <div className="flex items-center gap-2 font-mono text-[10px] sm:text-xs text-slate-400">
              <span>ID: {user.id.slice(0, 8)}...</span>
              <button
                type="button"
                onClick={() => copyId(user.id)}
                title="Copy Full Employee UUID"
                className="rounded px-1 sm:px-1.5 py-0.5 hover:bg-slate-100 hover:text-slate-700 text-[10px] sm:text-xs"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Period & Switch Employee */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 border-t border-slate-100 pt-3 sm:pt-4 lg:border-t-0 lg:pt-0">
          {/* Period Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-medium text-slate-600 whitespace-nowrap">Period:</span>
            <span className="inline-flex items-center rounded-xl border border-green-200 bg-green-50 px-3 py-1 text-xs sm:text-sm font-semibold text-green-800">
              FY 2026–27
            </span>
          </div>

          {/* Change Employee button */}
          {canChangeEmployee && onChangeEmployee && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onChangeEmployee}
              className="rounded-xl text-xs font-medium h-8 sm:h-9"
            >
              Switch Employee
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
