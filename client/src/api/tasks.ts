import axiosClient from './client';
import { Task, Comment, PaginatedResponse } from './types';

export const tasksApi = {
  getTasks: async (filters?: {
    status?: string;
    priority?: string;
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

  createTask: async (data: {
    title: string;
    description: string;
    priority: string;
    dueDate: string;
    assigneeId: string;
  }): Promise<Task> => {
    const response = await axiosClient.post<Task>('/tasks', data);
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
    const response = await axiosClient.put<Task>(`/tasks/${id}`, data);
    return response.data;
  },

  deleteTask: async (id: string): Promise<void> => {
    await axiosClient.delete(`/tasks/${id}`);
  },

  // Comments
  getComments: async (taskId: string): Promise<Comment[]> => {
    const response = await axiosClient.get<Comment[]>(`/tasks/${taskId}/comments`);
    return response.data;
  },

  addComment: async (taskId: string, content: string): Promise<Comment> => {
    const response = await axiosClient.post<Comment>(`/tasks/${taskId}/comments`, { content });
    return response.data;
  },
};
