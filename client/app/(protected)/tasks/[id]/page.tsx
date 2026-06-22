'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRequests, useTask, useTaskComments } from '@/hooks/useQueries';
import { useAuth } from '@/context/AuthContext';
import { requestsApi } from '@/api/requests';
import { tasksApi } from '@/api/tasks';
import { Button } from '@/components/ui/button';
import { TaskCommentSection } from '@/components/tasks/TaskCommentSection';
import { ArrowLeft, CheckCircle2, Clock, AlertCircle, Pause, XCircle } from 'lucide-react';
import { TaskStatus } from '@/api/types';

const statusIcons: Record<TaskStatus, ReactNode> = {
  CREATED: <Clock size={20} className="text-gray-500" />,
  ASSIGNED: <Clock size={20} className="text-purple-500" />,
  ACCEPTED: <CheckCircle2 size={20} className="text-cyan-500" />,
  IN_PROGRESS: <AlertCircle size={20} className="text-blue-500" />,
  COMPLETED: <CheckCircle2 size={20} className="text-green-500" />,
  REJECTED: <XCircle size={20} className="text-red-500" />,
  PENDING: <Pause size={20} className="text-yellow-500" />,
  REVIEWED: <CheckCircle2 size={20} className="text-teal-500" />,
  CLOSED: <CheckCircle2 size={20} className="text-gray-500" />,
};
  
function formatDate(date?: string | null) {
  if (!date) return 'No due date';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function label(status: string) {
  return status.replace(/_/g, ' ');
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: task, isLoading } = useTask(taskId);
  const { data: comments, isLoading: commentsLoading } = useTaskComments(taskId);
  const { data: requests = [] } = useRequests({ type: 'TASK_REASSIGNMENT', taskId });
  const [error, setError] = useState<string | null>(null);
  const [showReassign, setShowReassign] = useState(false);
  const [reason, setReason] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  const mutation = useMutation({
    mutationFn: (action: 'accept' | 'progress' | 'complete' | 'review' | 'close') => {
      if (action === 'accept') return tasksApi.acceptTask(taskId);
      if (action === 'progress') return tasksApi.markInProgress(taskId);
      if (action === 'complete') return tasksApi.completeTask(taskId);
      if (action === 'review') return tasksApi.reviewTask(taskId);
      return tasksApi.closeTask(taskId);
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to update task');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.deleteTask(taskId, deleteReason.trim()),
    onSuccess: async () => {
      setError(null);
      setShowDelete(false);
      setDeleteReason('');
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });
      router.push('/tasks');
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to delete task');
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-gray-600">Loading task...</div>;
  }

  if (!task) {
    return (
      <div className="rounded-lg bg-red-50 p-6">
        <p className="text-red-700">Task not found</p>
        <Link href="/tasks" className="mt-4 inline-block text-sm text-red-600 hover:text-red-700">
          Back to tasks
        </Link>
      </div>
    );
  }

  const assignedTo = task.users_tasks_assigned_to_idTousers;
  const assignedBy = task.users_tasks_assigned_by_idTousers;
  const departments = task.task_departments?.length
    ? task.task_departments.map((item) => item.departments?.name).filter(Boolean).join(', ')
    : task.departments?.name;
  const dueDate = task.due_date ?? task.dueDate;
  const createdAt = task.created_at ?? task.createdAt;
  const isEmployeeOwner = user?.role === 'EMPLOYEE' && task.assigned_to_id === user.id;
  const isReviewer = user?.role === 'MD' || user?.role === 'HOD';
  const isMD = user?.role === 'MD';
  const taskDepartmentIds = task.task_departments?.map((item) => item.departments?.id).filter(Boolean) ?? [];
  const canDeleteTask = user?.role === 'HOD' && Boolean(user.departmentIds?.some((departmentId) => taskDepartmentIds.includes(departmentId)));
  const canRequestReassignment = isEmployeeOwner && task.status !== 'COMPLETED' && task.status !== 'CLOSED';
  const hasPendingReassignment = Boolean(requests.some((request) => request.status === 'PENDING'));

  const submitReassignment = async () => {
    if (!reason.trim()) return;
    try {
      setError(null);
      await requestsApi.createTaskReassignmentRequest({
        taskId: task.id,
        currentAssigneeId: task.assigned_to_id ?? user?.id ?? '',
        requestReason: reason.trim(),
      });
      setShowReassign(false);
      setReason('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit reassignment request');
    }
  };

  return (
    <div>
      <div className="mb-8">
        <Link href="/tasks" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft size={16} />
          Back to Tasks
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{task.title}</h1>
            <p className="mt-2 text-gray-600">{task.description}</p>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-gray-600">Task Creator</p>
                <p className="mt-1 text-gray-900">{assignedBy?.full_name ?? 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Assigned Departments</p>
                <p className="mt-1 text-gray-900">{departments ?? 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Assigned Employee</p>
                <p className="mt-1 text-gray-900">{assignedTo?.full_name ?? 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Created</p>
                <p className="mt-1 text-gray-900">{formatDate(createdAt)}</p>
              </div>
            </div>
            {task.task_attachments?.length ? (
              <div className="mt-6">
                <p className="text-sm font-semibold text-gray-900">Attachments</p>
                <div className="mt-3 space-y-2">
                  {task.task_attachments.map((file) => (
                    <a
                      key={file.id}
                      href={file.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <div className="font-medium">{file.file_name}</div>
                      <div className="text-xs text-gray-500">{(file.file_size_kb ?? 0).toLocaleString()} KB</div>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <TaskCommentSection taskId={taskId} comments={comments || []} isLoading={commentsLoading} />
        </div>

        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-sm font-semibold text-gray-900">Status</h3>
            <div className="mt-3 flex items-center gap-2">
              {statusIcons[task.status]}
              <span className="font-medium text-gray-900">{label(task.status)}</span>
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-sm font-semibold text-gray-900">Priority</h3>
            <p className="mt-3 inline-block rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800">
              {task.priority}
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-sm font-semibold text-gray-900">Due Date</h3>
            <p className="mt-3 text-gray-900">{formatDate(dueDate)}</p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-sm font-semibold text-gray-900">Actions</h3>
            <div className="mt-4 grid gap-2">
              {(isEmployeeOwner || isMD) && task.status === 'ASSIGNED' && (
                <Button disabled={mutation.isPending} onClick={() => mutation.mutate('accept')}>Accept</Button>
              )}
              {(isEmployeeOwner || isMD) && (task.status === 'ACCEPTED' || task.status === 'PENDING') && (
                <Button disabled={mutation.isPending} onClick={() => mutation.mutate('progress')}>Start Progress</Button>
              )}
              {(isEmployeeOwner || isMD) && task.status === 'IN_PROGRESS' && (
                <Button disabled={mutation.isPending} onClick={() => mutation.mutate('complete')}>Complete</Button>
              )}
              {isReviewer && task.status === 'COMPLETED' && (
                <Button disabled={mutation.isPending} onClick={() => mutation.mutate('review')}>Review</Button>
              )}
              {isReviewer && task.status === 'REVIEWED' && (
                <Button disabled={mutation.isPending} onClick={() => mutation.mutate('close')}>Close</Button>
              )}
              {canRequestReassignment && !hasPendingReassignment && (
                <Button variant="outline" onClick={() => setShowReassign((value) => !value)}>
                  Request Reassignment
                </Button>
              )}
              {canRequestReassignment && hasPendingReassignment && (
                <p className="text-sm text-amber-600">A pending reassignment request already exists for this task.</p>
              )}
              {canDeleteTask && (
                <Button variant="destructive" onClick={() => setShowDelete(true)}>
                  Delete Task
                </Button>
              )}
              {!isEmployeeOwner && !isReviewer && <p className="text-sm text-gray-500">No actions available</p>}
            </div>
            {showReassign && canRequestReassignment && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
                  <h2 className="text-xl font-bold text-gray-900">Request Reassignment</h2>
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Task Name</p>
                      <p className="mt-1 text-gray-900">{task.title}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Task Description</p>
                      <p className="mt-1 whitespace-pre-wrap text-gray-900">{task.description}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Request Reason</p>
                      <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        required
                        rows={4}
                        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowReassign(false)}>
                      Cancel
                    </Button>
                    <Button onClick={submitReassignment} disabled={!reason.trim()}>
                      Submit Request
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {showDelete && canDeleteTask && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
                  <h2 className="text-xl font-bold text-gray-900">Delete Task</h2>
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Task Name</p>
                      <p className="mt-1 text-gray-900">{task.title}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Task Description</p>
                      <p className="mt-1 whitespace-pre-wrap text-gray-900">{task.description}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Delete Reason</p>
                      <textarea
                        value={deleteReason}
                        onChange={(event) => setDeleteReason(event.target.value)}
                        required
                        rows={4}
                        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => { setShowDelete(false); setDeleteReason(''); }}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={!deleteReason.trim() || deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate()}
                    >
                      Delete Task
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
