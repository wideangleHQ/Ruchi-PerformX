import axiosClient from './client';
import { DashboardData } from './types';

export const dashboardApi = {
  getDashboard: async (): Promise<DashboardData> => {
    const response = await axiosClient.get<DashboardData>('/dashboard');
    return response.data;
  },
};
