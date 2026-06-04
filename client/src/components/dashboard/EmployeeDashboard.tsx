'use client';

import { EmployeeDashboardData, TaskStatus } from '@/api/types';
import { StatCard } from './StatCard';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface EmployeeDashboardProps {
  data: EmployeeDashboardData;
}

export function EmployeeDashboard({ data }: EmployeeDashboardProps) {
  const taskCounts = Object.entries(data.tasksByStatus).reduce(
    (acc, [status, tasks]) => {
      acc[status as TaskStatus] = tasks.length;
      return acc;
    },
    {} as Record<TaskStatus, number>
  );

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">My Stats</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Tasks"
            value={
              (taskCounts.TODO || 0) +
              (taskCounts.IN_PROGRESS || 0) +
              (taskCounts.COMPLETED || 0) +
              (taskCounts.BLOCKED || 0)
            }
            icon={<Clock size={24} />}
            variant="primary"
          />
          <StatCard
            title="In Progress"
            value={taskCounts.IN_PROGRESS || 0}
            icon={<Clock size={24} />}
            variant="warning"
          />
          <StatCard
            title="Completed"
            value={taskCounts.COMPLETED || 0}
            icon={<CheckCircle size={24} />}
            variant="success"
          />
          <StatCard
            title="Monthly Score"
            value={`${data.monthlyScore}%`}
            icon={<CheckCircle size={24} />}
            variant="primary"
          />
        </div>
      </div>

      {/* Today's Actions */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Today&apos;s Actions
        </h3>
        {data.todayActions && data.todayActions.length > 0 ? (
          <div className="space-y-3">
            {data.todayActions.map((action, index) => (
              <div
                key={index}
                className="flex items-center justify-between border-l-4 border-green-500 bg-green-50 p-4"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {action.task.title}
                  </p>
                  <p className="text-sm text-gray-600">
                    Due: {action.dueTime}
                  </p>
                </div>
                <p className="text-sm font-medium text-green-700">Pending</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No actions due today</p>
        )}
      </div>

      {/* My Tasks by Status */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Tasks by Status
        </h3>
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex justify-between">
              <p className="text-sm font-medium text-gray-700">To Do</p>
              <p className="text-sm font-bold text-gray-900">
                {taskCounts.TODO || 0}
              </p>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-gray-400" />
            </div>
          </div>
          <div>
            <div className="mb-2 flex justify-between">
              <p className="text-sm font-medium text-gray-700">In Progress</p>
              <p className="text-sm font-bold text-gray-900">
                {taskCounts.IN_PROGRESS || 0}
              </p>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-blue-600" />
            </div>
          </div>
          <div>
            <div className="mb-2 flex justify-between">
              <p className="text-sm font-medium text-gray-700">Completed</p>
              <p className="text-sm font-bold text-gray-900">
                {taskCounts.COMPLETED || 0}
              </p>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Summary */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Notifications
        </h3>
        <p className="text-2xl font-bold text-gray-900">
          {data.notifications}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Unread messages
        </p>
      </div>
    </div>
  );
}
