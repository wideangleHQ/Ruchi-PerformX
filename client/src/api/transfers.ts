import axiosClient from './client';
import { PaginatedResponse } from './types';

export interface Transfer {
  id: string;
  fromDepartmentId: string;
  toDepartmentId: string;
  userId: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  createdAt: Date;
  approvedAt?: Date;
}

export const transfersApi = {
  getTransfers: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<PaginatedResponse<Transfer>> => {
    const response = await axiosClient.get<PaginatedResponse<Transfer>>('/transfers', {
      params,
    });
    return response.data;
  },

  getTransferById: async (id: string): Promise<Transfer> => {
    const response = await axiosClient.get<Transfer>(`/transfers/${id}`);
    return response.data;
  },

  createTransfer: async (data: {
    fromDepartmentId: string;
    toDepartmentId: string;
    userId: string;
    reason: string;
  }): Promise<Transfer> => {
    const response = await axiosClient.post<Transfer>('/transfers', data);
    return response.data;
  },

  approveTransfer: async (id: string): Promise<Transfer> => {
    const response = await axiosClient.put<Transfer>(`/transfers/${id}/approve`);
    return response.data;
  },

  rejectTransfer: async (id: string, reason?: string): Promise<Transfer> => {
    const response = await axiosClient.put<Transfer>(`/transfers/${id}/reject`, {
      reason,
    });
    return response.data;
  },
};
