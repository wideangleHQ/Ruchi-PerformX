import axiosClient from './client';
import { Notification, PaginatedResponse } from './types';

export const notificationsApi = {
  // The server reads `page` and `limit` only. There is no filter by read state
  // and no mark-all-read route; the bell is cleared one row at a time.
  getNotifications: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Notification>> => {
    const response = await axiosClient.get<PaginatedResponse<Notification>>('/notifications', {
      params,
    });
    return response.data;
  },

  getUnreadCount: async (): Promise<{ unreadCount: number }> => {
    const response = await axiosClient.get<{ unreadCount: number }>('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (id: string): Promise<Notification> => {
    const response = await axiosClient.patch<Notification>(`/notifications/${id}/read`);
    return response.data;
  },

  deleteNotification: async (id: string): Promise<void> => {
    await axiosClient.delete(`/notifications/${id}`);
  },
};
