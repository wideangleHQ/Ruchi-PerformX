'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTasks } from '@/hooks/useQueries';
import { useAuth } from '@/context/AuthContext';
import { useRequests } from '@/hooks/useQueries';
import { TaskList } from '@/components/tasks/TaskList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Filter, X } from 'lucide-react';

export default function TasksPage() {
  const { user } = useAuth();
  const canCreate = user?.role === 'MD' || user?.role === 'HOD';

  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [priority, setPriority] = useState('');

  const filters = {
    title:    search   || undefined,
    status:   status   || undefined,
    priority: priority || undefined,
  } as any;

  const { data: tasksData, isLoading } = useTasks(filters);
  const { data: reassignmentRequests } = useRequests(user?.role === 'EMPLOYEE' ? { type: 'TASK_REASSIGNMENT' } : undefined);
  const tasks = Array.isArray(tasksData) ? tasksData : (tasksData?.data ?? []);
  const reassignedTaskIds = useMemo(
    () => (reassignmentRequests ?? [])
      .filter((request) => request.status === 'ACCEPTED' && request.taskId)
      .map((request) => request.taskId as string),
    [reassignmentRequests],
  );

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setPriority('');
  };

  const hasFilters = search || status || priority;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="mt-1 text-gray-500">Manage and track all your tasks in one place</p>
        </div>
        {canCreate && (
          <Link href="/tasks/new">
            <Button className="gap-2 bg-green-600 hover:bg-green-700">
              <Plus size={18} />
              New Task
            </Button>
          </Link>
        )}
      </div>

      {/* Search + Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Input
            placeholder="Search by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-8"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            hasFilters ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter size={16} />
          Filters
          {hasFilters && <span className="ml-1 rounded-full bg-green-600 px-1.5 py-0.5 text-xs text-white">on</span>}
        </button>

        {hasFilters && (
          <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 underline">
            Clear all
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-4 flex flex-wrap gap-4 rounded-lg border border-gray-200 bg-white p-4">
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="CREATED">Created</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="CLOSED">Closed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div className="min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
      )}

      {/* Task Table */}
      <TaskList tasks={tasks} isLoading={isLoading} reassignedTaskIds={reassignedTaskIds} />
    </div>
  );
}
