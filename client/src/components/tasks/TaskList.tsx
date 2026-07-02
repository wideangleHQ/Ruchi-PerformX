'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, MessageSquare, Paperclip, ChevronRight } from 'lucide-react';
import { Task } from '@/api/types';
import { useAuth } from '@/context/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/api/tasks';
import { useToast } from '@/hooks/useToast';

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
  CREATED:              'bg-gray-100 text-gray-700',
  ASSIGNED:             'bg-yellow-100 text-yellow-700',
  ACCEPTED:             'bg-blue-100 text-blue-700',
  IN_PROGRESS:          'bg-blue-100 text-blue-700',
  COMPLETED:            'bg-green-100 text-green-700',
  REJECTED:             'bg-red-100 text-red-700',
  PENDING:              'bg-orange-100 text-orange-700',
  REVIEWED:             'bg-purple-100 text-purple-700',
  CLOSED:               'bg-gray-200 text-gray-800',
  HOD_VERIFIED_PENDING: 'bg-orange-100 text-orange-800',
  HOD_VERIFIED:         'bg-purple-100 text-purple-800',
};

function fmt(date: string | null | undefined) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const getValidNextStatuses = (currentStatus: string, userRole: string, isAssignee: boolean) => {
  if (userRole === 'EMPLOYEE' && isAssignee) {
    switch (currentStatus) {
      case 'CREATED':
      case 'ASSIGNED': return ['ACCEPTED'];
      case 'ACCEPTED': return ['IN_PROGRESS'];
      case 'IN_PROGRESS': return ['COMPLETED'];
      case 'COMPLETED': return ['HOD_VERIFIED_PENDING'];
      default: return [];
    }
  }
  
  if (['HOD', 'EA', 'PA', 'PURCHASE_HEAD', 'DEPARTMENT_CONTROLLER', 'MD'].includes(userRole)) {
    switch (currentStatus) {
      case 'CREATED':
      case 'ASSIGNED': return ['ACCEPTED'];
      case 'ACCEPTED': return ['IN_PROGRESS'];
      case 'IN_PROGRESS': return ['COMPLETED', 'REVIEWED', 'HOD_VERIFIED_PENDING'];
      case 'COMPLETED': return ['HOD_VERIFIED_PENDING', 'IN_PROGRESS', 'CLOSED'];
      case 'HOD_VERIFIED_PENDING': return ['HOD_VERIFIED'];
      case 'HOD_VERIFIED': return ['REVIEWED'];
      case 'REVIEWED': return ['CLOSED', 'IN_PROGRESS'];
      default: return [];
    }
  }

  return [];
};

function TaskRow({ task, user, canDeleteTask, onDeleteTask, isReassigned }: any) {
  const queryClient = useQueryClient();
  const toast = useToast();
  
  const isAssignee = user?.id === task.assigned_to_id;
  const validNextStatuses = getValidNextStatuses(task.status, user?.role, isAssignee);
  
  const [selectedStatus, setSelectedStatus] = useState(task.status);
  
  const updateMutation = useMutation({
    mutationFn: (newStatus: string) => {
      if (task.task_type === 'EMPLOYEE_SHARED') {
        return tasksApi.employeeSharing.updateStatus(task.id, newStatus);
      }
      return tasksApi.updateStatus(task.id, newStatus);
    },
    onSuccess: () => {
      toast.success('Task status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update status');
      setSelectedStatus(task.status);
    }
  });

  const hasStatusChanged = selectedStatus !== task.status;
  const assignedTo = task.users_tasks_assigned_to_idTousers;
  const assignedBy = task.users_tasks_assigned_by_idTousers;
  const departments = task.task_departments?.length
    ? task.task_departments.map((item: any) => item.departments?.name).filter(Boolean).join(', ')
    : task.departments?.name;

  return (
    <tr className={`transition-colors hover:bg-gray-50 ${isReassigned ? 'bg-green-50/60' : ''}`}>
      <td className="px-3 py-3 font-medium text-gray-900 max-w-[200px]">
        <div className="space-y-1">
          <Link href={`/tasks/${task.id}`} className="hover:text-green-700 hover:underline line-clamp-2">
            {task.title}
          </Link>
          {isReassigned && (
            <div className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
              <CheckCircle2 size={12} />
              Reassigned
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${priorityBadge[task.priority] ?? 'bg-gray-100 text-gray-700'}`}>
          {task.priority}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge[task.status] ?? 'bg-gray-100 text-gray-700'}`}>
          {task.status?.replace(/_/g, ' ')}
        </span>
      </td>
      <td className="px-3 py-3 text-gray-600 truncate max-w-[120px]">{assignedBy?.full_name ?? '—'}</td>
      <td className="px-3 py-3 text-gray-600 truncate max-w-[120px]">{assignedTo?.full_name ?? <span className="text-gray-400 italic">Unassigned</span>}</td>
      <td className="px-3 py-3 text-gray-600 truncate max-w-[120px]">{departments ?? '—'}</td>
      <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{fmt(task.due_date)}</td>
      <td className="px-3 py-3">
        {validNextStatuses.length > 0 ? (
          <div className="flex items-center gap-2">
            <select
              className="text-xs rounded border border-gray-300 py-1 px-2 text-gray-700 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-green-500"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              disabled={updateMutation.isPending}
            >
              <option value={task.status} disabled>{task.status.replace(/_/g, ' ')}</option>
              {validNextStatuses.map(status => (
                <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <button
              onClick={() => updateMutation.mutate(selectedStatus)}
              disabled={!hasStatusChanged || updateMutation.isPending}
              className="px-2 py-1 text-xs font-medium text-white bg-green-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700"
            >
              {updateMutation.isPending ? '...' : 'Update'}
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-400 italic">No updates available</span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          <Link href={`/tasks/${task.id}`} title="Comments" className="text-gray-400 hover:text-green-600 transition-colors">
            <MessageSquare size={16} />
          </Link>
          <Link href={`/tasks/${task.id}`} title="Attachments" className="text-gray-400 hover:text-green-600 transition-colors">
            <Paperclip size={16} />
          </Link>
          {canDeleteTask && (
            <button
              type="button"
              onClick={() => onDeleteTask?.(task)}
              className="rounded text-red-500 hover:text-red-700 transition-colors"
              title="Delete"
            >
              <span className="text-xs font-semibold">Delete</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function TaskList({ tasks, isLoading, reassignedTaskIds = [], canDeleteTask = false, onDeleteTask }: TaskListProps) {
  const { user } = useAuth();
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
            {['Task Title', 'Priority', 'Status', 'Assigned By', 'Assigned To', 'Department', 'Due Date', 'Update Status', 'Actions'].map((h) => (
              <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tasks.map((task) => (
            <TaskRow 
              key={task.id} 
              task={task} 
              user={user}
              isReassigned={reassignedSet.has(task.id)}
              canDeleteTask={canDeleteTask}
              onDeleteTask={onDeleteTask}
            />
          ))}
        </tbody>
      </table>

      <div className="border-t px-4 py-2 text-xs text-gray-400">
        {tasks.length} task{tasks.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
