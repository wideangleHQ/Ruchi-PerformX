'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { tasksApi, TaskDepartment } from '@/api/tasks';
import { User } from '@/api/types';
import { useAuth } from '@/context/AuthContext';
import { createTaskSchema, CreateTaskFormData } from '@/lib/taskValidation';
import { prepareAttachmentFiles } from '@/lib/attachmentUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TaskFormProps {
  onSuccess?: () => void;
}

export function TaskForm({ onSuccess }: TaskFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const userRole = user?.role;

  const canCreateTask = Boolean(userRole) && userRole !== 'EMPLOYEE';

  const form = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
      dueDate: '',
      assignedToId: '',
      assignedToIds: [],
      assignAllEmployees: false,
      departmentId: '',
      departmentIds: [],
    },
  });

  const { data: departments = [] } = useQuery<TaskDepartment[]>({
    queryKey: ['task-departments'],
    queryFn: () => tasksApi.getDepartments(),
    enabled: canCreateTask,
  });
  const selectedDepartmentIds = form.watch('departmentIds') ?? [];
  const selectedAssigneeIds = form.watch('assignedToIds') ?? [];
  const selectAllEmployees = form.watch('assignAllEmployees') ?? false;

  const { data: assignees = [] } = useQuery<User[]>({
    queryKey: ['task-assignees', selectedDepartmentIds],
    queryFn: () => tasksApi.getAssignees(selectedDepartmentIds),
    enabled: canCreateTask && selectedDepartmentIds.length > 0,
  });

  useEffect(() => {
    const allowedIds = new Set(assignees.map((assignee) => assignee.id));
    const filteredIds = selectedAssigneeIds.filter((id) => allowedIds.has(id));
    const nextIds = selectAllEmployees ? assignees.map((assignee) => assignee.id) : filteredIds;

    const isSame =
      nextIds.length === selectedAssigneeIds.length &&
      nextIds.every((id, index) => id === selectedAssigneeIds[index]);

    if (!isSame) {
      form.setValue('assignedToIds', nextIds, { shouldValidate: true });
    }
  }, [assignees, form, selectAllEmployees, selectedAssigneeIds]);

  const createTaskMutation = useMutation({
    mutationFn: (data: CreateTaskFormData & { attachments?: File[] }) =>
      tasksApi.createTask({
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate,
        assignedToId: data.assignedToId || undefined,
        assignedToIds: data.assignAllEmployees ? undefined : data.assignedToIds?.length ? data.assignedToIds : undefined,
        assignAllEmployees: data.assignAllEmployees || undefined,
        departmentId: data.departmentId || undefined,
        departmentIds: data.departmentIds?.length ? data.departmentIds : undefined,
        attachments: data.attachments,
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
    const preparedAttachments = await prepareAttachmentFiles(attachments);
    await createTaskMutation.mutateAsync({ ...data, attachments: preparedAttachments });
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

      <div>
        <label className="block text-sm font-medium text-gray-700">Attachments</label>
        <Input
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,image/jpeg,image/png,image/webp,application/pdf"
          className="mt-1"
          onChange={(event) => setAttachments(Array.from(event.target.files ?? []))}
        />
        {attachments.length ? (
          <div className="mt-2 space-y-1 text-xs text-gray-600">
            {attachments.map((file) => (
              <div key={`${file.name}-${file.size}`}>{file.name}</div>
            ))}
          </div>
        ) : null}
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

      <div>
        <label className="block text-sm font-medium text-gray-700">Department Selection</label>
        <div className="mt-2 grid gap-2 rounded-lg border border-gray-200 p-3">
          {departments.map((department) => (
            <label key={department.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={selectedDepartmentIds.includes(department.id)}
                onChange={(event) => {
                  const nextDepartmentIds = event.target.checked
                    ? [...selectedDepartmentIds, department.id]
                    : selectedDepartmentIds.filter((id) => id !== department.id);

                  form.setValue('departmentIds', nextDepartmentIds, { shouldValidate: true });
                  form.setValue('departmentId', nextDepartmentIds[0] ?? '', { shouldValidate: true });
                  form.setValue('assignedToId', '');
                  form.setValue('assignedToIds', []);
                  form.setValue('assignAllEmployees', false);
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

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">Employees</label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={selectAllEmployees}
              disabled={!selectedDepartmentIds.length || !assignees.length}
              onChange={(event) => {
                const checked = event.target.checked;
                form.setValue('assignAllEmployees', checked, { shouldValidate: true });
                form.setValue('assignedToIds', checked ? assignees.map((assignee) => assignee.id) : []);
              }}
              className="h-4 w-4 rounded border-gray-300 text-green-600"
            />
            Select All Employees
          </label>
        </div>

        <div className="mt-2 rounded-lg border border-gray-200 p-3">
          {!selectedDepartmentIds.length ? (
            <p className="text-sm text-gray-500">Select at least one department to load employees.</p>
          ) : assignees.length ? (
            <div className="grid gap-2">
              {assignees.map((assignee) => {
                const checked = selectedAssigneeIds.includes(assignee.id);

                return (
                  <label key={assignee.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={selectAllEmployees}
                      onChange={(event) => {
                        const nextIds = event.target.checked
                          ? [...selectedAssigneeIds, assignee.id]
                          : selectedAssigneeIds.filter((id) => id !== assignee.id);

                        form.setValue('assignedToIds', [...new Set(nextIds)], { shouldValidate: true });
                        form.setValue('assignAllEmployees', false, { shouldValidate: true });
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-green-600"
                    />
                    <span className="font-medium text-gray-900">{assignee.fullName}</span>
                    <span className="text-xs text-gray-500">
                      {assignee.department?.name ?? assignee.departmentId ?? ''}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No active employees found for the selected department(s).</p>
          )}
        </div>
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
