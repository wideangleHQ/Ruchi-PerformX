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

/**
 * Approve, reject and convert. These are the real endpoints. The screen used to
 * PATCH `{ status }` at `/vms/requests/:id`, whose DTO is a partial of the
 * create DTO and declares no `status`, so `forbidNonWhitelisted` turned every
 * decision into a 400 that the dialog logged and swallowed.
 */
export const approveRequest = async (id: string): Promise<VisitorRequestResponse> => {
  const { data } = await axiosClient.post<{ data: VisitorRequestResponse }>(
    `/vms/requests/${id}/approve`,
  );
  return data.data;
};

export const rejectRequest = async (
  id: string,
  reason?: string,
): Promise<VisitorRequestResponse> => {
  const { data } = await axiosClient.post<{ data: VisitorRequestResponse }>(
    `/vms/requests/${id}/reject`,
    reason ? { reason } : {},
  );
  return data.data;
};

/** Turns an approved request into a visit. Nothing called this before. */
export const createVisitFromRequest = async (id: string): Promise<{ id: string }> => {
  const { data } = await axiosClient.post<{ data: { id: string } }>(
    `/vms/requests/${id}/create-visit`,
  );
  return data.data;
};
