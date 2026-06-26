import axiosClient from './client';

export interface Request {
  id: string;
  title: string;
  description: string;
  type: 'BUDGET_APPROVAL' | 'TRANSPORT_SUPPORT' | 'CROSS_DEPT_ASSISTANCE' | 'RESOURCE_REQUEST' | 'OTHER' | 'TASK_REASSIGNMENT';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  userId: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  departmentId?: string | null;
  taskId?: string | null;
  generatedTaskId?: string | null;
  taskDepartmentId?: string | null;
  currentAssigneeId?: string | null;
  requestedAssigneeId?: string | null;
  requestReason?: string | null;
  taskTitle?: string | null;
  taskDescription?: string | null;
  currentAssigneeName?: string | null;
  requestedAssigneeName?: string | null;
  requesterName?: string | null;
  requesterDepartmentId?: string | null;
  requestAttachments?: Array<{
    id: string;
    file_name: string;
    file_url: string;
    file_type?: string | null;
    file_size_kb?: number | null;
    created_at?: string;
  }>;
}

function appendRequestFormData(
  data: {
    title?: string;
    description?: string;
    type: string;
    departmentId?: string;
    priority?: string;
    taskId?: string;
    currentAssigneeId?: string;
    requestedAssigneeId?: string;
    requestReason?: string;
  },
  attachments?: File[],
) {
  const formData = new FormData();
  formData.append('type', data.type);
  if (data.title) formData.append('title', data.title);
  if (data.description) formData.append('description', data.description);
  if (data.departmentId) formData.append('departmentId', data.departmentId);
  if (data.priority) formData.append('priority', data.priority);
  if (data.taskId) formData.append('taskId', data.taskId);
  if (data.currentAssigneeId) formData.append('currentAssigneeId', data.currentAssigneeId);
  if (data.requestedAssigneeId) formData.append('requestedAssigneeId', data.requestedAssigneeId);
  if (data.requestReason) formData.append('requestReason', data.requestReason);
  attachments?.forEach((file) => formData.append('attachments', file, file.name));
  return formData;
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
    departmentId: string;
    priority: string;
    requestReason?: string;
    attachments?: File[];
  }): Promise<Request> => {
    const response = await axiosClient.post<Request>('/requests', appendRequestFormData(data, data.attachments));
    return response.data;
  },

  createTaskReassignmentRequest: async (data: {
    taskId: string;
    currentAssigneeId: string;
    requestReason: string;
  }): Promise<Request> => {
    const response = await axiosClient.post<Request>('/requests', appendRequestFormData({
      type: 'TASK_REASSIGNMENT',
      taskId: data.taskId,
      currentAssigneeId: data.currentAssigneeId,
      requestReason: data.requestReason,
    }));
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
