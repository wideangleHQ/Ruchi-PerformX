import axiosClient from './client';
import { User, Role } from './types';

export interface Department {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

/**
 * What `PATCH /users/:id` accepts, which is not `Partial<User>`. A `User` is
 * the response shape and carries `id`, `username`, `email`, `status` and two
 * department display strings that the DTO rejects outright, so sending one back
 * is a 400 under `forbidNonWhitelisted`.
 */
export interface UpdateUserPayload {
  fullName?: string;
  role?: Role;
  departmentId?: string | null;
  departmentIds?: string[];
  isActive?: boolean;
  canAccessCareerHR?: boolean;
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

  updateUser: async (id: string, data: UpdateUserPayload): Promise<User> => {
    const response = await axiosClient.patch<User>(`/users/${id}`, data);
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

  /**
   * The approval queue. Registration lands as `pending_approval`, so a new
   * account cannot log in until one of these two calls resolves it. Scoped to a
   * HOD's own departments server side; MD, EA and PA see everything.
   */
  getPendingUsers: async (): Promise<User[]> => {
    const response = await axiosClient.get<User[]>('/users/pending');
    return response.data;
  },

  approveUser: async (id: string): Promise<{ message: string }> => {
    const response = await axiosClient.patch<{ message: string }>(`/users/${id}/approve`);
    return response.data;
  },

  rejectUser: async (id: string): Promise<{ message: string }> => {
    const response = await axiosClient.patch<{ message: string }>(`/users/${id}/reject`);
    return response.data;
  },

  /** GET /departments */
  getDepartments: async (): Promise<Department[]> => {
    const response = await axiosClient.get<Department[]>('/departments');
    return response.data;
  },
};
