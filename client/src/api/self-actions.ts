import axiosClient from './client';
import { PaginatedResponse } from './types';

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
  }): Promise<SelfAction> => {
    const response = await axiosClient.post<SelfAction>('/self-actions', data);
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
};
