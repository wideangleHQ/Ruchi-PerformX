import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard';
import { tasksApi } from '@/api/tasks';
import { notificationsApi } from '@/api/notifications';
import { usersApi } from '@/api/users';
import { requestsApi } from '@/api/requests';
import { transfersApi } from '@/api/transfers';
import { incentivesApi } from '@/api/incentives';
import { hodScoreApi, HodScorePeriod } from '@/api/hod-score';

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
  taskType?: string;
}) => {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => {
      if (filters?.taskType === 'EMPLOYEE_SHARED') {
        return tasksApi.employeeSharing.getTasks(filters);
      }
      return tasksApi.getTasks(filters);
    },
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
// Employee score hooks live in useAnalytics.ts, next to the screens that read
// them. What was here called /scoring and /scoring/:id, neither of which the
// API has ever served.
export const useHodScore = (period?: HodScorePeriod, enabled = true) => {
  return useQuery({
    queryKey: ['hod-score', 'me', period],
    queryFn: () => hodScoreApi.getMyScore(period),
    enabled,
  });
};

export const useCompanyHodScores = (period?: HodScorePeriod, enabled = true) => {
  return useQuery({
    queryKey: ['hod-score', 'company', period],
    queryFn: () => hodScoreApi.getCompanyScores(period),
    enabled,
  });
};

export const useHodScoreTrends = (
  params?: HodScorePeriod & { hodId?: string; departmentId?: string; months?: number },
  enabled = true,
) => {
  return useQuery({
    queryKey: ['hod-score', 'trends', params],
    queryFn: () => hodScoreApi.getTrends(params),
    enabled,
  });
};

// Request Queries
export const useRequests = (params?: {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  taskId?: string;
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
