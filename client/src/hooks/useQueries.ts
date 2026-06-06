import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard';
import { tasksApi } from '@/api/tasks';
import { notificationsApi } from '@/api/notifications';
import { usersApi } from '@/api/users';
import { scoringApi } from '@/api/scoring';
import { requestsApi } from '@/api/requests';
import { transfersApi } from '@/api/transfers';
import { analyticsApi } from '@/api/analytics';
import { incentivesApi } from '@/api/incentives';

// Dashboard Queries
export const useDashboard = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getDashboard(),
  });
};

// Task Queries
export const useTasks = (filters?: {
  status?: string;
  priority?: string;
  title?: string;
  assigneeId?: string;
  page?: number;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => tasksApi.getTasks(filters),
  });
};

export const useTask = (id: string) => {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: () => tasksApi.getTaskById(id),
  });
};

export const useTaskComments = (taskId: string) => {
  return useQuery({
    queryKey: ['tasks', taskId, 'comments'],
    queryFn: () => tasksApi.getComments(taskId),
  });
};

// Notification Queries
export const useNotifications = (params?: {
  page?: number;
  limit?: number;
  read?: boolean;
}) => {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationsApi.getNotifications(params),
  });
};

// User Queries
export const useUsers = (params?: {
  page?: number;
  limit?: number;
  role?: string;
  departmentId?: string;
}) => {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => usersApi.getUsers(params),
  });
};

export const useUser = (id: string) => {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => usersApi.getUserById(id),
  });
};

// Scoring Queries
export const useScores = (params?: {
  month?: string;
  page?: number;
  limit?: number;
  departmentId?: string;
}) => {
  return useQuery({
    queryKey: ['scoring', params],
    queryFn: () => scoringApi.getAllScores(params),
  });
};

export const useUserScore = (userId: string, month?: string) => {
  return useQuery({
    queryKey: ['scoring', userId, month],
    queryFn: () => scoringApi.getUserScore(userId, month),
  });
};

// Request Queries
export const useRequests = (params?: {
  page?: number;
  limit?: number;
  status?: string;
}) => {
  return useQuery({
    queryKey: ['requests', params],
    queryFn: () => requestsApi.getRequests(params),
  });
};

export const useRequest = (id: string) => {
  return useQuery({
    queryKey: ['requests', id],
    queryFn: () => requestsApi.getRequestById(id),
  });
};

// Transfer Queries
export const useTransfers = (params?: {
  page?: number;
  limit?: number;
  status?: string;
}) => {
  return useQuery({
    queryKey: ['transfers', params],
    queryFn: () => transfersApi.getTransfers(params),
  });
};

export const useTransfer = (id: string) => {
  return useQuery({
    queryKey: ['transfers', id],
    queryFn: () => transfersApi.getTransferById(id),
  });
};

// Analytics Queries
export const useAnalytics = (params?: {
  startDate?: string;
  endDate?: string;
}) => {
  return useQuery({
    queryKey: ['analytics', params],
    queryFn: () => analyticsApi.getAnalytics(params),
  });
};

// Incentives Queries
export const useIncentives = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  month?: string;
}) => {
  return useQuery({
    queryKey: ['incentives', params],
    queryFn: () => incentivesApi.getIncentives(params),
  });
};

export const useIncentive = (id: string) => {
  return useQuery({
    queryKey: ['incentives', id],
    queryFn: () => incentivesApi.getIncentiveById(id),
  });
};
