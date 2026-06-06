import axiosClient from './client';
import { User, PaginatedResponse, Role } from './types';

export interface Department {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

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

  /** GET /users/assignable?departmentId=&role= */
  getAssignable: async (params?: {
    departmentId?: string;
    role?: Role;
  }): Promise<User[]> => {
    const response = await axiosClient.get<User[]>('/users/assignable', { params });
    return response.data;
  },

  /** GET /departments */
  getDepartments: async (): Promise<Department[]> => {
    const response = await axiosClient.get<Department[]>('/departments');
    return response.data;
  },
};
