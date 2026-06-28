import axiosClient from '@/api/client';
import { VisitInsideResponse, VisitStatus } from '../types/check-out.types';

export const getVisitorsInside = async (): Promise<VisitInsideResponse[]> => {
  const { data } = await axiosClient.get<any>('/vms/visits', {
    params: { status: 'CHECKED_IN' } 
  });
  
  const rawData = data?.data || [];
  return rawData.map((v: any) => ({
    id: v.id,
    visitor: {
      id: v.visitor?.id || v.visitorId,
      fullName: v.visitor?.fullName || 'N/A',
    },
    employee: {
      id: v.hostEmployee?.id || v.hostEmployeeId,
      full_name: v.hostEmployee?.full_name || 'N/A',
    },
    purpose: v.purpose || 'N/A',
    checkInTime: v.checkInTime || v.scheduledAt || v.createdAt,
    status: v.status as VisitStatus,
  }));
};

export const checkOutVisitor = async (visitId: string): Promise<VisitInsideResponse> => {
  const { data } = await axiosClient.post<any>(`/vms/visits/${visitId}/check-out`, { visitId });
  return data;
};
