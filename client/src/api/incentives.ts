import axiosClient from './client';
import { PaginatedResponse } from './types';

export interface Incentive {
  id: string;
  userId: string;
  title: string;
  description: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'PAID';
  month: string;
  createdAt: Date;
  approvedAt?: Date;
}

export const incentivesApi = {
  getIncentives: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    month?: string;
  }): Promise<PaginatedResponse<Incentive>> => {
    const response = await axiosClient.get<PaginatedResponse<Incentive>>(
      '/incentives',
      { params }
    );
    return response.data;
  },

  getIncentiveById: async (id: string): Promise<Incentive> => {
    const response = await axiosClient.get<Incentive>(`/incentives/${id}`);
    return response.data;
  },

  createIncentive: async (data: {
    userId: string;
    title: string;
    description: string;
    amount: number;
  }): Promise<Incentive> => {
    const response = await axiosClient.post<Incentive>('/incentives', data);
    return response.data;
  },

  approveIncentive: async (id: string): Promise<Incentive> => {
    const response = await axiosClient.put<Incentive>(
      `/incentives/${id}/approve`
    );
    return response.data;
  },

  rejectIncentive: async (id: string): Promise<Incentive> => {
    const response = await axiosClient.put<Incentive>(
      `/incentives/${id}/reject`
    );
    return response.data;
  },
};
