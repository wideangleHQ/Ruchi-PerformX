'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { requestsApi } from '@/api/requests';
import { tasksApi } from '@/api/tasks';
import { useRequests } from '@/hooks/useQueries';
import { Button } from '@/components/ui/button';

export default function RequestsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useRequests({ type: 'TASK_REASSIGNMENT' });
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [newAssigneeId, setNewAssigneeId] = useState('');

  const requests = data ?? [];
  const pendingRequests = useMemo(() => requests.filter((request) => request.status === 'PENDING'), [requests]);
  const reviewedRequests = useMemo(() => requests.filter((request) => request.status !== 'PENDING'), [requests]);
  const activeRequest = useMemo(
    () => requests.find((request) => request.id === activeRequestId) ?? null,
    [requests, activeRequestId],
  );

  const { data: employees = [] } = useQuery({
    queryKey: ['requests', activeRequest?.taskDepartmentId, 'employees'],
    queryFn: () => tasksApi.getAssignees(activeRequest?.taskDepartmentId ? [activeRequest.taskDepartmentId] : []),
    enabled: Boolean(activeRequest?.taskDepartmentId),
  });

  const approveMutation = useMutation({
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

  const canReview = user?.role === 'MD' || user?.role === 'HOD';
  const selectableEmployees = employees.filter((item) => item.id !== activeRequest?.currentAssigneeId);

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">Requests</h1>
      <p className="mt-2 text-gray-600">Task reassignment requests</p>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Pending Approvals: <span className="font-semibold">{pendingRequests.length}</span>
      </div>

      {pendingRequests.length ? (
        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Pending Approvals</h2>
          {pendingRequests.map((request) => (
            <div key={request.id} className="rounded-lg border border-amber-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-green-700">{request.taskTitle ?? request.title}</div>
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">Task Description:</span> {request.taskDescription ?? request.description}
                  </div>
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">Current Assignee:</span> {request.currentAssigneeName ?? '-'}
                  </div>
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">Request Reason:</span> {request.requestReason ?? '-'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(request.createdAt).toLocaleString()}
                  </div>
                </div>
                {canReview ? (
                  <div className="flex gap-2">
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      disabled={approveMutation.isPending}
                      onClick={() => {
                        setNewAssigneeId('');
                        setActiveRequestId(request.id);
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      disabled={rejectMutation.isPending}
                      onClick={() => {
                        const reason = window.prompt('Reject reason');
                        if (reason === null) return;
                        rejectMutation.mutate({ id: request.id, reason: reason || undefined });
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm font-medium text-gray-500">{request.status}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">All Requests</h2>
        {reviewedRequests.length ? (
          reviewedRequests.map((request) => (
            <div key={request.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-green-700">{request.taskTitle ?? request.title}</div>
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">Task Description:</span> {request.taskDescription ?? request.description}
                  </div>
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">Current Assignee:</span> {request.currentAssigneeName ?? '-'}
                  </div>
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">Request Reason:</span> {request.requestReason ?? '-'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(request.createdAt).toLocaleString()}
                  </div>
                </div>
                {canReview && request.status === 'PENDING' ? (
                  <div className="flex gap-2">
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      disabled={approveMutation.isPending}
                      onClick={() => {
                        setNewAssigneeId('');
                        setActiveRequestId(request.id);
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      disabled={rejectMutation.isPending}
                      onClick={() => {
                        const reason = window.prompt('Reject reason');
                        if (reason === null) return;
                        rejectMutation.mutate({ id: request.id, reason: reason || undefined });
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm font-medium text-gray-500">{request.status}</div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg bg-gray-50 p-8 text-center text-gray-600">
            {requests.length ? 'No reviewed requests.' : 'No task reassignment requests.'}
          </div>
        )}
      </div>

      {activeRequest && canReview ? (
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
                disabled={!newAssigneeId || approveMutation.isPending}
                onClick={() => approveMutation.mutate({ id: activeRequest.id, newAssigneeId })}
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
