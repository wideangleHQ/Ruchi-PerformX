import axiosClient from './client';

export interface AnalyticsData {
  totalUsers: number;
  totalTasks: number;
  completionRate: number;
  departmentMetrics: Array<{
    departmentId: string;
    departmentName: string;
    taskCount: number;
    completionRate: number;
    averageScore: number;
  }>;
  topPerformers: Array<{
    userId: string;
    userName: string;
    score: number;
    completedTasks: number;
  }>;
  trends: Array<{
    date: string;
    completedTasks: number;
    totalTasks: number;
  }>;
}

export const analyticsApi = {
  getAnalytics: async (params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<AnalyticsData> => {
    const response = await axiosClient.get<AnalyticsData>('/analytics', {
      params,
    });
    return response.data;
  },

  getDepartmentAnalytics: async (departmentId: string): Promise<AnalyticsData> => {
    const response = await axiosClient.get<AnalyticsData>(
      `/analytics/departments/${departmentId}`
    );
    return response.data;
  },
};
