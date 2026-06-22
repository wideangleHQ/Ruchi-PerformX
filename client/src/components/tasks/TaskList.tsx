'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Task } from '@/api/types';

interface TaskListProps {
  tasks: any[];
  isLoading?: boolean;
  reassignedTaskIds?: string[];
  canDeleteTask?: boolean;
  onDeleteTask?: (task: any) => void;
}

const priorityBadge: Record<string, string> = {
  LOW:      'bg-blue-100 text-blue-800',
  MEDIUM:   'bg-yellow-100 text-yellow-800',
  HIGH:     'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
};

const statusBadge: Record<string, string> = {
  CREATED:     'bg-gray-100 text-gray-700',
  ASSIGNED:    'bg-purple-100 text-purple-700',
  ACCEPTED:    'bg-cyan-100 text-cyan-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED:   'bg-green-100 text-green-700',
  REVIEWED:    'bg-teal-100 text-teal-700',
  CLOSED:      'bg-gray-200 text-gray-600',
  PENDING:     'bg-yellow-100 text-yellow-700',
  REJECTED:    'bg-red-100 text-red-700',
};

function fmt(date: string | null | undefined) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function TaskList({ tasks, isLoading, reassignedTaskIds = [], canDeleteTask = false, onDeleteTask }: TaskListProps) {
  const reassignedSet = new Set(reassignedTaskIds);

  if (isLoading) {
    return <div className="py-12 text-center text-gray-500">Loading tasks...</div>;
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 py-16 text-center">
        <p className="text-gray-500">No tasks found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Task Title', 'Department', 'Assigned By', 'Assigned To', 'Priority', 'Status', 'Due Date', 'Created', ...(canDeleteTask ? [''] : [])].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tasks.map((task) => {
            const assignedTo = task.users_tasks_assigned_to_idTousers;
            const assignedBy = task.users_tasks_assigned_by_idTousers;
            const departments = task.task_departments?.length
              ? task.task_departments.map((item: any) => item.departments?.name).filter(Boolean).join(', ')
              : task.departments?.name;
            const isReassigned = reassignedSet.has(task.id);

            return (
              <tr key={task.id} className={`transition-colors hover:bg-gray-50 ${isReassigned ? 'bg-green-50/60' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-900 max-w-[220px]">
                  <div className="space-y-1">
                    <Link href={`/tasks/${task.id}`} className="hover:text-green-700 hover:underline line-clamp-2">
                      {task.title}
                    </Link>
                    {isReassigned ? (
                      <div className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        <CheckCircle2 size={12} />
                        Reassigned
                      </div>
                    ) : null}
                  </div>
                </td>

                <td className="px-4 py-3 text-gray-600">
                  {departments ?? '—'}
                </td>

                <td className="px-4 py-3 text-gray-600">
                  {assignedBy?.full_name ?? '—'}
                </td>

                <td className="px-4 py-3 text-gray-600">
                  {assignedTo?.full_name ?? <span className="text-gray-400 italic">Unassigned</span>}
                </td>

                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${priorityBadge[task.priority] ?? 'bg-gray-100 text-gray-700'}`}>
                    {task.priority}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge[task.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {task.status?.replace(/_/g, ' ')}
                  </span>
                </td>

                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {fmt(task.due_date)}
                </td>

                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {fmt(task.created_at)}
                </td>

                {canDeleteTask ? (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onDeleteTask?.(task)}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="border-t px-4 py-2 text-xs text-gray-400">
        {tasks.length} task{tasks.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
