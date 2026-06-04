import axiosClient from './client';
import { Notification, PaginatedResponse } from './types';

export const notificationsApi = {
  getNotifications: async (params?: {
    page?: number;
    limit?: number;
    read?: boolean;
  }): Promise<PaginatedResponse<Notification>> => {
    const response = await axiosClient.get<PaginatedResponse<Notification>>('/notifications', {
      params,
    });
    return response.data;
  },

  markAsRead: async (id: string): Promise<Notification> => {
    const response = await axiosClient.put<Notification>(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async (): Promise<void> => {
    await axiosClient.put('/notifications/mark-all-read');
  },

  deleteNotification: async (id: string): Promise<void> => {
    await axiosClient.delete(`/notifications/${id}`);
  },
};
