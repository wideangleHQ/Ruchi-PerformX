export enum VisitorRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export interface VisitorRequestResponse {
  id: string;
  visitorName: string;
  mobileNumber: string;
  address: string;
  hostEmployeeId: string;
  purpose: string;
  expectedArrival: string; 
  remarks?: string | null;
  status: VisitorRequestStatus;
  createdAt: string;
  updatedAt: string;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  generatedVisitId?: string | null;
}

export interface UpdateVisitorRequest {
  status: VisitorRequestStatus;
  rejectionReason?: string;
}

export interface VisitorRequestFilter {
  page?: number;
  limit?: number;
  status?: VisitorRequestStatus;
  hostEmployeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string; 
}

export interface PaginatedRequestResponse {
  data: VisitorRequestResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
