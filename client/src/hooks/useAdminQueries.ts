import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';

export const useAllUsers = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}) => {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => adminApi.getAllUsers(params),
  });
};

export const useUser = (id: string) => {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => adminApi.getUserById(id),
  });
};

export const useAuditLogs = (params?: {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}) => {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => adminApi.getAuditLogs(params),
  });
};

export const useSystemHealth = () => {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: () => adminApi.getSystemHealth(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};
