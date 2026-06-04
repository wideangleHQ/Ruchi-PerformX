import axiosClient from './client';
import { User } from './types';

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
  details: Record<string, any>;
}

export const adminApi = {
  // User Management
  getAllUsers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }) => {
    const response = await axiosClient.get<{
      data: User[];
      total: number;
      page: number;
      limit: number;
    }>('/admin/users', { params });
    return response.data;
  },

  getUserById: async (id: string): Promise<User> => {
    const response = await axiosClient.get<User>(`/admin/users/${id}`);
    return response.data;
  },

  createUser: async (data: {
    name: string;
    email: string;
    username: string;
    role: string;
    department?: string;
  }) => {
    const response = await axiosClient.post<User>('/admin/users', data);
    return response.data;
  },

  updateUser: async (id: string, data: Partial<User>) => {
    const response = await axiosClient.put<User>(`/admin/users/${id}`, data);
    return response.data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await axiosClient.delete(`/admin/users/${id}`);
  },

  // Audit Logs
  getAuditLogs: async (params?: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const response = await axiosClient.get<{
      data: AuditLog[];
      total: number;
      page: number;
      limit: number;
    }>('/admin/audit-logs', { params });
    return response.data;
  },

  getAuditLogById: async (id: string): Promise<AuditLog> => {
    const response = await axiosClient.get<AuditLog>(`/admin/audit-logs/${id}`);
    return response.data;
  },

  // System Health
  getSystemHealth: async () => {
    const response = await axiosClient.get('/admin/health');
    return response.data;
  },
};
