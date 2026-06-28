import axiosClient from '@/api/client';
import { VMSSettings } from '../types/settings.types';

export const getSettings = async (): Promise<VMSSettings> => {
  const { data } = await axiosClient.get<{ data: VMSSettings }>('/vms/settings');
  return data.data;
};

export const updateSettings = async (payload: Partial<VMSSettings>): Promise<VMSSettings> => {
  const { data } = await axiosClient.put<{ data: VMSSettings }>('/vms/settings', payload);
  return data.data;
};
