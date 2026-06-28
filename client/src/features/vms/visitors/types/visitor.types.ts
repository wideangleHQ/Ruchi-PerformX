export interface VisitorImage {
  id: string;
  imageType: string;
  imageSource: string;
  fileUrl: string;
  isPrimary: boolean;
}

export interface Visitor {
  id: string;
  firstName: string;
  lastName?: string | null;
  fullName: string;
  email?: string | null;
  mobileNumber?: string | null;
  status: string;
  companyName?: string;
  address?: string;
  idProofType?: string;
  idProofNumber?: string;
  faceRecognitionConsent?: boolean;
  notes?: string;
  createdAt: string;
  lastVisit?: string;
  images?: VisitorImage[];
  profileImage?: string | null;
}

export interface CreateVisitorRequest {
  firstName: string;
  lastName?: string;
  mobileNumber: string;
  email?: string;
  companyName: string;
  address: string;
  idProofType?: string;
  idProofNumber?: string;
  faceRecognitionConsent?: boolean;
  notes?: string;
}

export interface VisitorSearchRequest {
  page?: number;
  limit?: number;
  search?: string;
  mobileNumber?: string;
  email?: string;
  status?: string;
}

export interface PaginatedVisitorResponse {
  data: Visitor[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface VisitHistoryRecord {
  id: string;
  visitCode?: string | null;
  status: string;
  purpose: string;
  meetingDetails?: string | null;
  hostEmployeeId: string;
  hostEmployeeName: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  scheduledAt?: string | null;
  createdAt: string;
  branchId: string;
}
