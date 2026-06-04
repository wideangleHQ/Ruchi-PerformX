'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { tasksApi } from '@/api/tasks';
import { useUsers } from '@/hooks/useQueries';
import { createTaskSchema, CreateTaskFormData } from '@/lib/taskValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface TaskFormProps {
  onSuccess?: () => void;
}

export function TaskForm({ onSuccess }: TaskFormProps) {
  const router = useRouter();
  const { data: usersData } = useUsers();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
      dueDate: '',
      assigneeId: '',
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: CreateTaskFormData) =>
      tasksApi.createTask({
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate,
        assigneeId: data.assigneeId,
      }),
    onSuccess: (task) => {
      onSuccess?.();
      router.push(`/tasks/${task.id}`);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create task');
    },
  });

  const onSubmit = async (data: CreateTaskFormData) => {
    setError(null);
    await createTaskMutation.mutateAsync(data);
  };

  const users = usersData?.data || [];

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 rounded-lg bg-white p-6 shadow">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Task Title
        </label>
        <Input
          {...form.register('title')}
          placeholder="Enter task title"
          className="mt-1"
        />
        {form.formState.errors.title && (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          {...form.register('description')}
          placeholder="Enter task description"
          rows={4}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
        />
        {form.formState.errors.description && (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.description.message}
          </p>
        )}
      </div>

      {/* Priority and Due Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Priority
          </label>
          <select
            {...form.register('priority')}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Due Date
          </label>
          <Input
            {...form.register('dueDate')}
            type="date"
            className="mt-1"
          />
          {form.formState.errors.dueDate && (
            <p className="mt-1 text-sm text-red-600">
              {form.formState.errors.dueDate.message}
            </p>
          )}
        </div>
      </div>

      {/* Assignee */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Assign To
        </label>
        <select
          {...form.register('assigneeId')}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
        >
          <option value="">Select a user</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.role})
            </option>
          ))}
        </select>
        {form.formState.errors.assigneeId && (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.assigneeId.message}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex gap-4">
        <Button
          type="submit"
          disabled={createTaskMutation.isPending}
          className="bg-green-600 hover:bg-green-700"
        >
          {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
        </Button>
        <Button
          type="button"
          onClick={() => router.back()}
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
