import axiosClient from './client';
import { Attachment, PaginatedResponse, User } from './types';

export type SelfActionStatus = 'OPEN' | 'ONGOING' | 'COMPLETED' | 'ABORTED';
export type SelfActionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SelfActionAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type?: string | null;
  file_size_kb?: number | null;
}

export interface SelfAction {
  id: string;
  title: string;
  description: string;
  priority: SelfActionPriority;
  status: SelfActionStatus;
  created_by_id: string;
  department_id: string;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  users?: {
    id: string;
    full_name: string;
    role: string;
    department_id?: string | null;
  };
  departments?: {
    id: string;
    name: string;
  };
  task_attachments?: SelfActionAttachment[];
}

export interface SelfActionComment {
  id: string;
  selfActionId: string;
  userId: string;
  parentCommentId?: string | null;
  content: string;
  isTagged: boolean;
  createdAt: string;
  updatedAt?: string;
  user?: User;
  attachments?: Attachment[];
  replies?: SelfActionComment[];
}

export interface SelfActionFilters {
  search?: string;
  status?: SelfActionStatus;
  priority?: SelfActionPriority;
  departmentId?: string;
  createdById?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

function appendAttachments(formData: FormData, attachments?: File[]) {
  attachments?.forEach((file) => {
    formData.append('attachments', file, file.name);
  });
}

export const selfActionsApi = {
  getSelfActions: async (
    filters?: SelfActionFilters,
  ): Promise<PaginatedResponse<SelfAction>> => {
    const response = await axiosClient.get<PaginatedResponse<SelfAction>>('/self-actions', {
      params: filters,
    });
    return response.data;
  },

  getSelfActionById: async (id: string): Promise<SelfAction> => {
    const response = await axiosClient.get<SelfAction>(`/self-actions/${id}`);
    return response.data;
  },

  createSelfAction: async (data: {
    title: string;
    description: string;
    priority?: SelfActionPriority;
    attachments?: File[];
    department_ids?: string[];
  }): Promise<SelfAction> => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    if (data.priority) formData.append('priority', data.priority);
    if (data.department_ids?.length) {
      data.department_ids.forEach((id) => formData.append('department_ids[]', id));
    }
    appendAttachments(formData, data.attachments);
    const response = await axiosClient.post<SelfAction>('/self-actions', formData);
    return response.data;
  },

  updateSelfAction: async (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      priority: SelfActionPriority;
    }>,
  ): Promise<SelfAction> => {
    const response = await axiosClient.patch<SelfAction>(`/self-actions/${id}`, data);
    return response.data;
  },

  changeSelfActionStatus: async (id: string, status: SelfActionStatus): Promise<SelfAction> => {
    const response = await axiosClient.patch<SelfAction>(`/self-actions/${id}/status`, {
      status,
    });
    return response.data;
  },

  deleteSelfAction: async (id: string): Promise<void> => {
    await axiosClient.delete(`/self-actions/${id}`);
  },

  getComments: async (id: string): Promise<SelfActionComment[]> => {
    const response = await axiosClient.get<SelfActionComment[]>(`/self-actions/${id}/comments`);
    return response.data;
  },

  addComment: async (
    id: string,
    data: { content: string; attachments?: File[]; parentCommentId?: string | null },
  ): Promise<SelfActionComment> => {
    const formData = new FormData();
    formData.append('content', data.content);
    if (data.parentCommentId) formData.append('parentCommentId', data.parentCommentId);
    appendAttachments(formData, data.attachments);
    const response = await axiosClient.post<SelfActionComment>(`/self-actions/${id}/comments`, formData);
    return response.data;
  },
};