'use client';

import { useEffect, useMemo, useState } from 'react';
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
  taskType?: string;
}

export function TaskForm({ onSuccess, taskType = 'OFFICIAL' }: TaskFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<'EMPLOYEE' | 'DEPARTMENT'>('EMPLOYEE');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const userRole = user?.role;
  const isEmployeeShared = taskType === 'EMPLOYEE_SHARED';
  const canDelegateOfficial = userRole === 'HOD' && taskType === 'OFFICIAL';

  const canCreateTask = Boolean(userRole) && (userRole !== 'EMPLOYEE' || taskType === 'EMPLOYEE_SHARED');

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
      departmentId: taskType === 'EMPLOYEE_SHARED' && user?.departmentId ? user.departmentId : '',
      departmentIds: taskType === 'EMPLOYEE_SHARED' && user?.departmentId ? [user.departmentId] : [],
      delegateDepartmentId: '',
    },
  });

  const { data: departments = [] } = useQuery<TaskDepartment[]>({
    queryKey: ['task-departments', taskType],
    queryFn: () => (isEmployeeShared ? tasksApi.employeeSharing.getDepartments() : tasksApi.getDepartments()),
    enabled: canCreateTask,
  });
  const { data: delegationDepartments = [] } = useQuery<Array<TaskDepartment & { hod?: { id: string; fullName: string } | null }>>({
    queryKey: ['task-delegation-departments'],
    queryFn: () => tasksApi.getDelegationDepartments(),
    enabled: canCreateTask && canDelegateOfficial,
  });
  const selectedDepartmentIds = form.watch('departmentIds') ?? [];
  const selectedDepartmentId = selectedDepartmentIds[0] ?? '';
  const selectedDelegateDepartmentId = form.watch('delegateDepartmentId') ?? '';
  const selectedAssigneeIds = form.watch('assignedToIds') ?? [];
  const selectAllEmployees = form.watch('assignAllEmployees') ?? false;
  const selectedDelegateDepartment = delegationDepartments.find((department) => department.id === selectedDelegateDepartmentId);

  const { data: assignees = [] } = useQuery<User[]>({
    queryKey: ['task-assignees', selectedDepartmentIds, taskType, assignmentMode],
    queryFn: () => {
      if (isEmployeeShared) {
        return tasksApi.employeeSharing.getAssignees(selectedDepartmentId);
      }
      return tasksApi.getAssignees(selectedDepartmentIds);
    },
    enabled: canCreateTask && assignmentMode === 'EMPLOYEE' && selectedDepartmentIds.length > 0,
  });

  const filteredAssignees = useMemo(() => {
    if (!employeeSearch.trim()) return assignees;
    const query = employeeSearch.toLowerCase();
    return assignees.filter(
      (a) =>
        a.fullName?.toLowerCase().includes(query) ||
        a.email?.toLowerCase().includes(query) ||
        a.username?.toLowerCase().includes(query),
    );
  }, [assignees, employeeSearch]);

  const selectedAssigneeNames = useMemo(() => {
    if (!isEmployeeShared || !selectedAssigneeIds.length) return [];
    return selectedAssigneeIds
      .map((id) => assignees.find((a) => a.id === id))
      .filter(Boolean) as User[];
  }, [assignees, isEmployeeShared, selectedAssigneeIds]);

  useEffect(() => {
    if (isEmployeeShared || !canDelegateOfficial || assignmentMode !== 'DEPARTMENT') return;
    if (!selectedDepartmentIds.length && departments.length) {
      const sourceDepartmentId = user?.departmentIds?.[0] ?? user?.departmentId ?? departments[0]?.id ?? '';
      if (sourceDepartmentId) {
        form.setValue('departmentId', sourceDepartmentId, { shouldValidate: true });
        form.setValue('departmentIds', [sourceDepartmentId], { shouldValidate: true });
      }
    }
  }, [assignmentMode, canDelegateOfficial, departments, form, isEmployeeShared, selectedDepartmentIds.length, user?.departmentId, user?.departmentIds]);

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
  }, [assignees, form, isEmployeeShared, selectAllEmployees, selectedAssigneeIds]);

  const createTaskMutation = useMutation({
    mutationFn: (data: CreateTaskFormData & { attachments?: File[] }) => {
      const payload = {
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate,
        assignedToId: data.assignedToId || undefined,
        assignedToIds: data.assignAllEmployees ? undefined : data.assignedToIds?.length ? data.assignedToIds : undefined,
        assignAllEmployees: data.assignAllEmployees || undefined,
        departmentId: data.departmentId || undefined,
        departmentIds: data.departmentIds?.length ? data.departmentIds : undefined,
        delegateDepartmentId: assignmentMode === 'DEPARTMENT' ? data.delegateDepartmentId || undefined : undefined,
        attachments: data.attachments,
        taskType,
      };
      
      if (taskType === 'EMPLOYEE_SHARED') {
        return tasksApi.employeeSharing.createTask(payload);
      }
      return tasksApi.createTask(payload);
    },
    onSuccess: (task) => {
      onSuccess?.();
      if (taskType === 'EMPLOYEE_SHARED') {
        router.push('/tasks?tab=EMPLOYEE_SHARED');
      } else {
        router.push(`/tasks/${task.id}`);
      }
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

      {canDelegateOfficial && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Assignment Type</label>
          <div className="mt-2 flex gap-4 rounded-lg border border-gray-200 p-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={assignmentMode === 'EMPLOYEE'}
                onChange={() => {
                  setAssignmentMode('EMPLOYEE');
                  form.setValue('delegateDepartmentId', '', { shouldValidate: true });
                }}
                className="h-4 w-4 border-gray-300 text-green-600"
              />
              Assign Employee
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                checked={assignmentMode === 'DEPARTMENT'}
                onChange={() => {
                  setAssignmentMode('DEPARTMENT');
                  form.setValue('assignedToId', '');
                  form.setValue('assignedToIds', []);
                  form.setValue('assignAllEmployees', false);
                }}
                className="h-4 w-4 border-gray-300 text-green-600"
              />
              Delegate Department
            </label>
          </div>
        </div>
      )}

      {isEmployeeShared ? (
        <div>
          <label className="block text-sm font-medium text-gray-700">Department</label>
          <select
            value={selectedDepartmentId}
            onChange={(event) => {
              const departmentId = event.target.value;
              form.setValue('departmentId', departmentId, { shouldValidate: true });
              form.setValue('departmentIds', departmentId ? [departmentId] : [], { shouldValidate: true });
              form.setValue('assignedToId', '');
              form.setValue('assignedToIds', []);
              form.setValue('assignAllEmployees', false);
              setEmployeeSearch('');
            }}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">Select Department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          {form.formState.errors.departmentIds && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.departmentIds.message}</p>
          )}
        </div>
      ) : assignmentMode === 'EMPLOYEE' ? (
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
      ) : (
        <div className="grid gap-4">
          {departments.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Source Department</label>
              <select
                value={selectedDepartmentId}
                onChange={(event) => {
                  const departmentId = event.target.value;
                  form.setValue('departmentId', departmentId, { shouldValidate: true });
                  form.setValue('departmentIds', departmentId ? [departmentId] : [], { shouldValidate: true });
                }}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="">Select Source Department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Delegate Department</label>
            <select
              value={selectedDelegateDepartmentId}
              onChange={(event) => form.setValue('delegateDepartmentId', event.target.value, { shouldValidate: true })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Select Department</option>
              {delegationDepartments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            {selectedDelegateDepartment?.hod ? (
              <p className="mt-2 text-sm text-gray-600">HOD: {selectedDelegateDepartment.hod.fullName}</p>
            ) : null}
          </div>
        </div>
      )}

      {assignmentMode === 'EMPLOYEE' && (
      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Employees
            {isEmployeeShared && selectedAssigneeIds.length > 0 && (
              <span className="ml-2 text-xs font-normal text-green-700">
                {selectedAssigneeIds.length} Employee{selectedAssigneeIds.length !== 1 ? 's' : ''} Selected
              </span>
            )}
          </label>
          <div className="flex items-center gap-3">
            {isEmployeeShared && selectedAssigneeIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  form.setValue('assignedToIds', [], { shouldValidate: true });
                }}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Clear All
              </button>
            )}
            {isEmployeeShared && assignees.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  form.setValue('assignedToIds', assignees.map((a) => a.id), { shouldValidate: true });
                }}
                className="text-xs text-green-600 hover:text-green-800"
              >
                Select All
              </button>
            )}
            {!isEmployeeShared && (
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
            )}
          </div>
        </div>

        {isEmployeeShared && selectedAssigneeNames.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedAssigneeNames.map((assignee) => (
              <span
                key={assignee.id}
                className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
              >
                {assignee.fullName}
                <button
                  type="button"
                  onClick={() => {
                    form.setValue(
                      'assignedToIds',
                      selectedAssigneeIds.filter((id) => id !== assignee.id),
                      { shouldValidate: true },
                    );
                  }}
                  className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-green-600 hover:bg-green-200 hover:text-green-900"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}

        {isEmployeeShared && selectedDepartmentIds.length > 0 && assignees.length > 5 && (
          <div className="mt-2">
            <Input
              type="text"
              placeholder="Search employees..."
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              className="text-sm"
            />
          </div>
        )}

        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-gray-200 p-3">
          {!selectedDepartmentIds.length ? (
            <p className="text-sm text-gray-500">Select at least one department to load employees.</p>
          ) : (isEmployeeShared ? filteredAssignees : assignees).length ? (
            <div className="grid gap-2">
              {(isEmployeeShared ? filteredAssignees : assignees).map((assignee) => {
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
          ) : employeeSearch ? (
            <p className="text-sm text-gray-500">No employees matching &quot;{employeeSearch}&quot;.</p>
          ) : (
            <p className="text-sm text-gray-500">No active employees found for the selected department(s).</p>
          )}
        </div>
      </div>
      )}

      <div className="flex gap-4">
        <Button
          type="submit"
          disabled={createTaskMutation.isPending}
          className="bg-green-600 hover:bg-green-700"
        >
          {createTaskMutation.isPending
            ? 'Creating...'
            : isEmployeeShared && selectedAssigneeIds.length > 1
              ? `Create ${selectedAssigneeIds.length} Tasks`
              : 'Create Task'}
        </Button>
        <Button type="button" onClick={() => router.back()} variant="outline">
          Cancel
        </Button>
      </div>
    </form>
  );
}
