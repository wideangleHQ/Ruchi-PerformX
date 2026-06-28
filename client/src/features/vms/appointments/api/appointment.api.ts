import axiosClient from '@/api/client';
import { 
  AppointmentResponse, 
  SearchAppointmentFilter, 
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
  PaginatedAppointmentResponse
} from '../types/appointment.types';

export const getAppointments = async (params: SearchAppointmentFilter): Promise<PaginatedAppointmentResponse> => {
  const { data } = await axiosClient.get<PaginatedAppointmentResponse>('/vms/appointments', { params });
  return data;
};

export const createAppointment = async (payload: CreateAppointmentRequest): Promise<AppointmentResponse> => {
  const { data } = await axiosClient.post<{ data: AppointmentResponse }>('/vms/appointments', payload);
  return data.data;
};

export const updateAppointment = async (id: string, payload: UpdateAppointmentRequest): Promise<AppointmentResponse> => {
  const { data } = await axiosClient.patch<{ data: AppointmentResponse }>(`/vms/appointments/${id}`, payload);
  return data.data;
};
