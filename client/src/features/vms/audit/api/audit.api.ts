import axiosClient from '@/api/client';
import { AuditFilter, PaginatedAuditResponse } from '../types/audit.types';

export const getAuditLogs = async (params: AuditFilter): Promise<PaginatedAuditResponse> => {
  const { data } = await axiosClient.get<PaginatedAuditResponse>('/vms/audit', { params });
  return data;
};
