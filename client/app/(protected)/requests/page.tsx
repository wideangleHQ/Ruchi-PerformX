'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/api/auth';
import { requestsApi, type Request } from '@/api/requests';
import { tasksApi } from '@/api/tasks';
import { useRequests } from '@/hooks/useQueries';
import { prepareAttachmentFiles } from '@/lib/attachmentUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const GENERAL_REQUEST_TYPES = [
  'BUDGET_APPROVAL',
  'TRANSPORT_SUPPORT',
  'CROSS_DEPT_ASSISTANCE',
  'RESOURCE_REQUEST',
  'OTHER',
] as const;

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export default function RequestsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data = [] } = useRequests();
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [form, setForm] = useState({
    type: 'BUDGET_APPROVAL',
    title: '',
    description: '',
    requestReason: '',
    priority: 'MEDIUM',
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isEmployee = user?.role === 'EMPLOYEE';
  const canReview = Boolean(user && user.role !== 'EMPLOYEE');

  const { data: departments = [] } = useQuery({
    queryKey: ['request-departments'],
    queryFn: () => authApi.getDepartments(),
    enabled: Boolean(user),
  });

  const currentDepartment = useMemo(
    () => departments.find((department) => department.id === user?.departmentId) ?? null,
    [departments, user?.departmentId],
  );
  const departmentNames = useMemo(
    () => new Map(departments.map((department) => [department.id, department.name])),
    [departments],
  );

  const pendingRequests = useMemo(
    () => data.filter((request) => request.status === 'PENDING'),
    [data],
  );
  const reviewedRequests = useMemo(
    () => data.filter((request) => request.status !== 'PENDING'),
    [data],
  );
  const reassignmentRequests = useMemo(
    () => data.filter((request) => request.type === 'TASK_REASSIGNMENT'),
    [data],
  );
  const generalRequests = useMemo(
    () => data.filter((request) => request.type !== 'TASK_REASSIGNMENT'),
    [data],
  );
  const activeRequest = useMemo(
    () => data.find((request) => request.id === activeRequestId) ?? null,
    [data, activeRequestId],
  );

  const { data: employees = [] } = useQuery({
    queryKey: ['requests', activeRequest?.taskDepartmentId || activeRequest?.departmentId, 'employees'],
    queryFn: () =>
      tasksApi.getAssignees(
        activeRequest?.taskDepartmentId
          ? [activeRequest.taskDepartmentId]
          : activeRequest?.departmentId
            ? [activeRequest.departmentId]
            : [],
      ),
    enabled: Boolean(activeRequest?.taskDepartmentId || activeRequest?.departmentId),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const preparedAttachments = await prepareAttachmentFiles(attachments);
      return requestsApi.createRequest({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        requestReason: form.requestReason.trim() || undefined,
        departmentId: user?.departmentId ?? '',
        attachments: preparedAttachments,
      });
    },
    onSuccess: async () => {
      setError(null);
      setForm({
        type: 'BUDGET_APPROVAL',
        title: '',
        description: '',
        requestReason: '',
        priority: 'MEDIUM',
      });
      setAttachments([]);
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to submit request');
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => requestsApi.approveRequest(id),
    onSuccess: async () => {
      setActiveRequestId(null);
      setNewAssigneeId('');
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const reassignmentApproveMutation = useMutation({
    mutationFn: ({ id, newAssigneeId }: { id: string; newAssigneeId: string }) =>
      requestsApi.approveRequest(id, newAssigneeId),
    onSuccess: async () => {
      setActiveRequestId(null);
      setNewAssigneeId('');
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => requestsApi.rejectRequest(id, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });

  const selectableEmployees = employees.filter((item) => item.id !== activeRequest?.currentAssigneeId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Requests</h1>
        <p className="mt-2 text-gray-600">Task requests and reassignment approvals</p>
      </div>

      {isEmployee ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Create Task Request</h2>
          <p className="mt-1 text-sm text-gray-500">Use this form for approvals, support, and department requests.</p>

          {error ? <div className="mt-4 rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Request Type</label>
              <select
                value={form.type}
                onChange={(event) => setForm((value) => ({ ...value, type: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {GENERAL_REQUEST_TYPES.map((type) => (
                  <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Priority</label>
              <select
                value={form.priority}
                onChange={(event) => setForm((value) => ({ ...value, priority: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">Department</label>
            <Input
              value={currentDepartment?.name ?? user?.departmentId ?? ''}
              disabled
              className="mt-1 bg-gray-50"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <Input
              value={form.title}
              onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))}
              className="mt-1"
              placeholder="Enter request title"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">Request Reason</label>
            <textarea
              value={form.requestReason}
              onChange={(event) => setForm((value) => ({ ...value, requestReason: event.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">Attachments</label>
            <Input
              type="file"
              multiple
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

          <div className="mt-6 flex gap-2">
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={createMutation.isPending || !form.title.trim() || !form.description.trim() || !user?.departmentId}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Pending Approvals: <span className="font-semibold">{pendingRequests.length}</span>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
          Reassignment Requests: <span className="font-semibold">{reassignmentRequests.length}</span>
        </div>
      </div>

      {generalRequests.length ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Task Requests</h2>
          {generalRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              departmentName={departmentNames.get(request.departmentId ?? request.taskDepartmentId ?? '')}
              canReview={canReview}
              onApprove={() => approveMutation.mutate(request.id)}
              onReject={() => {
                const reason = window.prompt('Reject reason');
                if (reason === null) return;
                rejectMutation.mutate({ id: request.id, reason: reason || undefined });
              }}
              busy={approveMutation.isPending || rejectMutation.isPending}
            />
          ))}
        </section>
      ) : null}

      {reassignmentRequests.length ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Reassignment Requests</h2>
          {reassignmentRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              departmentName={departmentNames.get(request.departmentId ?? request.taskDepartmentId ?? '')}
              canReview={canReview}
              onApprove={() => {
                setNewAssigneeId('');
                setActiveRequestId(request.id);
              }}
              onReject={() => {
                const reason = window.prompt('Reject reason');
                if (reason === null) return;
                rejectMutation.mutate({ id: request.id, reason: reason || undefined });
              }}
              busy={reassignmentApproveMutation.isPending || rejectMutation.isPending}
            />
          ))}
        </section>
      ) : null}

      {!data.length ? (
        <div className="rounded-lg bg-gray-50 p-8 text-center text-gray-600">
          No requests found.
        </div>
      ) : null}

      {activeRequest && canReview && activeRequest.type === 'TASK_REASSIGNMENT' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900">Approve Reassignment</h2>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Task Name</p>
                <p className="mt-1 text-gray-900">{activeRequest.taskTitle ?? activeRequest.title}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Current Assignee</p>
                <p className="mt-1 text-gray-900">{activeRequest.currentAssigneeName ?? '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Department Employees</p>
                <select
                  value={newAssigneeId}
                  onChange={(event) => setNewAssigneeId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select employee</option>
                  {selectableEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setActiveRequestId(null); setNewAssigneeId(''); }}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                disabled={!newAssigneeId || reassignmentApproveMutation.isPending}
                onClick={() => reassignmentApproveMutation.mutate({ id: activeRequest.id, newAssigneeId })}
              >
                Approve
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RequestCard({
  request,
  departmentName,
  canReview,
  onApprove,
  onReject,
  busy,
}: {
  request: Request;
  departmentName?: string;
  canReview: boolean;
  onApprove: () => void;
  onReject: () => void;
  busy?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-green-700">{request.title}</div>
          <div className="text-xs text-gray-500">
            {request.type?.replace(/_/g, ' ')} {request.priority ? ` | ${request.priority}` : ''}
          </div>
          <div className="text-sm text-gray-700">
            <span className="font-medium">Description:</span> {request.description}
          </div>
          <div className="text-sm text-gray-700">
            <span className="font-medium">Department:</span> {departmentName ?? request.departmentId ?? request.taskDepartmentId ?? '-'}
          </div>
          <div className="text-sm text-gray-700">
            <span className="font-medium">Requester:</span> {request.requesterName ?? '-'}
          </div>
          {request.requestAttachments?.length ? (
            <div className="space-y-1 text-sm text-gray-700">
              <div className="font-medium">Attachments</div>
              <div className="space-y-1">
                {request.requestAttachments.map((file) => (
                  <a key={file.id} href={file.file_url} target="_blank" rel="noreferrer" className="block text-green-700 hover:underline">
                    {file.file_name}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
          <div className="text-xs text-gray-500">
            {new Date(request.createdAt).toLocaleString()}
          </div>
        </div>
        {canReview && request.status === 'PENDING' ? (
          <div className="flex gap-2">
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={busy}
              onClick={onApprove}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={onReject}
            >
              Reject
            </Button>
          </div>
        ) : (
          <div className="text-sm font-medium text-gray-500">{request.status}</div>
        )}
      </div>
    </div>
  );
}
