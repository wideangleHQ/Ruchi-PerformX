import axiosClient from '@/api/client';
import { CreateVisitRequest, CheckInRequest, Visit } from '../types/visit.types';

export const createVisit = async (payload: CreateVisitRequest): Promise<Visit> => {
  const { data } = await axiosClient.post<any>('/vms/visits', payload);
  return data;
};

export const checkIn = async (payload: CheckInRequest): Promise<Visit> => {
  const { data } = await axiosClient.post<any>(`/vms/visits/${payload.visitId}/check-in`, payload);
  return data;
};

export const getEmployees = async () => {
  // Pass a large limit to fetch all active employees in one request.
  // The existing EmployeeController at /vms/visits/employees handles VMS JWT auth correctly.
  const { data } = await axiosClient.get('/vms/visits/employees', { params: { limit: 1000 } });
  // The endpoint returns a paginated shape: { data: [], meta: {} }
  return data?.data ?? data;
};
