export enum VisitStatus {
  INSIDE = 'INSIDE',
  CHECKED_OUT = 'CHECKED_OUT',
  EXPIRED = 'EXPIRED',
}

export interface VisitorInfo {
  id: string;
  fullName: string;
  company?: string;
}

export interface EmployeeInfo {
  id: string;
  full_name: string;
  department?: string;
}

export interface VisitInsideResponse {
  id: string;
  visitor: VisitorInfo;
  employee: EmployeeInfo;
  purpose: string;
  checkInTime: string;
  passNumber?: string;
  status: VisitStatus;
}
