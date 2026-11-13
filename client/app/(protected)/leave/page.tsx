'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import {
  LEAVE_FINANCIAL_YEAR,
  LeaveSearchEmployee,
  LeaveType,
} from '@/api/leave';
import {
  useEmployeeLeaveSummary,
  useLeaveTypes,
} from '@/hooks/useLeave';
import {
  canActOnLeave,
  canManageLeaveBalances,
  canManageLeaveTypes,
  canReadLeaveReports,
  canViewOthersLeaves,
} from '@/components/leave/access';
import { EmployeeLeaveSearch } from '@/components/leave/EmployeeLeaveSearch';
import { EmployeeProfileHeader } from '@/components/leave/EmployeeProfileHeader';
import { EmployeeLeaveProfile } from '@/components/leave/EmployeeLeaveProfile';

const RECENT_EMPLOYEES_KEY = 'rpx_recent_leave_employees';

export default function LeaveManagementPage() {
  const { user } = useAuth();
  const canSeeOthers = canViewOthersLeaves(user?.role);
  const isEmployee = user?.role === 'EMPLOYEE';

  // Financial year pinned strictly to FY 2026-27 (year = 2026)
  const selectedYear = LEAVE_FINANCIAL_YEAR;

  // Selected employee ID: for employees, strictly their own id
  const [selectedUserId, setSelectedUserId] = useState<string | null>(user?.id ?? null);
  const [recentEmployees, setRecentEmployees] = useState<LeaveSearchEmployee[]>([]);

  // Load recent employees from session storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && canSeeOthers) {
      try {
        const stored = sessionStorage.getItem(RECENT_EMPLOYEES_KEY);
        if (stored) {
          setRecentEmployees(JSON.parse(stored));
        }
      } catch (err) {
        console.error('Failed to parse recent employees', err);
      }
    }
  }, [canSeeOthers]);

  // Keep employee role pinned to their own ID
  useEffect(() => {
    if (isEmployee && user?.id) {
      setSelectedUserId(user.id);
    }
  }, [isEmployee, user?.id]);

  // If user is loaded and no selectedUserId, default to own ID
  useEffect(() => {
    if (user?.id && !selectedUserId && isEmployee) {
      setSelectedUserId(user.id);
    }
  }, [user?.id, selectedUserId, isEmployee]);

  // Types query
  const { data: types = [] } = useLeaveTypes();

  // Summary query for selected employee
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useEmployeeLeaveSummary(selectedUserId, selectedYear, Boolean(selectedUserId));

  // Handle employee selection from search
  const handleSelectEmployee = (emp: LeaveSearchEmployee) => {
    setSelectedUserId(emp.id);

    // Save to recents
    if (typeof window !== 'undefined') {
      try {
        const updated = [emp, ...recentEmployees.filter((e) => e.id !== emp.id)].slice(0, 5);
        setRecentEmployees(updated);
        sessionStorage.setItem(RECENT_EMPLOYEES_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save recent employee', err);
      }
    }
  };

  const handleClearSelected = () => {
    setSelectedUserId(null);
  };

  const isSelf = selectedUserId === user?.id;

  return (
    <div className="flex flex-col gap-4 px-4 sm:gap-6 sm:px-6">
      {/* ── Page Header & Quick Navigation ── */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-slate-200 pb-4 sm:pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {isEmployee ? 'My Leaves' : 'Leave Management'}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            {isEmployee
              ? 'View your leave entitlements, applications, and history.'
              : user?.role === 'HOD'
              ? 'Department leave records, entitlements and applications.'
              : 'Organization-wide leave profiles, entitlements and audit history.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canActOnLeave(user?.role) && (
            <Link href="/leave/approvals">
              <Button type="button" variant="outline" className="rounded-xl text-xs font-medium h-8 sm:h-9">
                Approvals
              </Button>
            </Link>
          )}

          {canManageLeaveTypes(user?.role) && (
            <Link href="/leave/admin/types">
              <Button type="button" variant="outline" className="rounded-xl text-xs font-medium h-8 sm:h-9">
                Types
              </Button>
            </Link>
          )}

          {canManageLeaveBalances(user?.role) && (
            <Link href="/leave/admin/balances">
              <Button type="button" variant="outline" className="rounded-xl text-xs font-medium h-8 sm:h-9">
                Balances
              </Button>
            </Link>
          )}

          {canReadLeaveReports(user?.role) && (
            <Link href="/leave/admin/reports">
              <Button type="button" variant="outline" className="rounded-xl text-xs font-medium h-8 sm:h-9">
                Report
              </Button>
            </Link>
          )}

          <Link href="/leave/apply">
            <Button
              type="button"
              className="rounded-xl bg-green-700 text-xs font-semibold text-white shadow-sm hover:bg-green-800 h-8 sm:h-9"
            >
              Apply Leave
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Tab Switching: My Leaves / Other Employee Leaves ── */}
      {canSeeOthers && !isEmployee && (
        <div className="flex items-center gap-1 border-b border-slate-200 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedUserId(user?.id ?? null)}
            className={`px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              isSelf
                ? 'border-green-700 text-green-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            My Leaves
          </button>
          <button
            type="button"
            onClick={() => setSelectedUserId(null)}
            className={`px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
              !isSelf && !selectedUserId
                ? 'border-green-700 text-green-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Other Employee Leaves
          </button>
        </div>
      )}

      {/* ── SECTION A: EMPLOYEE SEARCH (Authorized Roles Only, Other Employee Leaves Tab) ── */}
      {canSeeOthers && !isEmployee && !isSelf && !selectedUserId && (
        <section className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="mb-3 sm:mb-4">
            <h2 className="text-sm font-bold text-slate-900">
              Employee Search
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Search by full name, personnel number, username or employee ID.
            </p>
          </div>

          <EmployeeLeaveSearch
            onSelectEmployee={handleSelectEmployee}
            selectedEmployeeId={selectedUserId}
          />

          {/* Quick Recent Employees Bar */}
          {recentEmployees.length > 0 && (
            <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 sm:pt-4">
              <span className="text-xs font-medium text-slate-500">Recent:</span>
              {recentEmployees.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => handleSelectEmployee(emp)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium transition bg-slate-50 text-slate-700 hover:bg-slate-100"
                >
                  <span className="truncate max-w-[150px] sm:max-w-none">{emp.full_name}</span>
                  {emp.personnel_number && (
                    <span className="font-mono text-[10px] text-slate-500 hidden sm:inline">
                      ({emp.personnel_number})
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── SECTION B: EMPLOYEE LEAVE PROFILE & TABS ── */}
      {(selectedUserId || isEmployee) ? (
        summaryLoading ? (
          /* Loading Skeleton */
          <div className="space-y-4 sm:space-y-6">
            <div className="h-24 sm:h-28 w-full animate-pulse rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50" />
            <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50" />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50" />
          </div>
        ) : summaryError || !summary ? (
          /* Error State */
          <div className="flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border border-rose-200 bg-rose-50 p-6 sm:p-10 text-center">
            <p className="text-sm sm:text-base font-bold text-rose-800">Failed to load employee leave records.</p>
            <p className="mt-1 text-xs text-rose-600">
              The employee may not exist or is outside your departmental scope.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetchSummary()}
              className="mt-4 rounded-xl text-xs h-8"
            >
              Retry
            </Button>
          </div>
        ) : (
          /* Loaded Profile */
          <div className="space-y-4 sm:space-y-6">
            {/* Employee Profile Header */}
            <EmployeeProfileHeader
              user={summary.user}
              selectedYear={selectedYear}
              canChangeEmployee={canSeeOthers && !isEmployee && !isSelf}
              onChangeEmployee={handleClearSelected}
              isSelf={isSelf}
            />

            {/* Profile Tabs: Overview, Leave Applications, Leave Balances, Leave History */}
            <EmployeeLeaveProfile
              summary={summary}
              types={types}
              isLoading={summaryLoading}
              isSelf={isSelf}
            />
          </div>
        )
      ) : (
        /* Empty State: Prompt Authorized User to Select an Employee */
        <div className="flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 sm:p-12 text-center">
          <h3 className="text-sm sm:text-base font-bold text-slate-900">
            Search for an Employee
          </h3>
          <p className="mt-2 max-w-md text-xs sm:text-sm text-slate-500">
            Use the search box above to find an employee by name, personnel number or ID.
          </p>
        </div>
      )}
    </div>
  );
}
