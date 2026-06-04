'use client';

import Link from 'next/link';
import { Task, TaskStatus, TaskPriority } from '@/api/types';
import { CheckCircle2, Clock, AlertCircle, Pause } from 'lucide-react';
import { useState } from 'react';

interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
}

const statusIcons: Record<TaskStatus, React.ReactNode> = {
  TODO: <Clock size={16} className="text-gray-500" />,
  IN_PROGRESS: <AlertCircle size={16} className="text-blue-500" />,
  COMPLETED: <CheckCircle2 size={16} className="text-green-500" />,
  BLOCKED: <Pause size={16} className="text-red-500" />,
};

const statusColors: Record<TaskStatus, string> = {
  TODO: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  BLOCKED: 'bg-red-100 text-red-800',
};

const priorityColors: Record<TaskPriority, string> = {
  LOW: 'bg-blue-100 text-blue-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

export function TaskList({ tasks, isLoading }: TaskListProps) {
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'status'>('dueDate');

  if (isLoading) {
    return <div className="text-center py-8">Loading tasks...</div>;
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 p-8 text-center">
        <p className="text-gray-600">No tasks found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">
          Found {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </p>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="rounded border border-gray-300 px-3 py-1 text-sm"
        >
          <option value="dueDate">Sort by Due Date</option>
          <option value="priority">Sort by Priority</option>
          <option value="status">Sort by Status</option>
        </select>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => (
          <Link
            key={task.id}
            href={`/tasks/${task.id}`}
            className="block rounded-lg border bg-white p-4 transition-shadow hover:shadow-lg"
          >
            <div className="flex items-start gap-4">
              <div className="mt-1">{statusIcons[task.status]}</div>

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">
                  {task.title}
                </h3>
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                  {task.description}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                      statusColors[task.status]
                    }`}
                  >
                    {task.status.replace('_', ' ')}
                  </span>
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                      priorityColors[task.priority]
                    }`}
                  >
                    {task.priority}
                  </span>
                </div>
              </div>

              <div className="text-right text-sm">
                {task.assignee && (
                  <>
                    <p className="font-medium text-gray-900">
                      {task.assignee.name}
                    </p>
                    <p className="text-gray-600">
                      {task.dueDate
                        ? new Date(task.dueDate).toLocaleDateString()
                        : 'No due date'}
                    </p>
                  </>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
