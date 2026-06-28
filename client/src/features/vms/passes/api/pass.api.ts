import axiosClient from '@/api/client';
import { 
  PassResponse, 
  SearchPassFilter, 
  GeneratePassRequest,
  ReprintPassRequest,
  PaginatedPassResponse
} from '../types/pass.types';

export const getPermissionSlips = async (params: SearchPassFilter): Promise<PaginatedPassResponse> => {
  const { data } = await axiosClient.get('/vms/visits', { params });
  
  const mappedData = data.data.map((visit: any) => {
    const visitor = visit.visitor || {};
    const profileImage = visitor.images && visitor.images.length > 0
      ? visitor.images[0].fileUrl
      : null;

    return {
      passNumber: visit.visitCode,
      visitId: visit.id,
      visitor: {
        ...visitor,
        profileImage,
      },
      employee: visit.hostEmployee,
      status: visit.status,
      purpose: visit.purpose,
      checkInTime: visit.checkInTime,
      checkOutTime: visit.checkOutTime,
      printCopies: visit.printCopies || 0,
    };
  });

  return {
    data: mappedData,
    meta: data.meta
  } as unknown as PaginatedPassResponse;
};

export const generatePermissionSlip = async (payload: GeneratePassRequest): Promise<PassResponse> => {
  const { data } = await axiosClient.post<{ data: PassResponse }>('/vms/passes/generate', payload);
  return data.data;
};

export const reprintPermissionSlip = async (passNumber: string, payload: ReprintPassRequest): Promise<PassResponse> => {
  const { data } = await axiosClient.post<{ data: PassResponse }>(`/vms/passes/${passNumber}/reprint`, payload);
  return data.data;
};
