import axiosClient from '@/api/client';
import { VisitorRequestPayload, VisitorRequestResponse } from '../types/employee-request.types';

export const createEmployeeVisitorRequest = async (payload: VisitorRequestPayload): Promise<VisitorRequestResponse> => {
  const { data } = await axiosClient.post<{ data: VisitorRequestResponse }>('/vms/requests', payload);
  return data.data;
};
