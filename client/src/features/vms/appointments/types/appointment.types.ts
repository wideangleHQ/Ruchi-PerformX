export enum VisitStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  NO_SHOW = 'NO_SHOW'
}

export interface AppointmentResponse {
  id: string;
  visitorId: string;
  branchId: string;
  hostEmployeeId: string;
  status: VisitStatus;
  visitCode?: string | null;
  appointmentReference?: string | null;
  purpose: string;
  meetingDetails?: string | null;
  scheduledAt?: string | null;
  createdById: string;
  createdAt: string;
}

export interface CreateAppointmentRequest {
  visitorId: string;
  branchId: string;
  hostEmployeeId: string;
  purpose: string;
  meetingDetails?: string;
  scheduledAt: string;
}

export interface UpdateAppointmentRequest {
  status?: VisitStatus;
  purpose?: string;
  meetingDetails?: string;
  scheduledAt?: string;
}

export interface SearchAppointmentFilter {
  search?: string;
  status?: VisitStatus;
  visitorId?: string;
  hostEmployeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PaginatedAppointmentResponse {
  data: AppointmentResponse[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
