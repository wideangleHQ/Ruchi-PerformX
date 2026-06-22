import axiosClient from './client';
import { Task, Comment, PaginatedResponse, User } from './types';

export interface TaskDepartment {
  id: string;
  name: string;
  description?: string;
  is_active?: boolean;
}

export const tasksApi = {
  getTasks: async (filters?: {
    status?: string;
    priority?: string;
    title?: string;
    assigneeId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Task>> => {
    const response = await axiosClient.get<PaginatedResponse<Task>>('/tasks', { params: filters });
    return response.data;
  },

  getTaskById: async (id: string): Promise<Task> => {
    const response = await axiosClient.get<Task>(`/tasks/${id}`);
    return response.data;
  },

  getDepartments: async (): Promise<TaskDepartment[]> => {
    const response = await axiosClient.get<TaskDepartment[]>('/tasks/meta/departments');
    return response.data;
  },

  getAssignees: async (departmentIds: string[]): Promise<User[]> => {
    const response = await axiosClient.get<User[]>('/tasks/meta/assignees', {
      params: { departmentIds: departmentIds.join(',') },
    });
    return response.data;
  },

  createTask: async (data: {
    title: string;
    description: string;
    priority: string;
    dueDate: string;
    assignedToId?: string;
    departmentId?: string;
    departmentIds?: string[];
    attachments?: File[];
  }): Promise<Task> => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('priority', data.priority);
    formData.append('dueDate', data.dueDate);
    if (data.assignedToId) formData.append('assignedToId', data.assignedToId);
    if (data.departmentId) formData.append('departmentId', data.departmentId);
    if (data.departmentIds?.length) {
      data.departmentIds.forEach((departmentId) => formData.append('departmentIds', departmentId));
    }
    data.attachments?.forEach((file) => formData.append('attachments', file));
    const response = await axiosClient.post<Task>('/tasks', formData);
    return response.data;
  },

  updateTask: async (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      status: string;
      priority: string;
      dueDate: string;
    }>
  ): Promise<Task> => {
    const response = await axiosClient.patch<Task>(`/tasks/${id}`, data);
    return response.data;
  },

  deleteTask: async (id: string, reason: string): Promise<void> => {
    await axiosClient.delete(`/tasks/${id}`, { data: { reason } });
  },

  acceptTask: async (id: string): Promise<Task> => {
    const response = await axiosClient.patch<Task>(`/tasks/${id}/accept`);
    return response.data;
  },

  rejectTask: async (id: string, reason: string): Promise<Task> => {
    const response = await axiosClient.patch<Task>(`/tasks/${id}/reject`, { reason });
    return response.data;
  },

  markInProgress: async (id: string): Promise<Task> => {
    const response = await axiosClient.patch<Task>(`/tasks/${id}/progress`);
    return response.data;
  },

  completeTask: async (id: string): Promise<Task> => {
    const response = await axiosClient.patch<Task>(`/tasks/${id}/complete`);
    return response.data;
  },

  reviewTask: async (id: string): Promise<Task> => {
    const response = await axiosClient.patch<Task>(`/tasks/${id}/review`);
    return response.data;
  },

  closeTask: async (id: string): Promise<Task> => {
    const response = await axiosClient.patch<Task>(`/tasks/${id}/close`);
    return response.data;
  },

  // Comments
  getComments: async (taskId: string): Promise<Comment[]> => {
    const response = await axiosClient.get<Comment[]>(`/tasks/${taskId}/comments`);
    return response.data;
  },

  addComment: async (
    taskId: string,
    data: { content: string; attachments?: File[]; parentCommentId?: string | null },
  ): Promise<Comment> => {
    const formData = new FormData();
    formData.append('content', data.content);
    if (data.parentCommentId) formData.append('parentCommentId', data.parentCommentId);
    data.attachments?.forEach((file) => formData.append('attachments', file));
    const response = await axiosClient.post<Comment>(`/tasks/${taskId}/comments`, formData);
    return response.data;
  },
};
