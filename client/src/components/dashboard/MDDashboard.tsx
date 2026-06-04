'use client';

import { MDDashboardData } from '@/api/types';
import { StatCard } from './StatCard';
import { BarChart3, AlertCircle, Trophy } from 'lucide-react';

interface MDDashboardProps {
  data: MDDashboardData;
}

export function MDDashboard({ data }: MDDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Stats</h2>
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
            icon={<Trophy size={24} />}
            variant="success"
          />
          <StatCard
            title="Pending"
            value={data.pendingTasks}
            icon={<BarChart3 size={24} />}
            variant="warning"
          />
          <StatCard
            title="Overdue"
            value={data.overdueTasks}
            icon={<AlertCircle size={24} />}
            variant="danger"
          />
        </div>
      </div>

      {/* Department Productivity */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Department Productivity
        </h3>
        <div className="space-y-4">
          {data.departmentProductivity?.map((dept) => (
            <div key={dept.department}>
              <div className="mb-2 flex justify-between">
                <p className="text-sm font-medium text-gray-700">
                  {dept.department}
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {dept.completion}%
                </p>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-green-600"
                  style={{ width: `${dept.completion}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Escalation Alerts */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Escalation Alerts
        </h3>
        {data.escalationAlerts && data.escalationAlerts.length > 0 ? (
          <div className="space-y-3">
            {data.escalationAlerts.slice(0, 5).map((task) => (
              <div
                key={task.id}
                className="border-l-4 border-red-500 bg-red-50 p-4"
              >
                <p className="font-medium text-gray-900">{task.title}</p>
                <p className="text-sm text-gray-600">{task.description}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Priority: {task.priority}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No escalation alerts</p>
        )}
      </div>

      {/* Top Performers */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Top Performers
        </h3>
        {data.topPerformers && data.topPerformers.length > 0 ? (
          <div className="space-y-3">
            {data.topPerformers.map((performer, index) => (
              <div key={performer.user.id} className="flex items-center gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white font-bold text-sm">
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {performer.user.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    Score: {performer.score}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No performers data</p>
        )}
      </div>
    </div>
  );
}
