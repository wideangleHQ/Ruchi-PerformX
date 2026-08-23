import axiosClient from './client';
import { User, Role } from './types';

export interface Department {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export const usersApi = {
  /**
   * The whole directory as a bare array. `GET /users` is not paginated and
   * reads no filter but `active`, so page, limit, role and department are not
   * accepted here rather than sent and silently ignored.
   */
  getUsers: async (params?: { active?: boolean }): Promise<User[]> => {
    const response = await axiosClient.get<User[]>('/users', { params });
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
