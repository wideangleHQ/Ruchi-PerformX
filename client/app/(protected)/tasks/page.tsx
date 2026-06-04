'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTasks } from '@/hooks/useQueries';
import { TaskList } from '@/components/tasks/TaskList';
import { Button } from '@/components/ui/button';
import { Plus, Filter } from 'lucide-react';

export default function TasksPage() {
  const [filters, setFilters] = useState({
    status: undefined,
    priority: undefined,
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data: tasksData, isLoading } = useTasks(filters);

  const tasks = tasksData?.data || [];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="mt-2 text-gray-600">
            Manage and track all your tasks in one place
          </p>
        </div>
        <Link href="/tasks/new">
          <Button className="gap-2 bg-green-600 hover:bg-green-700">
            <Plus size={18} />
            New Task
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Filter size={18} />
          Filters
        </button>

        {showFilters && (
          <div className="mt-4 space-y-4 rounded-lg border border-gray-300 bg-white p-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value || undefined })
                }
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">All Statuses</option>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="BLOCKED">Blocked</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Priority
              </label>
              <select
                value={filters.priority || ''}
                onChange={(e) =>
                  setFilters({ ...filters, priority: e.target.value || undefined })
                }
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <button
              onClick={() => setFilters({ status: undefined, priority: undefined })}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Task List */}
      <TaskList tasks={tasks} isLoading={isLoading} />
    </div>
  );
}
