import axiosClient from './client';

export interface Request {
  id: string;
  title: string;
  description: string;
  type: 'LEAVE' | 'TRANSFER' | 'RESOURCE' | 'OTHER' | 'TASK_REASSIGNMENT';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  userId: string;
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  taskId?: string | null;
  taskDepartmentId?: string | null;
  currentAssigneeId?: string | null;
  requestedAssigneeId?: string | null;
  requestReason?: string | null;
  taskTitle?: string | null;
  taskDescription?: string | null;
  currentAssigneeName?: string | null;
  requestedAssigneeName?: string | null;
  requesterName?: string | null;
}

export const requestsApi = {
  getRequests: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    taskId?: string;
  }): Promise<Request[]> => {
    const response = await axiosClient.get<Request[] | { data?: Request[] }>('/requests', {
      params,
    });
    return Array.isArray(response.data) ? response.data : response.data.data ?? [];
  },

  getRequestById: async (id: string): Promise<Request> => {
    const response = await axiosClient.get<Request>(`/requests/${id}`);
    return response.data;
  },

  createRequest: async (data: {
    title: string;
    description: string;
    type: string;
  }): Promise<Request> => {
    const response = await axiosClient.post<Request>('/requests', data);
    return response.data;
  },

  createTaskReassignmentRequest: async (data: {
    taskId: string;
    currentAssigneeId: string;
    requestReason: string;
  }): Promise<Request> => {
    const response = await axiosClient.post<Request>('/requests', {
      type: 'TASK_REASSIGNMENT',
      taskId: data.taskId,
      currentAssigneeId: data.currentAssigneeId,
      requestReason: data.requestReason,
    });
    return response.data;
  },

  approveRequest: async (id: string, newAssigneeId?: string): Promise<Request> => {
    const response = await axiosClient.patch<Request>(`/requests/${id}/approve`, {
      newAssigneeId,
    });
    return response.data;
  },

  rejectRequest: async (id: string, reason?: string): Promise<Request> => {
    const response = await axiosClient.patch<Request>(`/requests/${id}/reject`, {
      rejectionReason: reason,
    });
    return response.data;
  },
};
