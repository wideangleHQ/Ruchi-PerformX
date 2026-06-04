import axiosClient from './client';
import { Score, PaginatedResponse } from './types';

export const scoringApi = {
  getAllScores: async (params?: {
    month?: string;
    page?: number;
    limit?: number;
    departmentId?: string;
  }): Promise<PaginatedResponse<Score>> => {
    const response = await axiosClient.get<PaginatedResponse<Score>>('/scoring', {
      params,
    });
    return response.data;
  },

  getUserScore: async (userId: string, month?: string): Promise<Score> => {
    const response = await axiosClient.get<Score>(`/scoring/${userId}`, {
      params: { month },
    });
    return response.data;
  },
};
