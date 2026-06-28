import axiosClient from '@/api/client';
import { 
  Visitor, 
  CreateVisitorRequest, 
  VisitorSearchRequest, 
  PaginatedVisitorResponse,
  VisitHistoryRecord
} from '../types/visitor.types';

/**
 * The backend controller returns raw Prisma records (not class-transformer DTOs),
 * so the @Transform decorator that maps images[0].fileUrl → profileImage never executes.
 * This helper derives profileImage from the images array present in the raw response.
 */
function deriveProfileImage(visitor: Visitor): Visitor {
  if (!visitor.profileImage && visitor.images && visitor.images.length > 0) {
    return { ...visitor, profileImage: visitor.images[0].fileUrl };
  }
  return visitor;
}

export const getVisitors = async (params: VisitorSearchRequest): Promise<PaginatedVisitorResponse> => {
  const { data } = await axiosClient.get<PaginatedVisitorResponse>('/vms/visitors', { params });
  return {
    ...data,
    data: data.data.map(deriveProfileImage),
  };
};

export const searchVisitors = async (params: VisitorSearchRequest): Promise<PaginatedVisitorResponse> => {
  return getVisitors(params);
};

export const createVisitor = async (payload: CreateVisitorRequest): Promise<Visitor> => {
  const { data } = await axiosClient.post<Visitor>('/vms/visitors', payload);
  return deriveProfileImage(data);
};

export const getVisitor = async (id: string): Promise<Visitor> => {
  const { data } = await axiosClient.get<Visitor>(`/vms/visitors/${id}`);
  return deriveProfileImage(data);
};

export const getVisitorHistory = async (id: string): Promise<VisitHistoryRecord[]> => {
  const { data } = await axiosClient.get<VisitHistoryRecord[]>(`/vms/visitors/${id}/visits`);
  return data;
};
