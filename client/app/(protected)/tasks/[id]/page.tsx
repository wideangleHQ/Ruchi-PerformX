'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTask, useTaskComments } from '@/hooks/useQueries';
import { Button } from '@/components/ui/button';
import { TaskCommentSection } from '@/components/tasks/TaskCommentSection';
import { ArrowLeft, CheckCircle2, Clock, AlertCircle, Pause } from 'lucide-react';
import { Task, TaskStatus } from '@/api/types';

const statusIcons: Record<TaskStatus, React.ReactNode> = {
  TODO: <Clock size={20} className="text-gray-500" />,
  IN_PROGRESS: <AlertCircle size={20} className="text-blue-500" />,
  COMPLETED: <CheckCircle2 size={20} className="text-green-500" />,
  BLOCKED: <Pause size={20} className="text-red-500" />,
};

const statusLabels: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  BLOCKED: 'Blocked',
};

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;
  const { data: task, isLoading } = useTask(taskId);
  const { data: comments, isLoading: commentsLoading } = useTaskComments(taskId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600">Loading task...</p>
      </div>
    );
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

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/tasks"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          Back to Tasks
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{task.title}</h1>
            <p className="mt-2 text-gray-600">{task.description}</p>
          </div>
          <Link href={`/tasks/${task.id}/edit`}>
            <Button className="bg-blue-600 hover:bg-blue-700">Edit Task</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Task Description */}
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">Details</h2>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Description</p>
                <p className="mt-1 text-gray-900">{task.description}</p>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <TaskCommentSection
            taskId={taskId}
            comments={comments || []}
            isLoading={commentsLoading}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-sm font-semibold text-gray-900">Status</h3>
            <div className="mt-3 flex items-center gap-2">
              {statusIcons[task.status]}
              <span className="font-medium text-gray-900">
                {statusLabels[task.status]}
              </span>
            </div>
          </div>

          {/* Assignee */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-sm font-semibold text-gray-900">Assigned To</h3>
            {task.assignee ? (
              <div className="mt-3">
                <p className="font-medium text-gray-900">{task.assignee.name}</p>
                <p className="text-sm text-gray-600">{task.assignee.email}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-600">Unassigned</p>
            )}
          </div>

          {/* Priority */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-sm font-semibold text-gray-900">Priority</h3>
            <p className="mt-3 inline-block rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800">
              {task.priority}
            </p>
          </div>

          {/* Due Date */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-sm font-semibold text-gray-900">Due Date</h3>
            <p className="mt-3 text-gray-900">
              {task.dueDate
                ? new Date(task.dueDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'No due date'}
            </p>
          </div>

          {/* Created By */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-sm font-semibold text-gray-900">Created By</h3>
            {task.createdBy ? (
              <div className="mt-3">
                <p className="font-medium text-gray-900">{task.createdBy.name}</p>
                <p className="text-sm text-gray-600">
                  {new Date(task.createdAt).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-600">Unknown</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
