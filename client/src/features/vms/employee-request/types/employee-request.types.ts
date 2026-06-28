export interface EmployeeInfo {
  employeeId: string;
  fullName: string;
  department: string;
  designation: string;
  location?: string;
}

export interface VisitorRequestPayload {
  visitorName: string;
  mobileNumber: string;
  company: string;
  address: string;
  purpose: string;
  preferredDate: string;
  preferredTime: string;
  remarks?: string;
}

export interface VisitorRequestResponse {
  id: string;
  requestNumber: string;
  visitorName: string;
  preferredDate: string;
  preferredTime: string;
  status: string;
  createdAt: string;
}
