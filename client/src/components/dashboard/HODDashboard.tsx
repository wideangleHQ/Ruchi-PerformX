'use client';

import { HODDashboardData } from '@/api/types';
import { StatCard } from './StatCard';
import { BarChart3, Clock, AlertCircle } from 'lucide-react';

interface HODDashboardProps {
  data: HODDashboardData;
}

export function HODDashboard({ data }: HODDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Team Stats</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Tasks"
            value={data.totalTasks}
            icon={<BarChart3 size={24} />}
            variant="primary"
          />
          <StatCard
            title="Completed"
            value={data.completedTasks}
            icon={<BarChart3 size={24} />}
            variant="success"
          />
          <StatCard
            title="Pending"
            value={data.pendingTasks}
            icon={<Clock size={24} />}
            variant="warning"
          />
          <StatCard
            title="Team Productivity"
            value={`${data.teamProductivity}%`}
            icon={<BarChart3 size={24} />}
            variant="primary"
          />
        </div>
      </div>

      {/* Pending Approvals */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Pending Approvals
        </h3>
        <p className="text-2xl font-bold text-gray-900">
          {data.pendingApprovals}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Waiting for your review
        </p>
      </div>

      {/* Transfer Requests */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Transfer Requests
        </h3>
        {data.transferRequests && data.transferRequests.length > 0 ? (
          <div className="space-y-3">
            {data.transferRequests.map((transfer, index) => (
              <div key={index} className="border-l-4 border-blue-500 bg-blue-50 p-4">
                <p className="font-medium text-gray-900">Transfer Request {index + 1}</p>
                <p className="text-sm text-gray-600">
                  Status: Pending review
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No pending transfer requests</p>
        )}
      </div>
    </div>
  );
}
