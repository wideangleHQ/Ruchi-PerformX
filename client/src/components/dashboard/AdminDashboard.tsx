'use client';

import { AdminDashboardData } from '@/api/types';
import { StatCard } from './StatCard';
import { Users, Building2 } from 'lucide-react';

interface AdminDashboardProps {
  data: AdminDashboardData;
}

export function AdminDashboard({ data }: AdminDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">System Stats</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Users"
            value={data.totalUsers}
            icon={<Users size={24} />}
            variant="primary"
          />
          <StatCard
            title="Total Departments"
            value={data.totalDepartments}
            icon={<Building2 size={24} />}
            variant="success"
          />
        </div>
      </div>

      {/* Recent Audit Logs */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Recent Audit Logs
        </h3>
        {data.recentAuditLogs && data.recentAuditLogs.length > 0 ? (
          <div className="space-y-3">
            {data.recentAuditLogs.map((log, index) => (
              <div key={index} className="border-l-4 border-gray-500 bg-gray-50 p-4">
                <p className="font-medium text-gray-900">Action {index + 1}</p>
                <p className="text-sm text-gray-600">
                  Audit log entry
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No audit logs</p>
        )}
      </div>
    </div>
  );
}
