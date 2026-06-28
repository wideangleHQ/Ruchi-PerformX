import axiosClient from '@/api/client';
import { ApiResponse, DashboardData } from '../types/dashboard.types';

export const getDashboardSummary = async (): Promise<DashboardData> => {
  const { data } = await axiosClient.get<ApiResponse<DashboardData>>('/vms/dashboard');
  return data.data;
};
