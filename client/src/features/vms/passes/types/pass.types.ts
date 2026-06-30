export enum PassStatus {
  GENERATED = 'GENERATED',
  PRINTED = 'PRINTED',
  CHECKED_OUT = 'CHECKED_OUT',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export interface PassVisitor {
  id: string;
  fullName: string;
  mobileNumber?: string;
  email?: string;
  company?: string;
  address?: string;
  profileImage?: string | null;
}

export interface PassEmployee {
  id: string;
  full_name: string;
  department?: string;
}

export interface PassResponse {
  passNumber: string;
  visitor: PassVisitor;
  employee: PassEmployee;
  visitId: string;
  checkInTime?: string;
  checkOutTime?: string;
  purpose?: string;
  peopleCount: number;
  status: string;
  printedAt?: string;
  printedBy?: string;
  printCopies?: number;
}

export interface GeneratePassRequest {
  visitId: string;
}

export interface ReprintPassRequest {
  reason?: string;
}

export interface SearchPassFilter {
  search?: string;
  status?: string;
  visitorId?: string;
  hostEmployeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedPassResponse {
  data: PassResponse[];
  meta: {
    totalItems: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
