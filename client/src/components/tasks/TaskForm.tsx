'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { tasksApi, TaskDepartment } from '@/api/tasks';
import { User } from '@/api/types';
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
      assignedToId: '',
      departmentId: '',
      departmentIds: [],
    },
  });

  const { data: departments = [] } = useQuery<TaskDepartment[]>({
    queryKey: ['task-departments'],
    queryFn: () => tasksApi.getDepartments(),
    enabled: isMD || isHOD,
  });
  const selectedDepartmentIds = form.watch('departmentIds') ?? [];
  const selectedDepartmentId = form.watch('departmentId');
  const assigneeDepartmentIds = isHOD
    ? selectedDepartmentIds
    : selectedDepartmentId
      ? [selectedDepartmentId]
      : [];

  const { data: assignees = [] } = useQuery<User[]>({
    queryKey: ['task-assignees', assigneeDepartmentIds],
    queryFn: () => tasksApi.getAssignees(assigneeDepartmentIds),
    enabled: (isMD || isHOD) && assigneeDepartmentIds.length > 0,
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: CreateTaskFormData) =>
      tasksApi.createTask({
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate,
        assignedToId: data.assignedToId || undefined,
        departmentId: data.departmentId || undefined,
        departmentIds: data.departmentIds?.length ? data.departmentIds : undefined,
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

      <div>
        <label className="block text-sm font-medium text-gray-700">Task Title</label>
        <Input {...form.register('title')} placeholder="Enter task title" className="mt-1" />
        {form.formState.errors.title && (
          <p className="mt-1 text-sm text-red-600">{form.formState.errors.title.message}</p>
        )}
      </div>

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

      {isMD && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Department</label>
          <select
            {...form.register('departmentId')}
            onChange={(event) => {
              form.setValue('departmentId', event.target.value, { shouldValidate: true });
              form.setValue('assignedToId', '');
            }}
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

      {isHOD && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Department Selection</label>
          <div className="mt-2 grid gap-2 rounded-lg border border-gray-200 p-3">
            {departments.map((department) => (
              <label key={department.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedDepartmentIds.includes(department.id)}
                  onChange={(event) => {
                    form.setValue(
                      'departmentIds',
                      event.target.checked
                        ? [...selectedDepartmentIds, department.id]
                        : selectedDepartmentIds.filter((id) => id !== department.id),
                      { shouldValidate: true },
                    );
                    form.setValue('assignedToId', '');
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-green-600"
                />
                {department.name}
              </label>
            ))}
          </div>
          {form.formState.errors.departmentIds && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.departmentIds.message}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">Assigned Employee</label>
        <select
          {...form.register('assignedToId')}
          disabled={!assigneeDepartmentIds.length}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">Unassigned</option>
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.id}>
              {assignee.fullName}
            </option>
          ))}
        </select>
      </div>

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
