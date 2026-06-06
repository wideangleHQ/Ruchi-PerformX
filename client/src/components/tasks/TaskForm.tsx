'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { tasksApi } from '@/api/tasks';
import { usersApi, Department } from '@/api/users';
import { useAuth } from '@/context/AuthContext';
import { createTaskSchema, CreateTaskFormData } from '@/lib/taskValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TaskFormProps {
  onSuccess?: () => void;
}

export function TaskForm({ onSuccess }: TaskFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const isMD = user?.role === 'MD';
  const isHOD = user?.role === 'HOD';

  const form = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
      dueDate: '',
      // HOD: department is derived from their JWT; MD: they pick it
      departmentId: isHOD ? (user?.departmentId ?? '') : '',
    },
  });

  // MD: fetch all departments for the dropdown
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => usersApi.getDepartments(),
    enabled: isMD,
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: CreateTaskFormData) =>
      tasksApi.createTask({
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate,
        departmentId: data.departmentId,
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 rounded-lg bg-white p-6 shadow">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Task Title</label>
        <Input {...form.register('title')} placeholder="Enter task title" className="mt-1" />
        {form.formState.errors.title && (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.title.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          {...form.register('description')}
          placeholder="Enter task description"
          rows={4}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
        />
        {form.formState.errors.description && (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.description.message}</p>
        )}
      </div>

      {/* Priority and Due Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Priority</label>
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
          <label className="block text-sm font-medium text-gray-700">Due Date</label>
          <Input {...form.register('dueDate')} type="date" className="mt-1" />
          {form.formState.errors.dueDate && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.dueDate.message}</p>
          )}
        </div>
      </div>

      {/* MD: Department picker */}
      {isMD && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Department</label>
          <select
            {...form.register('departmentId')}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {form.formState.errors.departmentId && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.departmentId.message}</p>
          )}
        </div>
      )}

      {/* HOD: show their department as read-only context */}
      {isHOD && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Department</label>
          <p className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            Your department (auto-assigned)
          </p>
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-4">
        <Button
          type="submit"
          disabled={createTaskMutation.isPending}
          className="bg-green-600 hover:bg-green-700"
        >
          {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
        </Button>
        <Button type="button" onClick={() => router.back()} variant="outline">
          Cancel
        </Button>
      </div>
    </form>
  );
}
