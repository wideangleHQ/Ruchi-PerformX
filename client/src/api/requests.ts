import axiosClient from './client';
import { PaginatedResponse } from './types';

export interface Request {
  id: string;
  title: string;
  description: string;
  type: 'LEAVE' | 'TRANSFER' | 'RESOURCE' | 'OTHER';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  userId: string;
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const requestsApi = {
  getRequests: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<PaginatedResponse<Request>> => {
    const response = await axiosClient.get<PaginatedResponse<Request>>('/requests', {
      params,
    });
    return response.data;
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

  approveRequest: async (id: string): Promise<Request> => {
    const response = await axiosClient.put<Request>(`/requests/${id}/approve`);
    return response.data;
  },

  rejectRequest: async (id: string, reason?: string): Promise<Request> => {
    const response = await axiosClient.put<Request>(`/requests/${id}/reject`, {
      reason,
    });
    return response.data;
  },
};
