import axiosClient from './client';
import { User, PaginatedResponse } from './types';

export const usersApi = {
  getUsers: async (params?: {
    page?: number;
    limit?: number;
    role?: string;
    departmentId?: string;
  }): Promise<PaginatedResponse<User>> => {
    const response = await axiosClient.get<PaginatedResponse<User>>('/users', {
      params,
    });
    return response.data;
  },

  getUserById: async (id: string): Promise<User> => {
    const response = await axiosClient.get<User>(`/users/${id}`);
    return response.data;
  },

  updateUser: async (id: string, data: Partial<User>): Promise<User> => {
    const response = await axiosClient.put<User>(`/users/${id}`, data);
    return response.data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await axiosClient.delete(`/users/${id}`);
  },
};
