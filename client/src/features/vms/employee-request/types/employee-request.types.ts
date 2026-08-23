/**
 * What PerformX actually knows about the signed-in employee. There is no
 * designation or seat location on `users`, so the card does not claim one.
 */
export interface EmployeeInfo {
  employeeId: string;
  fullName: string;
  department: string;
  role: string;
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
