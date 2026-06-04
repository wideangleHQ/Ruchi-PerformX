'use client';

import { useAuth } from '@/context/AuthContext';
import { useDashboard } from '@/hooks/useQueries';
import { MDDashboard } from '@/components/dashboard/MDDashboard';
import { HODDashboard } from '@/components/dashboard/HODDashboard';
import { EmployeeDashboard } from '@/components/dashboard/EmployeeDashboard';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const { data: dashboardData, isLoading: isDashboardLoading } = useDashboard();

  if (isLoading || isDashboardLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || !dashboardData) {
    return (
      <div className="rounded-lg bg-red-50 p-6">
        <p className="text-red-700">Unable to load dashboard data</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold text-gray-900">Dashboard</h1>
      <p className="mb-8 text-gray-600">
        Welcome back, {user.name}. Here&apos;s your performance overview.
      </p>

      {/* Role-based Dashboard Rendering */}
      {user.role === 'MD' && dashboardData.mdWidgets && (
        <MDDashboard data={dashboardData.mdWidgets} />
      )}

      {user.role === 'HOD' && dashboardData.hodWidgets && (
        <HODDashboard data={dashboardData.hodWidgets} />
      )}

      {user.role === 'EMPLOYEE' && dashboardData.employeeWidgets && (
        <EmployeeDashboard data={dashboardData.employeeWidgets} />
      )}

      {user.role === 'ADMIN' && dashboardData.adminWidgets && (
        <AdminDashboard data={dashboardData.adminWidgets} />
      )}

      {/* Fallback for missing widgets */}
      {!dashboardData.mdWidgets &&
        !dashboardData.hodWidgets &&
        !dashboardData.employeeWidgets &&
        !dashboardData.adminWidgets && (
          <div className="rounded-lg bg-yellow-50 p-6">
            <p className="text-yellow-700">
              Dashboard widgets not available for your role
            </p>
          </div>
        )}
    </div>
  );
}
