import axiosClient from './client';
import type { Role } from './types';

export interface ProfileData {
  id: string;
  fullName: string;
  email: string;
  username: string;
  mobileNumber?: string | null;
  designation: Role;
  role: Role;
  departmentId?: string | null;
  departmentName?: string | null;
  createdAt?: string;
}

export interface UpdateProfilePayload {
  fullName?: string;
  username?: string;
  email?: string;
  mobileNumber?: string;
}

export const profileApi = {
  getProfile: async (): Promise<ProfileData> => {
    const response = await axiosClient.get<ProfileData>('/profile');
    return response.data;
  },

  updateProfile: async (data: UpdateProfilePayload): Promise<ProfileData> => {
    const response = await axiosClient.patch<ProfileData>('/profile', data);
    return response.data;
  },
};
