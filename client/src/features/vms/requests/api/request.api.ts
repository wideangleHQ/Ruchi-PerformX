import axiosClient from '@/api/client';
import { 
  VisitorRequestResponse, 
  VisitorRequestFilter, 
  UpdateVisitorRequest,
  PaginatedRequestResponse
} from '../types/request.types';

export const getRequests = async (params: VisitorRequestFilter): Promise<PaginatedRequestResponse> => {
  const { data } = await axiosClient.get<PaginatedRequestResponse>('/vms/requests', { params });
  return data;
};

export const updateRequest = async (id: string, payload: UpdateVisitorRequest): Promise<VisitorRequestResponse> => {
  const { data } = await axiosClient.patch<{ data: VisitorRequestResponse }>(`/vms/requests/${id}`, payload);
  return data.data;
};
